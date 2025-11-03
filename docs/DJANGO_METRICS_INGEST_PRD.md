# DJANGO METRICS INGEST – TECHNICAL PRD

## Current State
- Electron app now exports a rich JSON payload (`metrics_version: v1.0`) containing:
  - Hashed + plain identifiers (email, license key)
  - Device specs, app version, compatibility mode
  - Usage stats (case totals, status breakdowns, statement counts)
  - Detailed failed-PDF entries (case id/name, file, bank, error message)
- Upload triggers: login, logout, daily interval, shutdown; automatic retries via `%APPDATA%\Electron\metrics-queue.json`.
- Mock FastAPI server verifies the contract; latest sample payload: `backend/metrics_ingest/metrics_20251029T123507716737Z.json`.

## Goal
Stand up a Django-based ingest service within ~2 weeks (two sprints) that:
1. Accepts the Electron payload reliably and securely.
2. Stores it durably for reporting/analysis.
3. Provides at least basic admin visibility, with a path to dashboards/APIs later.

## Functional Requirements
1. **Endpoint**: `POST /api/metrics/ingest/`
   - Accept gzip-compressed or raw JSON bodies.
   - Validate required fields; return `{success: true, meta: {...}}` on success.
   - Idempotent: duplicates (same `device_id_hash` + `exported_at`) should not create new records.
2. **Authentication**
   - Phase 1: bearer token or static API key.
   - Phase 2: migrate to signed JWT or HMAC.
3. **Persistence**
   - Store raw payload (JSONB/JSONField) plus denormalized columns for fast queries.
   - Track timestamps: `exported_at`, `received_at`.
   - Capture identifiers (hashed email/device), plain email/license (encrypted if needed).
4. **Validation**
   - Required: `metrics_version`, `app_version`, `exported_at`, `device.device_id_hash`, `user.email_hash`, `usage.total_cases`.
   - Warn/log if optional fields missing (`user.email`, `license.license_key_plain`, `failed_pdfs`).
   - Reject malformed timestamps, negative counters, unsupported `metrics_version`.
5. **Monitoring & Logging**
   - Structured logs for every ingest (success/failure).
   - Metrics (Prometheus/Sentry) for request rate, error rate, duplicates, latency.
6. **Admin & Support Tools**
   - Django admin model to browse payloads, filter by email hash, download raw JSON.
   - Optional REST endpoints for internal tools (e.g., latest payload by email hash).

## Data Model (Phase 1)
`MetricsPayload`
- `id (UUID)`
- `device_id_hash (char(64))`
- `email_hash (char(64))`
- `email_plain (varchar, nullable / encrypted)`
- `license_key_hash (char(64))`
- `license_key_plain (varchar, nullable / encrypted)`
- `app_version (varchar)`
- `metrics_version (varchar)`
- `exported_at (datetime)`
- `received_at (datetime, auto_now_add)`
- `raw_payload (jsonb)`
- Usage denorm columns:
  - `total_cases`, `total_cases_failed`, `total_cases_pending`, `total_cases_succeeded`
  - `total_statements_processed`, `total_statements_failed`, `failed_pdf_count`
  - `case_first_created_at`, `case_last_created_at`
- `duplicate_of (FK to MetricsPayload, nullable)` – set when dedupe kicks in.

Optional Phase 1.5: `FailedPdfDetail`
- `payload (FK MetricsPayload)`
- `case_id (int, nullable)`
- `case_name (varchar)`
- `file_name (varchar)`
- `bank_type (varchar)`
- `error_message (text)`
- `error_code (varchar)`
- `timestamp (datetime, nullable)`
- `raw_columns (jsonb)`
- `system_ram_gb (numeric)`, `system_cpu_percent (numeric)`

## API Contract
**Request**
```
POST /api/metrics/ingest/
Headers:
  Content-Type: application/json
  Content-Encoding: gzip   # when compressed
  x-api-key: <metrics test key>   # optional in prod, required for staging smoke tests
  Authorization: Bearer <token>

Body: <payload from docs/METRICS_UPLOAD_SCHEMA.md>
```

**Response – success**
```json
{
  "success": true,
  "meta": {
    "id": "b3f1c762-73f9-4178-ae86-2bdb41087dbd",
    "deduplicated": false,
    "received_at": "2025-10-29T12:35:09Z",
    "app_version": "33.4.11"
  }
}
```

**Response – duplicate**
```json
{
  "success": true,
  "meta": {
    "id": "existing-uuid",
    "deduplicated": true
  }
}
```

**Response – validation error**
```json
{
  "success": false,
  "error": "Missing user.email_hash"
}
```
HTTP 400.

**Response – auth error**: 401/403 with message.

## Processing Flow
1. Read request body (handle gzip).
2. Parse JSON and validate schema (use Pydantic/DRF serializer).
3. Compute dedupe key (`device_id_hash + exported_at`).
4. Upsert into `MetricsPayload`.
5. Optionally explode `failed_pdfs` into detail table.
6. Return response; log success or failure.

## Security & Compliance
- Protect endpoint with token/JWT; rotate regularly.
- Encrypt plain email/license key columns if compliance requires.
- Limit payload size (e.g., 1 MB) to prevent abuse.
- Log hashed identifiers only; avoid PII in app logs.

## Deployment & Ops
- Deploy as part of Django project or spin up a new service.
- Enable gunicorn/ASGI gzip middleware.
- Configure database migrations (JSONB/indices).
- Add Prometheus/Sentry hooks for observability.
- Automatic backups for metrics tables.

## Testing Strategy
1. Unit tests:
   - Gzip + plain JSON decoding.
   - Required field validation.
   - Dedupe logic.
   - Failed-PDF detail extraction.
2. Integration tests with captured payload (`backend/metrics_ingest/metrics_20251029T123507716737Z.json`).
3. Load test with expected volume (≥1k payloads/day, target 10k+).
4. Manual verification by pointing Electron to staging endpoint.

## Timeline
**Week 1**
1. Scaffold Django app / add new app module.
2. Define models, run migrations.
3. Implement ingest view (gzip handling, validation).
4. Add token auth and middleware.
5. Write unit tests & basic integration script.
6. Basic Django admin view + structured logging.

**Week 2**
1. Implement dedupe logic & duplicate tracking.
2. Optional: persist failed PDFs in child table.
3. Deploy to staging; run end-to-end test from Electron.
4. Add monitoring (Prometheus counters/Sentry).
5. Create ops documentation (env vars, deploy steps, troubleshooting).
6. Production deploy pending staging sign-off.

## Environment Variables
- `METRICS_AUTH_TOKEN` or `METRICS_JWT_SECRET`
- `METRICS_ALLOW_GZIP` (default true)
- `METRICS_MAX_BODY_SIZE` (default 1_048_576 bytes)
- Database credentials (`DATABASE_URL` or Django settings)
- `DJANGO_SETTINGS_MODULE` etc.

## Next Steps (Post-MVP)
- Aggregation API (e.g., per-license KPIs, failure trends).
- CEO-facing dashboard (Django admin custom pages or React SPA).
- Alerting (Slack/email when failure rate spikes or recent uploads missing).
- GDPR tooling (delete/redact payloads by email hash).

## References
- Electron payload schema: `docs/METRICS_UPLOAD_SCHEMA.md`
- Sample payload: `backend/metrics_ingest/metrics_20251029T123507716737Z.json`
- Electron upload cadence: `frontend/main.js` (`MetricsService` triggers)
