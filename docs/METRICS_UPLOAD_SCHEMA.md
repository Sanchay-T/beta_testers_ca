# METRICS UPLOAD SCHEMA – v1.0

This specification defines the JSON payload the Electron app sends to the Django metrics endpoint. All personally identifiable values must be hashed with SHA256 before transmission. Timestamps are ISO-8601 strings in UTC.

## Top-Level Shape

```jsonc
{
  "metrics_version": "v1.0",
  "app_version": "2.3.100",
  "exported_at": "2025-10-27T10:15:32.123Z",
  "device": { ... },
  "license": { ... },
  "user": { ... },
  "usage": { ... },
  "failed_pdfs": [ ... ],
  "activity_window": { ... },
  "meta": { ... }
}
```

### `device`
| Field | Type | Notes |
|-------|------|-------|
| `device_id_hash` | string | SHA256 hash of Windows SID, fallback to hashed hostname. |
| `hostname` | string | Actual hostname (considered non-sensitive). |
| `os_platform` | string | e.g., `Windows_NT`. |
| `os_release` | string | e.g., `10.0.22631`. |
| `architecture` | string | e.g., `x64`. |
| `total_ram_gb` | number | Rounded to one decimal. |
| `cpu_model` | string | Trimmed to 120 chars. |
| `compatibility_mode` | string | `SCAN` / `UNSCAN` / `HYBRID` / `UNKNOWN`. |

### `license`
| Field | Type | Notes |
|-------|------|-------|
| `license_key_hash` | string | SHA256 hash. |
| `license_type` | string | `DIRECT` / `NETWORK_FLOATING` / `UNKNOWN`. |
| `license_expiry` | string | ISO timestamp in UTC. |
| `max_users` | number | Defaults to 0. |
| `max_statements` | number | Defaults to 0. |

### `user`
| Field | Type | Notes |
|-------|------|-------|
| `email_hash` | string | SHA256 hash of lower-cased email. |
| `role` | string | e.g., `CA`, `Admin`. |
| `date_joined` | string | ISO timestamp derived from SQLite. |
| `last_login` | string | ISO timestamp; null allowed. |

### `usage`
| Field | Type | Notes |
|-------|------|-------|
| `total_cases` | number | Count from `cases` table where `deleted = 0`. |
| `total_statements_processed` | number | Count of rows in `statements`. |
| `total_statements_failed` | number | Count of rows in `failed_statements`. |
| `success_rate_percent` | number | `(processed - failed) / processed * 100`, 2 decimals. |
| `distinct_banks` | number | Unique `bank_name` in `statements`. |
| `total_transactions` | number | Count in `transactions`. |
| `reports_generated` | number | Count in `summary`. |
| `tally_exports` | number | Count in `tally_voucher`. |

### `failed_pdfs[]`
| Field | Type | Notes |
|-------|------|-------|
| `file_name` | string | Basename only. |
| `bank_type` | string | From DB column. |
| `error_code` | string | Null allowed. |
| `error_message` | string | Truncated to 500 chars. |
| `timestamp` | string | ISO timestamp. |
| `system_context` | object | `ram_gb` (number), `cpu_percent` (number) if available. |

### `activity_window`
| Field | Type | Notes |
|-------|------|-------|
| `first_activity` | string | Min of `created_at` in `statements`. |
| `last_activity` | string | Max of `created_at` in `statements`. |

### `meta`
| Field | Type | Notes |
|-------|------|-------|
| `export_trigger` | string | `login`, `manual`, `schedule`, `shutdown`. |
| `queue_depth` | number | Pending payload count before this upload. |
| `upload_attempts` | number | Attempts made for this payload. |

## Hashing Rules
- Convert strings to UTF-8, lower-case where applicable (email, license key).
- Combine value with salt from `process.env.METRICS_HASH_SALT` (fallback: `cypheredge`) before hashing.
- Use `crypto.createHash('sha256').update(value + salt).digest('hex')`.
