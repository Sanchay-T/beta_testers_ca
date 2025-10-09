# Network Drive Access Solution for CA Professionals

## Problem
CA professionals using central server architecture (network shares) were unable to see network drives or mapped drives in the file selector dialog. This prevented them from accessing client files stored on their central server.

## Root Cause
This is a Windows security feature, not an application bug. When applications run with elevated privileges (UAC), they operate in a different security context than the standard user session. Mapped network drives are tied to the user's session and are not visible to elevated processes by default.

## Solutions Implemented

### 1. Enhanced File Dialog (Automatic)
- Added `noResolveAliases` property for better network shortcut handling
- Set default path to user's home directory for better network drive visibility
- Added multiple fallback paths for browsing

### 2. Network Access Button (Manual)
Added a "Network Access" button that provides:
- Option to enter network paths directly (UNC format: `\\server\share\folder`)
- Option to browse with enhanced network drive detection
- Clear instructions for different network path formats

### 3. Registry Fix (System-wide Solution)
For applications that must run with elevated privileges:

1. Open Registry Editor (regedit)
2. Navigate to: `HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System`
3. Create new DWORD (32-bit) value: `EnableLinkedConnections`
4. Set value to `1`
5. **Restart computer** (required)

This enables network drive visibility for all elevated applications.

## User Instructions

### For CA Firms Using Central Servers

1. **Primary Method**: Use the regular "Browse Files" button
2. **If network drives not visible**: Click "Network Access" button
3. **Enter network path directly**: Use formats like:
   - `\\server-name\shared-folder\client-files`
   - `Z:\client-files` (if drive is mapped)
   - `//server-name/shared-folder/client-files`

### Troubleshooting Network Access

1. **Verify network connection**: Ensure you can access the server in Windows Explorer
2. **Check permissions**: Make sure you have read access to the network location
3. **Try mapped drives**: If UNC paths don't work, map the network drive first
4. **Use IP addresses**: If server names don't resolve, try `\\192.168.1.100\share`

## Technical Implementation

### Files Modified
- `frontend/main.js`: Added `open-network-path-dialog` IPC handler
- `frontend/preload.js`: Exposed network dialog API
- `frontend/react-app/src/components/Elements/ReportForm.jsx`: Added Network Access button and handling

### New Features
- Network path input dialog with format examples
- Enhanced file dialog with better network drive support
- Error handling and user feedback for network access issues
- Multiple browsing fallback options

## Benefits
- Maintains existing workflow for local file access
- Provides alternative for network file access
- No system-level changes required for basic functionality
- Clear user guidance for different network scenarios
- Works with all common network sharing setups (SMB, mapped drives, etc.)

This solution ensures CA professionals can efficiently access client files regardless of their server setup while maintaining security and usability.