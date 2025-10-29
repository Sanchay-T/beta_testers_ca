"""
Lightweight FastAPI server that mimics the future Django ingest endpoint.
Run it locally to validate the Electron metrics payload end-to-end before
hooking up the real backend.

Usage:
  1. Activate your virtual environment:
       # PowerShell
       .\.venv\Scripts\Activate.ps1

  2. Install dependencies (once):
       pip install fastapi uvicorn

  3. Start the server:
       uvicorn backend.mock_metrics_server:app --reload --host 0.0.0.0 --port 8000

  4. Point the Electron app at this local endpoint, e.g. set:
       METRICS_ENDPOINT=http://127.0.0.1:8000/api/metrics/ingest/

  5. Trigger a metrics export from the app; JSON payloads will be stored in
     backend/metrics_ingest/ for inspection.
"""
from __future__ import annotations

import datetime as dt
import gzip
import json
import logging
from pathlib import Path

from fastapi import FastAPI, Header, HTTPException, Request


app = FastAPI(title="Metrics Mock Ingest", version="0.1.0")

OUTPUT_DIR = Path(__file__).resolve().parent / "metrics_ingest"
OUTPUT_DIR.mkdir(exist_ok=True)

logger = logging.getLogger("metrics_mock")
log_file = OUTPUT_DIR / "mock_server.log"
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler(log_file, encoding="utf-8"),
    ],
)


@app.post("/api/metrics/ingest/")
async def ingest_metrics(
    request: Request,
    content_encoding: str | None = Header(default=None, convert_underscores=False),
    authorization: str | None = Header(default=None),
) -> dict[str, object]:
    try:
        return await _ingest_impl(request, content_encoding, authorization)
    except HTTPException:
        raise
    except Exception as exc:  # pylint: disable=broad-except
        logger.exception("Unhandled ingest failure")
        raise HTTPException(status_code=500, detail=str(exc)) from exc


async def _ingest_impl(
    request: Request,
    content_encoding: str | None,
    authorization: str | None,
) -> dict[str, object]:
    """
    Accepts the gzipped/JSON payload that the Electron app posts.
    Stores each payload on disk and echoes back basic metadata.
    """
    raw_body = await request.body()
    logger.info("Received payload: bytes=%s encoding=%s auth=%s", len(raw_body), content_encoding, bool(authorization))

    def _try_decompress(data: bytes) -> bytes:
        try:
            return gzip.decompress(data)
        except OSError as exc:
            raise HTTPException(status_code=400, detail=f"Invalid gzip body: {exc}") from exc

    if content_encoding and content_encoding.lower() == "gzip":
        raw_body = _try_decompress(raw_body)
    elif raw_body.startswith(b"\x1f\x8b"):
        logger.info("Decompressing payload based on gzip magic header.")
        raw_body = _try_decompress(raw_body)

    try:
        text = raw_body.decode("utf-8")
    except UnicodeDecodeError:
        # As a final fallback, attempt gzip decompression even if headers/magic were missing.
        logger.info("UTF-8 decode failed; attempting gzip fallback.")
        raw_body = _try_decompress(raw_body)
        try:
            text = raw_body.decode("utf-8")
        except UnicodeDecodeError as exc:
            raise HTTPException(status_code=400, detail=f"Invalid UTF-8 payload: {exc}") from exc

    try:
        payload = json.loads(text)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail=f"Invalid JSON payload: {exc}") from exc

    timestamp = dt.datetime.utcnow().strftime("%Y%m%dT%H%M%S%fZ")
    output_path = OUTPUT_DIR / f"metrics_{timestamp}.json"

    try:
        output_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    except OSError as exc:
        logger.exception("Failed to write payload to disk")
        raise HTTPException(status_code=500, detail=f"Failed to persist payload: {exc}") from exc

    try:
        relative_path = output_path.relative_to(Path.cwd())
    except ValueError:
        relative_path = output_path

    meta = {
        "saved_to": str(relative_path),
        "metrics_version": payload.get("metrics_version"),
        "app_version": payload.get("app_version"),
        "authorization_header_present": authorization is not None,
    }

    logger.info("Stored metrics payload at %s (app_version=%s)", relative_path, payload.get("app_version"))
    return {"success": True, "meta": meta}


@app.get("/api/metrics/ingest/health")
async def health_check() -> dict[str, str]:
    """Simple health probe."""
    return {"status": "ok", "stored_files": str(len(list(OUTPUT_DIR.glob('metrics_*.json'))))}
