# hook-paddle-path.py
import os, sys
base = getattr(sys, "_MEIPASS", None)
if base:
    for rel in ("paddle\\libs", "paddle\\base", "paddle"):
        d = os.path.join(base, rel)
        if os.path.isdir(d):
            os.environ["PATH"] = d + os.pathsep + os.environ.get("PATH", "")
os.environ.setdefault("PADDLE_WITH_CUDA", "0")
# If you ever see OpenMP duplicate errors, uncomment:
# os.environ.setdefault("KMP_DUPLICATE_LIB_OK", "TRUE")
