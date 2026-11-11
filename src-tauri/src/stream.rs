//! Local media stream server.
//!
//! Serves googlevideo.com media bytes to the webview's <audio>/<video>
//! elements over http://127.0.0.1:<port>/stream?url=...
//!
//! Why this exists: the browser extension used declarativeNetRequest rules to
//! strip Origin/Referer from googlevideo requests (they 403 otherwise). Here
//! the bytes flow through Rust, which sends no Origin/Referer at all.
//!
//! Phase 2 note: this server is the seam where the bit-perfect playback path
//! plugs in - media bytes already flow through Rust here, so decoding them
//! and pushing PCM to a WASAPI-exclusive output is additive work.
//!
//! Range requests are forwarded so seeking works.

use std::sync::atomic::{AtomicU16, Ordering};

static PORT: AtomicU16 = AtomicU16::new(0);

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
        tiny_http::Response::from_string(msg.to_string()).with_status_code(tiny_http::StatusCode(code)),
    );
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
    if !(host == "googlevideo.com" || host.ends_with(".googlevideo.com")) {
        return respond_error(request, 403, "host not allowed");
    }

    let method = match request.method() {
        tiny_http::Method::Get => reqwest::Method::GET,
        tiny_http::Method::Head => reqwest::Method::HEAD,
        _ => return respond_error(request, 405, "method not allowed"),
    };

    let client = match reqwest::blocking::Client::builder().build() {
        Ok(c) => c,
        Err(e) => return respond_error(request, 500, &e.to_string()),
    };
    let mut req = client.request(method, target_url.as_str());

    // Forward Range (seek support). Deliberately send NO Origin/Referer.
    for h in request.headers() {
        if h.field.equiv("range") {
            req = req.header("Range", h.value.as_str());
        }
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
        if let Ok(h) = tiny_http::Header::from_bytes(k.as_str().as_bytes(), val.as_bytes()) {
            headers.push(h);
        }
    }
    if let Ok(h) = tiny_http::Header::from_bytes(&b"Access-Control-Allow-Origin"[..], &b"*"[..]) {
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
