"""Local English speech-to-text service (faster-whisper).

POST /transcribe   multipart field `file` (aac/mp3/wav/m4a/...) -> JSON with timestamped segments
GET  /health       -> {"ok": true, "model": "..."}

Run via `npm run dev` (spawned by vite.config.ts) or manually:
    transcribe/.venv/bin/python transcribe/server.py
"""
import os
import subprocess
import tempfile
import threading
from pathlib import Path

import numpy as np
import uvicorn
from fastapi import FastAPI, File, HTTPException, UploadFile
from faster_whisper import WhisperModel

MODEL_NAME = os.environ.get("WHISPER_MODEL", "small.en")
PORT = int(os.environ.get("TRANSCRIBE_PORT", "8787"))

app = FastAPI()
_model: WhisperModel | None = None
_lock = threading.Lock()  # one transcription at a time; the model isn't meant to be shared concurrently


def get_model() -> WhisperModel:
    global _model
    if _model is None:
        # int8 on CPU is fast on Apple Silicon and needs no GPU setup
        _model = WhisperModel(MODEL_NAME, device="cpu", compute_type="int8")
    return _model


def decode_audio(path: str) -> np.ndarray:
    """Decode any ffmpeg-readable file (aac, m4a, mp3, wav...) to 16 kHz mono float32."""
    proc = subprocess.run(
        ["ffmpeg", "-nostdin", "-loglevel", "error", "-i", path,
         "-f", "f32le", "-ac", "1", "-ar", "16000", "-"],
        capture_output=True,
    )
    if proc.returncode != 0 or not proc.stdout:
        raise RuntimeError(proc.stderr.decode(errors="replace").strip() or "ffmpeg produced no audio")
    return np.frombuffer(proc.stdout, dtype=np.float32)


@app.get("/health")
def health():
    return {"ok": True, "model": MODEL_NAME}


@app.post("/transcribe")
def transcribe(file: UploadFile = File(...)):
    suffix = Path(file.filename or "audio").suffix or ".aac"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(file.file.read())
        path = tmp.name
    try:
        audio = decode_audio(path)
        with _lock:
            segments, info = get_model().transcribe(
                audio,
                language="en",
                beam_size=5,
                vad_filter=True,  # skip silence; also curbs hallucinated text
            )
            out = [
                {"start": round(s.start, 2), "end": round(s.end, 2), "text": s.text.strip()}
                for s in segments
                if s.text.strip()
            ]
        return {"filename": file.filename, "duration": round(len(audio) / 16000, 2), "segments": out}
    except Exception as exc:  # undecodable audio etc.
        raise HTTPException(status_code=422, detail=f"Could not transcribe: {exc}")
    finally:
        os.unlink(path)


if __name__ == "__main__":
    print(f"[transcribe] loading model '{MODEL_NAME}' (first run downloads it)...", flush=True)
    get_model()
    print(f"[transcribe] ready on http://127.0.0.1:{PORT}", flush=True)
    uvicorn.run(app, host="127.0.0.1", port=PORT, log_level="warning")
