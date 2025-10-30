"""
Keep Active Script - Presses a key every 3.5 minutes to prevent system idle
Press Ctrl+C to stop the script
"""
import time
import pyautogui
from datetime import datetime

# Configuration
INTERVAL_MINUTES = 1  # Time between key presses
INTERVAL_SECONDS = INTERVAL_MINUTES * 60  # Convert to seconds
KEY_TO_PRESS = 'shift'  # Key to press (shift is non-intrusive)

print("=" * 60)
print("KEEP ACTIVE SCRIPT STARTED")
print("=" * 60)
print(f"Interval: {INTERVAL_MINUTES} minutes ({INTERVAL_SECONDS} seconds)")
print(f"Key to press: {KEY_TO_PRESS.upper()}")
print(f"Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
print(f"Press Ctrl+C to stop")
print("=" * 60)
print()

# Disable pyautogui failsafe (optional - remove if you want failsafe)
pyautogui.FAILSAFE = True  # Move mouse to top-left corner to emergency stop

try:
    counter = 1
    while True:
        # Wait for the specified interval
        print(f"Waiting {INTERVAL_MINUTES} minutes until next key press...")
        time.sleep(INTERVAL_SECONDS)

        # Press the key
        pyautogui.press(KEY_TO_PRESS)

        # Log the action
        current_time = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        print(f"[{counter}] Key pressed at {current_time}")

        counter += 1

except KeyboardInterrupt:
    print("\n" + "=" * 60)
    print("SCRIPT STOPPED BY USER")
    print(f"Total key presses: {counter - 1}")
    print(f"Stopped at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)
except Exception as e:
    print(f"\nERROR: {e}")
    print("Make sure 'pyautogui' is installed: pip install pyautogui")
