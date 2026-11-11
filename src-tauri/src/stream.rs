//! Local media stream server.
//!
//! Serves googlevideo.com media bytes to the webview's <audio>/<video>
//! elements over http://127.0.0.1:<port>/stream?url=...
//!
//! Why this exists:
//! 1. The browser extension used declarativeNetRequest rules to strip
//!    Origin/Referer from googlevideo requests (they 403 otherwise). Here
//!    the bytes flow through Rust, which sends no Origin/Referer at all and
//!    never attaches the user's Google cookies (protecting the account).
//! 2. `googlevideo.com` paces open-ended HTTP requests (`Range: bytes=0-`) to
//!    ~1.0x the media bitrate, causing slow startup and seek stalls. Like
//!    `koda-stream-sw.js` in the web app, we issue bounded `&range=start-end`
//!    chunk requests (1.5 MB initial startup chunk + 2 MB steady chunks) over
//!    a shared connection-pooled HTTP client so googlevideo serves at full CDN
//!    line speed.

use std::collections::HashSet;
use std::io::{self, Read};
use std::sync::atomic::{AtomicU16, Ordering};
use std::sync::{Mutex, OnceLock};

static PORT: AtomicU16 = AtomicU16::new(0);

static ALLOWED_URLS: OnceLock<Mutex<HashSet<String>>> = OnceLock::new();

fn allowed_urls() -> &'static Mutex<HashSet<String>> {
    ALLOWED_URLS.get_or_init(|| Mutex::new(HashSet::new()))
}

#[tauri::command]
pub fn allow_stream_url(url: String) {
    if let Ok(mut set) = allowed_urls().lock() {
        set.insert(url);
    }
}

fn is_url_allowed(url: &str) -> bool {
    if let Ok(set) = allowed_urls().lock() {
        if set.contains(url) {
            return true;
        }
    }
    false
}

const FIRST_CHUNK_BYTES: u64 = 1536 * 1024; // 1.5 MB fast startup chunk
const NEXT_CHUNK_BYTES: u64 = 2 * 1024 * 1024; // 2 MB steady-state chunk

#[tauri::command]
pub fn stream_port() -> u16 {
    PORT.load(Ordering::Relaxed)
}

pub fn start() {
    let server = match tiny_http::Server::http("127.0.0.1:0") {
        Ok(s) => s,
        Err(e) => {
            eprintln!("[OurTube stream] failed to bind: {e}");
            return;
        }
    };
    let port = server
        .server_addr()
        .to_ip()
        .map(|a| a.port())
        .unwrap_or(0);
    PORT.store(port, Ordering::Relaxed);
    println!("[OurTube stream] media server on 127.0.0.1:{port}");

    std::thread::spawn(move || {
        for request in server.incoming_requests() {
            std::thread::spawn(move || handle(request));
        }
    });
}

fn respond_error(request: tiny_http::Request, code: u16, msg: &str) {
    let _ = request.respond(
        tiny_http::Response::from_string(msg.to_string())
            .with_status_code(tiny_http::StatusCode(code)),
    );
}

fn header(name: &[u8], value: &[u8]) -> Option<tiny_http::Header> {
    tiny_http::Header::from_bytes(name, value).ok()
}

fn build_range_url(base: &url::Url, start: u64, end_inclusive: u64) -> String {
    let mut u = base.clone();
    let kept: Vec<(String, String)> = u
        .query_pairs()
        .filter(|(k, _)| k != "range")
        .map(|(k, v)| (k.into_owned(), v.into_owned()))
        .collect();
    u.query_pairs_mut()
        .clear()
        .extend_pairs(kept)
        .append_pair("range", &format!("{start}-{end_inclusive}"));
    u.into()
}

struct ChunkedGoogleVideoReader {
    base_url: url::Url,
    position: u64,
    end_inclusive: u64,
    is_first_chunk: bool,
    current_resp: Option<reqwest::blocking::Response>,
}

impl ChunkedGoogleVideoReader {
    fn open_next_chunk(&mut self) -> io::Result<bool> {
        if self.position > self.end_inclusive {
            return Ok(false);
        }
        let chunk_size = if self.is_first_chunk {
            FIRST_CHUNK_BYTES
        } else {
            NEXT_CHUNK_BYTES
        };
        self.is_first_chunk = false;
        let chunk_end = self
            .end_inclusive
            .min(self.position.saturating_add(chunk_size - 1));
        let url = build_range_url(&self.base_url, self.position, chunk_end);

        let client = crate::proxy::http_client();
        let mut resp = client
            .get(&url)
            .send()
            .map_err(|e| io::Error::new(io::ErrorKind::Other, e.to_string()))?;

        if resp.status().as_u16() >= 500 {
            std::thread::sleep(std::time::Duration::from_millis(250));
            resp = client
                .get(&url)
                .send()
                .map_err(|e| io::Error::new(io::ErrorKind::Other, e.to_string()))?;
        }

        let code = resp.status().as_u16();
        if !(200..300).contains(&code) {
            return Err(io::Error::new(
                io::ErrorKind::Other,
                format!("googlevideo chunk HTTP {code}"),
            ));
        }

        self.current_resp = Some(resp);
        Ok(true)
    }
}

impl Read for ChunkedGoogleVideoReader {
    fn read(&mut self, buf: &mut [u8]) -> io::Result<usize> {
        loop {
            if let Some(resp) = self.current_resp.as_mut() {
                let n = resp.read(buf)?;
                if n > 0 {
                    self.position += n as u64;
                    return Ok(n);
                }
                self.current_resp = None;
            }
            if !self.open_next_chunk()? {
                return Ok(0);
            }
        }
    }
}

fn parse_range_header(raw: &str, total_len: u64) -> Option<(u64, u64)> {
    let bytes_prefix = raw.strip_prefix("bytes=")?;
    let (start_s, end_s) = bytes_prefix.split_once('-')?;
    let start: u64 = start_s.trim().parse().ok()?;
    let end: u64 = if end_s.trim().is_empty() {
        total_len.checked_sub(1)?
    } else {
        end_s
            .trim()
            .parse::<u64>()
            .ok()?
            .min(total_len.checked_sub(1)?)
    };
    if start >= total_len || start > end {
        return None;
    }
    Some((start, end))
}

fn can_chunk_url(target_url: &url::Url) -> Option<(u64, String)> {
    let host = target_url.host_str().unwrap_or("");
    if host.starts_with("manifest.") {
        return None;
    }
    let path = target_url.path();
    if path.contains("manifest") || path.ends_with(".m3u8") {
        return None;
    }
    let mut clen: Option<u64> = None;
    let mut mime: Option<String> = None;
    for (k, v) in target_url.query_pairs() {
        if k == "clen" {
            clen = v.parse::<u64>().ok().filter(|&n| n > 0);
        } else if k == "mime" {
            mime = Some(v.into_owned());
        }
    }
    Some((clen?, mime.unwrap_or_else(|| "audio/mp4".to_string())))
}

fn handle(request: tiny_http::Request) {
    let full = format!("http://localhost{}", request.url());
    let parsed = match url::Url::parse(&full) {
        Ok(u) => u,
        Err(_) => return respond_error(request, 400, "bad request"),
    };

    let target = parsed
        .query_pairs()
        .find(|(k, _)| k == "url")
        .map(|(_, v)| v.into_owned());
    let target = match target {
        Some(t) => t,
        None => return respond_error(request, 400, "missing url param"),
    };

    let target_url = match url::Url::parse(&target) {
        Ok(u) => u,
        Err(_) => return respond_error(request, 400, "bad target url"),
    };
    let host = target_url.host_str().unwrap_or("");
    let is_gv = host == "googlevideo.com" || host.ends_with(".googlevideo.com");
    let is_allowed = is_gv || is_url_allowed(&target);
    if !is_allowed {
        return respond_error(request, 403, "host not allowed");
    }

    let is_get = matches!(request.method(), tiny_http::Method::Get);
    let is_head = matches!(request.method(), tiny_http::Method::Head);
    if !is_get && !is_head {
        return respond_error(request, 405, "method not allowed");
    }

    let range_hdr = request
        .headers()
        .iter()
        .find(|h| h.field.equiv("range"))
        .map(|h| h.value.as_str().to_string());

    // Fast path: chunked &range= streaming when `clen` is known on GET.
    if is_get {
        if let Some((total_len, content_type)) = can_chunk_url(&target_url) {
            let (start, end) = match range_hdr.as_deref() {
                Some(r) => match parse_range_header(r, total_len) {
                    Some(bounds) => bounds,
                    None => return respond_error(request, 416, "range not satisfiable"),
                },
                None => (0, total_len - 1),
            };
            let content_length = (end - start + 1) as usize;
            let mut headers = Vec::new();
            if let Some(h) = header(b"Content-Type", content_type.as_bytes()) {
                headers.push(h);
            }
            if let Some(h) = header(b"Accept-Ranges", b"bytes") {
                headers.push(h);
            }
            if let Some(h) = header(b"Content-Length", content_length.to_string().as_bytes()) {
                headers.push(h);
            }
            if let Some(h) = header(
                b"Content-Range",
                format!("bytes {start}-{end}/{total_len}").as_bytes(),
            ) {
                headers.push(h);
            }
            if let Some(h) = header(b"Cache-Control", b"no-store") {
                headers.push(h);
            }
            if let Some(h) = header(b"Access-Control-Allow-Origin", b"*") {
                headers.push(h);
            }

            let reader = ChunkedGoogleVideoReader {
                base_url: target_url,
                position: start,
                end_inclusive: end,
                is_first_chunk: true,
                current_resp: None,
            };
            let response = tiny_http::Response::new(
                tiny_http::StatusCode(206),
                headers,
                Box::new(reader) as Box<dyn Read + Send>,
                Some(content_length),
                None,
            );
            let _ = request.respond(response);
            return;
        }
    }

    // Fallback passthrough (HEAD or URLs without `clen`) using the shared client.
    let method = if is_head {
        reqwest::Method::HEAD
    } else {
        reqwest::Method::GET
    };
    let mut req = crate::proxy::http_client().request(method, target_url.as_str());
    if let Some(r) = range_hdr {
        req = req.header("Range", r);
    }

    let upstream = match req.send() {
        Ok(r) => r,
        Err(e) => return respond_error(request, 502, &e.to_string()),
    };

    let status = upstream.status().as_u16();
    let mut headers: Vec<tiny_http::Header> = Vec::new();
    let mut content_length: Option<usize> = None;
    for (k, v) in upstream.headers() {
        let name = k.as_str().to_ascii_lowercase();
        if !matches!(
            name.as_str(),
            "content-type" | "content-length" | "content-range" | "accept-ranges" | "cache-control"
        ) {
            continue;
        }
        let Ok(val) = v.to_str() else { continue };
        if name == "content-length" {
            content_length = val.parse::<usize>().ok();
        }
        if let Some(h) = header(k.as_str().as_bytes(), val.as_bytes()) {
            headers.push(h);
        }
    }
    if let Some(h) = header(b"Access-Control-Allow-Origin", b"*") {
        headers.push(h);
    }

    let response = tiny_http::Response::new(
        tiny_http::StatusCode(status),
        headers,
        upstream,
        content_length,
        None,
    );
    let _ = request.respond(response);
}
