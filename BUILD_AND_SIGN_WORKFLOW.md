# CypherEdge - Build, Sign, and Deploy Workflow

## 🔴 CRITICAL: SHA512 Checksum Mismatch Fix

### Problem
When you sign the `.exe` file with Thales code signing, it **changes the file's hash**. Electron-builder generates `latest.yml` with the **pre-signing hash**, causing auto-updater to fail with:

```
Error: sha512 checksum mismatch, expected [old hash], got [new hash]
```

### Root Cause
```
Build → latest.yml (hash A) → Sign .exe → .exe hash changes to B → Upload both
Auto-updater downloads .exe (hash B) but latest.yml says hash A → MISMATCH ERROR
```

---

## ✅ CORRECT BUILD & DEPLOY WORKFLOW

### Step 1: Build the Application
```bash
cd frontend
npm run build
```

This creates:
- `dist/CypherEdge-Setup-2.3.XXX.exe` (unsigned)
- `dist/latest.yml` (with pre-signing SHA512)

### Step 2: Sign the Executable with Thales
**IMPORTANT:** Use your Thales signing process to sign the `.exe` file

```bash
# Example (adjust to your signing process):
cd dist
[Your Thales signing command here]
# e.g., signtool sign /f cert.pfx /p password CypherEdge-Setup-2.3.XXX.exe
```

After signing, the `.exe` file is modified, making `latest.yml` invalid.

### Step 3: Regenerate latest.yml (NEW STEP!)
```bash
cd ..  # Go back to frontend directory
npm run regenerate:yml
```

**What this does:**
- Reads the **signed** `.exe` file from `dist/`
- Calculates the **correct SHA512 hash** of the signed file
- Overwrites `latest.yml` with the updated hash
- Verifies everything is correct

**Output:**
```
=================================================================
  CypherEdge - Regenerate latest.yml After Code Signing
=================================================================

📦 Found: CypherEdge-Setup-2.3.600.exe (287.3 MB)
🔒 Calculating SHA512 hash of signed executable...
✅ SHA512: UHcadBXs3UX+YwT3Andy2bnR+4d0...
📌 Version: 2.3.600
✅ latest.yml regenerated with correct SHA512 hash

Verification:
  File: D:\CA\beta_testers_ca\frontend\dist\latest.yml
  Version: 2.3.600
  SHA512: [correct hash of signed file]
  Size: 301234567 bytes (287.3 MB)
  Date: 2025-11-21T08:16:23.456Z

=================================================================
  ✅ Ready for upload to DigitalOcean Spaces
=================================================================

Next step: npm run upload:spaces
```

### Step 4: Upload to DigitalOcean Spaces
```bash
npm run upload:spaces
```

This uploads:
- `CypherEdge-Setup-2.3.XXX.exe` (signed, with hash B)
- `latest.yml` (with **correct** hash B)

---

## 📋 COMPLETE WORKFLOW CHECKLIST

```
☐ 1. Build application
    └─ npm run build

☐ 2. Sign the .exe file with Thales
    └─ [Your signing process]

☐ 3. Regenerate latest.yml (CRITICAL!)
    └─ npm run regenerate:yml

☐ 4. Verify latest.yml has correct hash
    └─ Check console output

☐ 5. Upload to DigitalOcean Spaces
    └─ npm run upload:spaces

☐ 6. Verify CDN accessibility
    └─ Check URL: https://cypheredge-exe-prod.blr1.cdn.digitaloceanspaces.com/releases/windows/latest.yml
```

---

## 🔍 VERIFICATION

### Verify SHA512 Matches
```bash
# Windows PowerShell
cd frontend/dist
certutil -hashfile CypherEdge-Setup-2.3.XXX.exe SHA512

# Compare with latest.yml
type latest.yml
```

Both should show the **same SHA512 hash** (in Base64 format).

### Verify Auto-Updater Works
1. Install an older version of CypherEdge
2. Launch the app
3. It should detect the new version
4. Download should complete without "sha512 mismatch" error

---

## 🚨 TROUBLESHOOTING

### Problem: Still getting SHA512 mismatch
**Solution:** Make sure you ran `npm run regenerate:yml` **AFTER** signing

### Problem: latest.yml not updated
**Solution:** Check that `js-yaml` is installed:
```bash
cd frontend
npm install --save-dev js-yaml
```

### Problem: Script can't find .exe file
**Solution:** Make sure you're in the `frontend/` directory when running scripts

---

## 📁 FILES INVOLVED

```
frontend/
├── package.json                          # Contains "regenerate:yml" script
├── dist/
│   ├── CypherEdge-Setup-2.3.XXX.exe     # Built & signed executable
│   └── latest.yml                        # Auto-update manifest (regenerated after signing)
└── scripts/
    └── regenerate-latest-yml.js          # SHA512 recalculation script (NEW)
```

---

## 🎯 WHY THIS WORKS

**Before (Broken):**
```
Build creates: .exe (unsigned, hash A) + latest.yml (hash A)
Sign modifies: .exe (signed, hash B)
Upload: .exe (hash B) + latest.yml (hash A) ← MISMATCH!
```

**After (Fixed):**
```
Build creates: .exe (unsigned, hash A) + latest.yml (hash A)
Sign modifies: .exe (signed, hash B)
Regenerate: latest.yml updated to (hash B)
Upload: .exe (hash B) + latest.yml (hash B) ← MATCHES! ✅
```

---

## 💡 AUTOMATION TIP

You can combine signing and regeneration into one script if you automate your Thales signing process.

**Example custom script:**
```json
// package.json
"scripts": {
  "build:signed": "npm run build && [your-sign-command] && npm run regenerate:yml"
}
```

---

**Questions or Issues?**
Contact: sanchaythalnerkar@gmail.com
