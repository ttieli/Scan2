# RaptorQR vendored source

- Upstream: https://github.com/infrost/RaptorQR
- Commit: `fdb434e1fc1126f84b98e407be8d24bbb683b597`
- License: MIT; the original license files remain in each vendored package.
- Imported scope: browser app, core protocol, RaptorQ WASM and fast_qr WASM packages.
- Local changes: single-file Worker/WASM build, integrity envelope, front/rear camera selection, project branding and 1/2/4 QR presets.

The vendored source is build-time input only. The production `sender-fast.html`
and `receiver-fast.html` files must not load any file from this directory at
runtime.
