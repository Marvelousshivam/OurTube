//! Native DAC Bit-Perfect audio engine using WASAPI Exclusive Mode + Symphonia.
//!
//! Provides bit-perfect, unresampled audio playback directly to Windows hardware
//! DAC endpoints (USB DACs, internal DACs, PCIe sound cards).
//! Bypasses Windows Audio Engine mixer and resampler, locking the DAC to the
//! track's exact native sample rate (44.1 - 192 kHz) and bit depth (16 / 24 / 32-bit).

#![allow(unused_imports)]

use serde::Serialize;
use std::io::Cursor;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::{channel, Receiver, Sender};
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant};
use tauri::Emitter;

use symphonia::core::audio::{AudioBufferRef, SampleBuffer, SignalSpec};
use symphonia::core::codecs::DecoderOptions;
use symphonia::core::errors::Error as SymphoniaError;
use symphonia::core::formats::{FormatOptions, FormatReader, SeekMode, SeekTo};
use symphonia::core::io::MediaSourceStream;
use symphonia::core::meta::MetadataOptions;
use symphonia::core::probe::Hint;
use symphonia::core::units::Time;

use wasapi::{
    AudioClient, Direction, SampleType, StreamMode, WaveFormat,
};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DacDeviceInfo {
    pub device_name: String,
    pub shared_sample_rate: u32,
    pub shared_bits: u16,
    pub exclusive_supported: bool,
    pub supported_rates: Vec<u32>,
    pub supported_bit_depths: Vec<u16>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DacState {
    pub playing: bool,
    pub paused: bool,
    pub stopped: bool,
    pub position_sec: f64,
    pub duration_sec: f64,
    pub sample_rate: u32,
    pub bit_depth: u16,
    pub channels: u16,
    pub mode: String,
    pub device_name: String,
    pub ended: bool,
    pub error: Option<String>,
}

impl Default for DacState {
    fn default() -> Self {
        Self {
            playing: false,
            paused: false,
            stopped: true,
            position_sec: 0.0,
            duration_sec: 0.0,
            sample_rate: 44100,
            bit_depth: 16,
            channels: 2,
            mode: "Standard Shared Mixer".into(),
            device_name: "Default Audio Device".into(),
            ended: false,
            error: None,
        }
    }
}

enum DacCommand {
    Pause,
    Resume,
    Seek(f64),
    Stop,
}

static COMMAND_TX: OnceLock<Mutex<Option<Sender<DacCommand>>>> = OnceLock::new();
static CURRENT_STATE: OnceLock<Mutex<DacState>> = OnceLock::new();
static PLAYBACK_RUNNING: AtomicBool = AtomicBool::new(false);

fn command_tx() -> &'static Mutex<Option<Sender<DacCommand>>> {
    COMMAND_TX.get_or_init(|| Mutex::new(None))
}

fn current_state() -> &'static Mutex<DacState> {
    CURRENT_STATE.get_or_init(|| Mutex::new(DacState::default()))
}

#[tauri::command]
pub fn dac_probe_device() -> Result<DacDeviceInfo, String> {
    let _ = wasapi::initialize_mta();
    let enumerator = wasapi::DeviceEnumerator::new().map_err(|e| e.to_string())?;
    let device = enumerator
        .get_default_device(Direction::Render)
        .map_err(|e| e.to_string())?;
    let device_name = device
        .get_friendlyname()
        .unwrap_or_else(|_| "Default Audio Device".to_string());

    let (shared_sample_rate, shared_bits) = match device.get_device_format() {
        Ok(fmt) => (fmt.get_samplespersec(), fmt.get_validbitspersample()),
        Err(_) => (48000, 24),
    };

    let client = device.get_iaudioclient().map_err(|e| e.to_string())?;

    let test_rates = [44100u32, 48000, 88200, 96000, 176400, 192000];
    let mut supported_rates = Vec::new();
    let mut supported_bit_depths = Vec::new();

    for &rate in &test_rates {
        // Try candidate formats at this rate
        let c24 = WaveFormat::new(32, 24, SampleType::Int, rate as usize, 2, None);
        let c16 = WaveFormat::new(16, 16, SampleType::Int, rate as usize, 2, None);
        if client.is_supported_exclusive_with_quirks(&c24).is_ok()
            || client.is_supported_exclusive_with_quirks(&c16).is_ok()
        {
            supported_rates.push(rate);
        }
    }

    // Check bit depths at standard 48 kHz
    let f16 = WaveFormat::new(16, 16, SampleType::Int, 48000, 2, None);
    if client.is_supported_exclusive_with_quirks(&f16).is_ok() {
        supported_bit_depths.push(16);
    }
    let f24_32 = WaveFormat::new(32, 24, SampleType::Int, 48000, 2, None);
    let f24_packed = WaveFormat::new(24, 24, SampleType::Int, 48000, 2, None);
    if client.is_supported_exclusive_with_quirks(&f24_32).is_ok()
        || client.is_supported_exclusive_with_quirks(&f24_packed).is_ok()
    {
        supported_bit_depths.push(24);
    }
    let f32 = WaveFormat::new(32, 32, SampleType::Int, 48000, 2, None);
    if client.is_supported_exclusive_with_quirks(&f32).is_ok() {
        supported_bit_depths.push(32);
    }

    let exclusive_supported = !supported_rates.is_empty();

    Ok(DacDeviceInfo {
        device_name,
        shared_sample_rate,
        shared_bits,
        exclusive_supported,
        supported_rates,
        supported_bit_depths,
    })
}

#[tauri::command]
pub fn dac_state() -> DacState {
    current_state()
        .lock()
        .map(|s| s.clone())
        .unwrap_or_default()
}

#[tauri::command]
pub fn dac_pause() -> Result<(), String> {
    if let Ok(guard) = command_tx().lock() {
        if let Some(tx) = guard.as_ref() {
            let _ = tx.send(DacCommand::Pause);
            if let Ok(mut state) = current_state().lock() {
                state.paused = true;
                state.playing = false;
            }
            return Ok(());
        }
    }
    Err("DAC playback not active".into())
}

#[tauri::command]
pub fn dac_resume() -> Result<(), String> {
    if let Ok(guard) = command_tx().lock() {
        if let Some(tx) = guard.as_ref() {
            let _ = tx.send(DacCommand::Resume);
            if let Ok(mut state) = current_state().lock() {
                state.paused = false;
                state.playing = true;
            }
            return Ok(());
        }
    }
    Err("DAC playback not active".into())
}

#[tauri::command]
pub fn dac_seek(position_sec: f64) -> Result<(), String> {
    if let Ok(guard) = command_tx().lock() {
        if let Some(tx) = guard.as_ref() {
            let _ = tx.send(DacCommand::Seek(position_sec));
            return Ok(());
        }
    }
    Err("DAC playback not active".into())
}

#[tauri::command]
pub fn dac_stop() -> Result<(), String> {
    if let Ok(guard) = command_tx().lock() {
        if let Some(tx) = guard.as_ref() {
            let _ = tx.send(DacCommand::Stop);
        }
    }
    PLAYBACK_RUNNING.store(false, Ordering::SeqCst);
    if let Ok(mut state) = current_state().lock() {
        state.playing = false;
        state.paused = false;
        state.stopped = true;
    }
    Ok(())
}

#[tauri::command]
pub fn dac_play(app: tauri::AppHandle, url: String, exclusive: bool) -> Result<(), String> {
    // Stop any existing session
    let _ = dac_stop();
    // Wait briefly for previous thread to wind down
    std::thread::sleep(Duration::from_millis(60));

    let (tx, rx) = channel::<DacCommand>();
    if let Ok(mut guard) = command_tx().lock() {
        *guard = Some(tx);
    }

    PLAYBACK_RUNNING.store(true, Ordering::SeqCst);

    std::thread::spawn(move || {
        run_dac_playback(app, url, exclusive, rx);
    });

    Ok(())
}

fn emit_state(app: &tauri::AppHandle, state: &DacState) {
    if let Ok(mut cur) = current_state().lock() {
        *cur = state.clone();
    }
    let _ = app.emit("dac-state", state);
}

fn run_dac_playback(
    app: tauri::AppHandle,
    url: String,
    exclusive: bool,
    rx: Receiver<DacCommand>,
) {
    let mut state = DacState {
        playing: true,
        paused: false,
        stopped: false,
        position_sec: 0.0,
        duration_sec: 0.0,
        sample_rate: 44100,
        bit_depth: 16,
        channels: 2,
        mode: if exclusive {
            "WASAPI Exclusive (Bit-Perfect)".into()
        } else {
            "WASAPI Shared".into()
        },
        device_name: "Default Audio Device".into(),
        ended: false,
        error: None,
    };
    emit_state(&app, &state);

    // Initialize COM on this thread
    let _ = wasapi::initialize_mta();

    // 1. Fetch audio stream into memory
    let client = crate::proxy::http_client();
    let resp = match client
        .get(&url)
        .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36")
        .header("Accept", "*/*")
        .timeout(Duration::from_secs(30))
        .send()
    {
        Ok(r) => r,
        Err(e) => {
            state.error = Some(format!("Fetch error: {e}"));
            state.playing = false;
            state.stopped = true;
            emit_state(&app, &state);
            return;
        }
    };

    if !resp.status().is_success() {
        state.error = Some(format!("HTTP error {}", resp.status()));
        state.playing = false;
        state.stopped = true;
        emit_state(&app, &state);
        return;
    }

    let audio_bytes = match resp.bytes() {
        Ok(b) => b.to_vec(),
        Err(e) => {
            state.error = Some(format!("Read error: {e}"));
            state.playing = false;
            state.stopped = true;
            emit_state(&app, &state);
            return;
        }
    };

    // 2. Symphonia probe and decode
    let cursor = Cursor::new(audio_bytes);
    let mss = MediaSourceStream::new(Box::new(cursor), Default::default());
    let hint = Hint::new();
    let fmt_opts = FormatOptions::default();
    let meta_opts = MetadataOptions::default();

    let probed = match symphonia::default::get_probe().format(&hint, mss, &fmt_opts, &meta_opts) {
        Ok(p) => p,
        Err(e) => {
            state.error = Some(format!("Codec probe error: {e}"));
            state.playing = false;
            state.stopped = true;
            emit_state(&app, &state);
            return;
        }
    };

    let mut format_reader = probed.format;
    let track = match format_reader.default_track() {
        Some(t) => t,
        None => {
            state.error = Some("No audio track found in stream".into());
            state.playing = false;
            state.stopped = true;
            emit_state(&app, &state);
            return;
        }
    };

    let track_id = track.id;
    let codec_params = track.codec_params.clone();
    let dec_opts = DecoderOptions::default();
    let mut decoder = match symphonia::default::get_codecs().make(&codec_params, &dec_opts) {
        Ok(d) => d,
        Err(e) => {
            state.error = Some(format!("Decoder error: {e}"));
            state.playing = false;
            state.stopped = true;
            emit_state(&app, &state);
            return;
        }
    };

    let sample_rate = codec_params.sample_rate.unwrap_or(44100);
    let channels = codec_params.channels.map(|c| c.count() as u16).unwrap_or(2);
    let bit_depth = codec_params.bits_per_sample.unwrap_or(16) as u16;

    let duration_sec = if let (Some(n_frames), Some(tb)) = (codec_params.n_frames, codec_params.time_base) {
        let time = tb.calc_time(n_frames);
        time.seconds as f64 + time.frac
    } else {
        0.0
    };

    state.sample_rate = sample_rate;
    state.channels = channels;
    state.bit_depth = bit_depth;
    state.duration_sec = duration_sec;

    // 3. Setup WASAPI Endpoint
    let enumerator = match wasapi::DeviceEnumerator::new() {
        Ok(e) => e,
        Err(e) => {
            state.error = Some(format!("WASAPI Enumerator error: {e}"));
            state.playing = false;
            state.stopped = true;
            emit_state(&app, &state);
            return;
        }
    };

    let device = match enumerator.get_default_device(Direction::Render) {
        Ok(d) => d,
        Err(e) => {
            state.error = Some(format!("WASAPI Device error: {e}"));
            state.playing = false;
            state.stopped = true;
            emit_state(&app, &state);
            return;
        }
    };

    state.device_name = device
        .get_friendlyname()
        .unwrap_or_else(|_| "Default Audio Device".to_string());

    let mut audio_client = match device.get_iaudioclient() {
        Ok(c) => c,
        Err(e) => {
            state.error = Some(format!("AudioClient activate error: {e}"));
            state.playing = false;
            state.stopped = true;
            emit_state(&app, &state);
            return;
        }
    };

    // Format negotiation:
    // If exclusive mode requested, negotiate exact hardware rate + bit depth
    let mut actual_exclusive = false;
    let mut selected_format: Option<WaveFormat> = None;

    if exclusive {
        let candidates = if bit_depth >= 24 {
            vec![
                WaveFormat::new(32, 24, SampleType::Int, sample_rate as usize, channels as usize, None),
                WaveFormat::new(24, 24, SampleType::Int, sample_rate as usize, channels as usize, None),
                WaveFormat::new(32, 32, SampleType::Int, sample_rate as usize, channels as usize, None),
                WaveFormat::new(16, 16, SampleType::Int, sample_rate as usize, channels as usize, None),
            ]
        } else {
            vec![
                WaveFormat::new(16, 16, SampleType::Int, sample_rate as usize, channels as usize, None),
                WaveFormat::new(32, 24, SampleType::Int, sample_rate as usize, channels as usize, None),
                WaveFormat::new(32, 32, SampleType::Int, sample_rate as usize, channels as usize, None),
            ]
        };

        for candidate in candidates {
            if let Ok(accepted) = audio_client.is_supported_exclusive_with_quirks(&candidate) {
                selected_format = Some(accepted);
                actual_exclusive = true;
                break;
            }
        }
    }

    let (active_format, stream_mode) = if actual_exclusive && selected_format.is_some() {
        let fmt = selected_format.unwrap();
        let (_def_p, min_p) = audio_client.get_device_period().unwrap_or((100000, 30000));
        let desired_period = audio_client
            .calculate_aligned_period_near(3 * min_p / 2, Some(128), &fmt)
            .unwrap_or(min_p);
        state.mode = "WASAPI Exclusive (Bit-Perfect)".into();
        (fmt, StreamMode::EventsExclusive { period_hns: desired_period })
    } else {
        // Fallback to shared mode
        let mix_fmt = match audio_client.get_mixformat() {
            Ok(f) => f,
            Err(e) => {
                state.error = Some(format!("WASAPI MixFormat error: {e}"));
                state.playing = false;
                state.stopped = true;
                emit_state(&app, &state);
                return;
            }
        };
        let (def_period, _) = audio_client.get_device_period().unwrap_or((100000, 30000));
        state.mode = "WASAPI Shared".into();
        (
            mix_fmt,
            StreamMode::EventsShared {
                autoconvert: true,
                buffer_duration_hns: def_period,
            },
        )
    };

    if let Err(e) = audio_client.initialize_client(&active_format, Direction::Render, stream_mode, None) {
        state.error = Some(format!("WASAPI Init error: {e}"));
        state.playing = false;
        state.stopped = true;
        emit_state(&app, &state);
        return;
    }

    let h_event = match audio_client.set_get_eventhandle() {
        Ok(h) => h,
        Err(e) => {
            state.error = Some(format!("WASAPI Event error: {e}"));
            state.playing = false;
            state.stopped = true;
            emit_state(&app, &state);
            return;
        }
    };

    let render_client = match audio_client.get_audiorenderclient() {
        Ok(rc) => rc,
        Err(e) => {
            state.error = Some(format!("WASAPI RenderClient error: {e}"));
            state.playing = false;
            state.stopped = true;
            emit_state(&app, &state);
            return;
        }
    };

    if let Err(e) = audio_client.start_stream() {
        state.error = Some(format!("WASAPI Start error: {e}"));
        state.playing = false;
        state.stopped = true;
        emit_state(&app, &state);
        return;
    }

    emit_state(&app, &state);

    // 4. Playback and render loop
    let store_bits = active_format.get_bitspersample();
    let valid_bits = active_format.get_validbitspersample();
    let is_float = matches!(active_format.get_subformat(), Ok(SampleType::Float));
    let frame_bytes = (active_format.get_blockalign()) as usize;

    let mut pcm_buffer: Vec<u8> = Vec::with_capacity(65536);
    let mut last_emit = Instant::now();
    let mut current_frame: u64 = 0;
    let mut is_paused = false;

    while PLAYBACK_RUNNING.load(Ordering::SeqCst) {
        // Handle incoming commands
        while let Ok(cmd) = rx.try_recv() {
            match cmd {
                DacCommand::Pause => {
                    is_paused = true;
                    let _ = audio_client.stop_stream();
                    state.paused = true;
                    state.playing = false;
                    emit_state(&app, &state);
                }
                DacCommand::Resume => {
                    is_paused = false;
                    let _ = audio_client.start_stream();
                    state.paused = false;
                    state.playing = true;
                    emit_state(&app, &state);
                }
                DacCommand::Seek(pos) => {
                    let secs = pos.max(0.0) as u64;
                    let frac = pos.max(0.0) - secs as f64;
                    let seek_to = SeekTo::Time {
                        time: Time::new(secs, frac),
                        track_id: Some(track_id),
                    };
                    if format_reader.seek(SeekMode::Accurate, seek_to).is_ok() {
                        decoder.reset();
                        pcm_buffer.clear();
                        let _ = audio_client.reset_stream();
                        current_frame = (pos * sample_rate as f64).round() as u64;
                        state.position_sec = pos;
                        emit_state(&app, &state);
                    }
                }
                DacCommand::Stop => {
                    PLAYBACK_RUNNING.store(false, Ordering::SeqCst);
                    break;
                }
            }
        }

        if !PLAYBACK_RUNNING.load(Ordering::SeqCst) {
            break;
        }

        if is_paused {
            std::thread::sleep(Duration::from_millis(40));
            continue;
        }

        // Wait on the buffer event
        if h_event.wait_for_event(100).is_err() {
            continue;
        }

        let available_space = match audio_client.get_available_space_in_frames() {
            Ok(s) => s as usize,
            Err(_) => 0,
        };

        if available_space == 0 {
            continue;
        }

        let needed_bytes = available_space * frame_bytes;

        // Decode more frames if pcm_buffer has fewer than needed
        while pcm_buffer.len() < needed_bytes {
            match format_reader.next_packet() {
                Ok(packet) => {
                    if packet.track_id() != track_id {
                        continue;
                    }
                    match decoder.decode(&packet) {
                        Ok(audio_buf) => {
                            let spec = *audio_buf.spec();
                            let duration = audio_buf.capacity() as u64;

                            if is_float {
                                let mut sbuf = SampleBuffer::<f32>::new(duration, spec);
                                sbuf.copy_interleaved_ref(audio_buf);
                                let bytes: &[u8] = bytemuck::cast_slice(sbuf.samples());
                                pcm_buffer.extend_from_slice(bytes);
                            } else if store_bits == 16 {
                                let mut sbuf = SampleBuffer::<i16>::new(duration, spec);
                                sbuf.copy_interleaved_ref(audio_buf);
                                let bytes: &[u8] = bytemuck::cast_slice(sbuf.samples());
                                pcm_buffer.extend_from_slice(bytes);
                            } else if store_bits == 32 {
                                let mut sbuf = SampleBuffer::<i32>::new(duration, spec);
                                sbuf.copy_interleaved_ref(audio_buf);
                                let samples = sbuf.samples();
                                if valid_bits == 24 {
                                    // 24 valid bits MSB aligned in 32-bit container
                                    for &s in samples {
                                        let aligned = (s >> 8) << 8;
                                        pcm_buffer.extend_from_slice(&aligned.to_ne_bytes());
                                    }
                                } else {
                                    let bytes: &[u8] = bytemuck::cast_slice(samples);
                                    pcm_buffer.extend_from_slice(bytes);
                                }
                            } else if store_bits == 24 {
                                // 24-bit packed: 3 bytes per sample
                                let mut sbuf = SampleBuffer::<i32>::new(duration, spec);
                                sbuf.copy_interleaved_ref(audio_buf);
                                for &s in sbuf.samples() {
                                    let val = s >> 8;
                                    let b0 = val as u8;
                                    let b1 = (val >> 8) as u8;
                                    let b2 = (val >> 16) as u8;
                                    pcm_buffer.extend_from_slice(&[b0, b1, b2]);
                                }
                            }
                        }
                        Err(SymphoniaError::DecodeError(_)) => continue,
                        Err(_) => break,
                    }
                }
                Err(_) => {
                    // Stream finished
                    break;
                }
            }
        }

        if pcm_buffer.is_empty() {
            // Audio track complete
            state.playing = false;
            state.ended = true;
            state.position_sec = state.duration_sec;
            emit_state(&app, &state);
            break;
        }

        let write_bytes = needed_bytes.min(pcm_buffer.len());
        // Align to whole frames
        let write_frames = write_bytes / frame_bytes;
        let actual_write_bytes = write_frames * frame_bytes;

        if actual_write_bytes > 0 {
            let chunk = &pcm_buffer[..actual_write_bytes];
            let _ = render_client.write_to_device(chunk, None);
            pcm_buffer.drain(..actual_write_bytes);
            current_frame += write_frames as u64;
            state.position_sec = (current_frame as f64) / (sample_rate as f64);
        }

        if last_emit.elapsed() >= Duration::from_millis(250) {
            emit_state(&app, &state);
            last_emit = Instant::now();
        }
    }

    let _ = audio_client.stop_stream();
    PLAYBACK_RUNNING.store(false, Ordering::SeqCst);
    state.playing = false;
    emit_state(&app, &state);
    wasapi::deinitialize();
}
