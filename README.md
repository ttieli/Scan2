# QR Code Data Transfer System (Scan2)

A purely offline, secure, and reliable data transfer solution using QR codes. No network required.

## 🏗 Architecture

The system consists of three static HTML files with zero external dependencies (all libraries are embedded).

*   **`index.html`**: The entry point. A simple navigation hub linking to the Sender and Receiver.
*   **`sender.html`**: The data encoder.
    *   **Input**: Text or Files (any type).
    *   **Processing**: 
        *   Files are read as binary, Base64 encoded, and split into small JSON chunks.
        *   Text is encoded and chunked.
        *   Supports "Universal Mode" (standard QR) and "Private Mode" (chunked JSON protocol).
    *   **Output**: A sequence of QR codes. Features fullscreen display mode for optimal scanning.
*   **`receiver.html`**: The data decoder.
    *   **Input**: Camera video stream (via `jsQR` library).
    *   **Processing**:
        *   Scans QR codes and parses the custom JSON protocol.
        *   Reassembles chunks in memory.
        *   Visualizes progress with a grid map.
        *   Auto-saves progress to `localStorage` for session recovery.
    *   **Output**: Reassembled text or downloadable file (blob).

## 🚀 Quick Start

### Online Demo
Visit: **[https://ttieli.github.io/Scan2/](https://ttieli.github.io/Scan2/)**

### Offline Usage
1.  Download the `index.html`, `sender.html`, and `receiver.html` files.
2.  Open `index.html` in any modern browser (Chrome/Safari/Edge recommended).
3.  **Sender**: Open `sender.html`, choose a file or enter text.
4.  **Receiver**: Open `receiver.html` on a mobile device, grant camera permission, and scan the QR codes.

## 📁 File Structure

```
/
├── index.html        # Main landing page
├── sender.html       # Data encoding & QR generation application
├── receiver.html     # Camera scanning & data reassembly application
└── README.md         # This documentation
```

## ✨ Key Features

*   **100% Offline**: Works in air-gapped environments.
*   **File Agnostic**: Transmits any file type (Images, PDFs, Zips, binaries, etc.).
*   **Chunking Protocol**: Automatically splits large files into multiple QR codes.
*   **Session Recovery**: Progress is saved automatically; resume scanning if the page reloads.
*   **Visual Feedback**: Receiver shows a realtime grid map of received/missing chunks.
*   **Optimized UX**: Sender supports fullscreen "Single Mode" with dynamic sizing for easy scanning.

## 🛠 Testing

Test files are maintained locally in the `_local/` directory (not included in the repository). Open `_local/test-runner.html` in a browser to run the automated test suite, which validates checksum logic, chunk estimation accuracy, protocol format, and session management.
