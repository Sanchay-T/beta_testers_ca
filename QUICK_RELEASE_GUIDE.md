# 🚀 CypherEdge Quick Release Guide

## One-Time Issue: SHA512 Mismatch After Signing

Your current `.exe` file is **already signed** but `latest.yml` has the **old pre-signing hash**.

**Quick Fix (Do this NOW):**
```bash
cd frontend
npm run regenerate:yml
npm run upload:spaces
```

This will:
1. ✅ Calculate correct SHA512 of your **signed** `.exe`
2. ✅ Update `latest.yml` with the correct hash
3. ✅ Upload both files to DigitalOcean Spaces

---

## 📋 Future Releases - Correct Workflow

### Every Time You Release a New Version:

```bash
# 1. Build
cd frontend
npm run build

# 2. Sign the .exe with Thales (your existing process)
cd dist
[Your Thales signing command]
cd ..

# 3. Regenerate latest.yml (CRITICAL - DO NOT SKIP!)
npm run regenerate:yml

# 4. Upload to DigitalOcean
npm run upload:spaces
```

---

## ⚡ Quick Commands

| Step | Command | Description |
|------|---------|-------------|
| 1️⃣ Build | `npm run build` | Creates unsigned `.exe` and `latest.yml` |
| 2️⃣ Sign | _(Your Thales process)_ | Sign the `.exe` file |
| 3️⃣ **Regenerate** | `npm run regenerate:yml` | **Update SHA512 in latest.yml** |
| 4️⃣ Upload | `npm run upload:spaces` | Deploy to DigitalOcean Spaces |

---

## 🔍 Verification Checklist

After running `npm run regenerate:yml`, check:

✅ **Console Output:**
```
✅ SHA512: XFYrU7VthawXn27sL18kk1qnd6/fMyQ2kXg0WXX6y51o...
✅ latest.yml regenerated with correct SHA512 hash
```

✅ **File Updated:**
```bash
# Check that latest.yml was just modified:
cd dist
dir latest.yml  # Should show recent timestamp
```

---

## 🚨 Common Mistakes to Avoid

❌ **DON'T**: Upload without regenerating latest.yml after signing
✅ **DO**: Always run `npm run regenerate:yml` after signing

❌ **DON'T**: Forget to sign before regenerating
✅ **DO**: Sign first, then regenerate

❌ **DON'T**: Build → Upload → Sign (wrong order!)
✅ **DO**: Build → Sign → Regenerate → Upload

---

## 💡 Why This Happens

```
Electron-builder generates latest.yml BEFORE signing
↓
You sign the .exe (file changes)
↓
latest.yml still has old hash
↓
Auto-updater: "Hash mismatch!" ❌
```

**Solution:** Regenerate `latest.yml` after signing to capture the correct hash ✅

---

## 📞 Support

Issues? Contact: sanchaythalnerkar@gmail.com

---

**Remember:** `npm run regenerate:yml` after every signing! 🔐
