# Cyphersol Devices API – Integration Guide

Last verified: 2025-09-06

## Overview

This guide documents two public endpoints exposed by Cyphersol for checking a user by email and registering a device against that user.

- Base URL: `https://cyphersol.co.in/api`
- Auth: None observed (public endpoints). Prefer server-side integration.
- Formats: Accepts `application/json`, `application/x-www-form-urlencoded`, `multipart/form-data`.
- CORS: Not confirmed. If integrating from a browser, you may need a server-side proxy.

## Quick Start

1) Call `GET /check-user/?email=...` to verify the user exists.
2) If the user exists, gather device metadata (UUID, hostname, username, MAC, Windows SID, mode).
3) `POST /devices/add/` with the email and device object.
4) Handle `201 Created` as success; handle `400 Bad Request` for validation or unknown email.

---

## Endpoint: Check User

- Method: `GET`
- URL: `/check-user/?email={email}`
- Purpose: Determine whether a user exists for the given email.

Request

```
GET https://cyphersol.co.in/api/check-user/?email=user@example.com
```

Successful Response (200)

```json
{
  "status": "success",
  "user_exists": true
}
```

If the user does not exist, `user_exists` is `false`:

```json
{
  "status": "success",
  "user_exists": false
}
```

Notes

- No errors were observed for malformed emails; the API simply returns `user_exists: false` for unknown users.

---

## Endpoint: Add Device

- Method: `POST` (only `POST` and `OPTIONS` allowed)
- URL: `/devices/add/`
- Purpose: Create a device record associated with a user’s email.

Accepted content types

- `application/json` (recommended)
- `application/x-www-form-urlencoded`
- `multipart/form-data`

Request Body (JSON)

```json
{
  "email": "user@example.com",
  "device": {
    "uuid": "string (required)",
    "hostname": "string (required)",
    "username": "string (required)",
    "mac_address": "string (required)",
    "windows_user_sid": "string (required)",
    "detected_mode": "scan | unscan | hybrid (optional)"
  }
}
```

Example Request

```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "device": {
      "uuid": "abc-123",
      "hostname": "PC-01",
      "username": "john",
      "mac_address": "00:11:22:33:44:55",
      "windows_user_sid": "S-1-5-21-...",
      "detected_mode": "scan"
    }
  }' \
  https://cyphersol.co.in/api/devices/add/
```

Successful Response (201)

The API returns the created device object (without the `email`):

```json
{
  "uuid": "abc-123",
  "hostname": "PC-01",
  "username": "john",
  "mac_address": "00:11:22:33:44:55",
  "windows_user_sid": "S-1-5-21-...",
  "detected_mode": "scan"
}
```

Validation Errors (400)

- Missing fields:

```json
{
  "email": ["This field is required."],
  "device": ["This field is required."]
}
```

- Invalid choice (example where `detected_mode` is not one of the allowed values):

```json
{
  "device": {
    "detected_mode": ["\"foo\" is not a valid choice."]
  }
}
```

- Non-existent email:

```json
[
  "User with this email does not exist."
]
```

Method Not Allowed (405)

```json
{"detail": "Method \"GET\" not allowed."}
```

Observed Behavior

- Duplicate `uuid` submissions for the same email currently return `201 Created` again (no uniqueness enforcement observed). Clients should deduplicate on the client side if idempotency matters.
- No authentication is required by the endpoint as observed. Treat the API as public write-enabled and keep credentials server-side.

---

## Recommended Integration Flow

1) Verify the user
   - Call `GET /check-user/?email=...`.
   - If `user_exists` is `false`, prompt the user to register in the Cyphersol system first.

2) Collect device metadata
   - `uuid`: Stable device identifier (e.g., hardware UUID).
   - `hostname`: Machine name.
   - `username`: Current OS username.
   - `mac_address`: Primary NIC MAC address.
   - `windows_user_sid`: Windows account SID (on Windows). On non-Windows platforms, coordinate with the backend on expected value.
   - `detected_mode`: One of `scan`, `unscan`, `hybrid`.

3) Submit device
   - `POST /devices/add/` with the schema above.
   - Treat `201` as success.

4) Handle errors
   - `400` with a JSON object: field validation issues.
   - `400` with a JSON array containing `"User with this email does not exist."`: the email is not recognized.
   - Retry transient failures with backoff (e.g., 3 attempts: 1s, 2s, 4s).

5) Idempotency strategy
   - The API does not appear to reject duplicate `uuid`s; repeated POSTs may create multiple entries or overwrite silently (server behavior unknown). Ensure your client only submits once per device install, or adds client-side deduplication.

6) Security & deployment
   - Because the endpoint appears public, avoid calling it directly from untrusted clients (browsers). Prefer a backend service to hold any sensitive logic and to avoid CORS issues.

---

## Code Examples

### cURL

```bash
curl "https://cyphersol.co.in/api/check-user/?email=user@example.com"

curl -X POST -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "device": {
      "uuid": "abc-123",
      "hostname": "PC-01",
      "username": "john",
      "mac_address": "00:11:22:33:44:55",
      "windows_user_sid": "S-1-5-21-...",
      "detected_mode": "scan"
    }
  }' \
  https://cyphersol.co.in/api/devices/add/
```

### JavaScript (node or server-side)

```js
import fetch from 'node-fetch';

const BASE = 'https://cyphersol.co.in/api';

export async function checkUser(email) {
  const res = await fetch(`${BASE}/check-user/?email=${encodeURIComponent(email)}`);
  if (!res.ok) throw new Error(`check-user failed: ${res.status}`);
  return res.json();
}

export async function addDevice(email, device) {
  const res = await fetch(`${BASE}/devices/add/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, device })
  });
  if (res.status === 201) return res.json();
  const err = await res.json().catch(() => ({}));
  throw new Error(`addDevice failed (${res.status}): ${JSON.stringify(err)}`);
}
```

### Python (requests)

```python
import requests

BASE = 'https://cyphersol.co.in/api'

def check_user(email: str) -> dict:
  r = requests.get(f"{BASE}/check-user/", params={"email": email}, timeout=10)
  r.raise_for_status()
  return r.json()

def add_device(email: str, device: dict) -> dict:
  r = requests.post(f"{BASE}/devices/add/", json={"email": email, "device": device}, timeout=10)
  if r.status_code == 201:
    return r.json()
  raise requests.HTTPError(f"add_device failed: {r.status_code} {r.text}")
```

### PowerShell (Windows)

```powershell
$Base = 'https://cyphersol.co.in/api'

function Test-UserExists($Email) {
  $resp = Invoke-RestMethod -Method GET -Uri "$Base/check-user/?email=$([uri]::EscapeDataString($Email))"
  return $resp.user_exists -eq $true
}

function Add-Device($Email, $Device) {
  $body = @{ email = $Email; device = $Device } | ConvertTo-Json -Depth 3
  $resp = Invoke-RestMethod -Method POST -Uri "$Base/devices/add/" -ContentType 'application/json' -Body $body -SkipHttpErrorCheck
  return $resp
}
```

---

## Troubleshooting

- 400 with field messages: Ensure required fields are present and `detected_mode` is one of `scan`, `unscan`, `hybrid`.
- 400 array with "User with this email does not exist.": Verify the user via `check-user` before posting.
- 405 on GET to `/devices/add/`: Only `POST` is allowed.
- CORS errors in browsers: Use a backend proxy if ACAO headers are not present for your origin.

## Notes

- These observations are from live probing on 2025-09-06 and may change if the API is updated.

