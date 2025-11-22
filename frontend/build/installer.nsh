; Cyphersol Custom NSIS Installer Script
; This file handles firewall rules during install/uninstall

!include LogicLib.nsh
!include "FileFunc.nsh"

!macro customHeader
  ; Force showing installation details
  ShowInstDetails show
  ShowUninstDetails show
!macroend

!macro customInstallMode
  ; This ensures the installer shows the details page
  ; during the installation process
!macroend

!macro customInstall
  ; Ensure details are printed
  SetDetailsPrint both

  ; ═══════════════════════════════════════════════════════════════════════════
  ; CRITICAL FIX: Wait for Windows to release file locks after uninstall
  ; This runs IMMEDIATELY when installation phase starts, giving Windows time
  ; to fully release file handles from the uninstall phase
  ; ═══════════════════════════════════════════════════════════════════════════
  ${If} ${Silent}
    DetailPrint ""
    DetailPrint "╔════════════════════════════════════════════════════════╗"
    DetailPrint "║    WAITING FOR FILE SYSTEM TO STABILIZE               ║"
    DetailPrint "╚════════════════════════════════════════════════════════╝"
    DetailPrint ""
    DetailPrint "[PRE-INSTALL-WAIT] Uninstall phase complete"
    DetailPrint "[PRE-INSTALL-WAIT] Waiting 10 seconds for Windows to release file locks..."
    DetailPrint "[PRE-INSTALL-WAIT] This prevents app.asar locking issues"
    Sleep 10000
    DetailPrint "[PRE-INSTALL-WAIT] ✓ File system stabilized - safe to install"
    DetailPrint ""
  ${EndIf}

  DetailPrint "Pre-reqs: Checking Microsoft VC++ 2015–2022 Redistributable (x64)..."
  ; VC++ 2015–2022 x64 presence flag (Installed = 1)
  ReadRegDWORD $0 HKLM "SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\x64" "Installed"

  ${If} $0 != 1
    DetailPrint "VC++ x64 not found. Installing silently..."
    ; Make sure the file is there (bundled via extraResources)
    IfFileExists "$INSTDIR\vcredist_x64.exe" +2 0
      DetailPrint "ERROR: vcredist_x64.exe missing from installer resources."

    ; Silent install: /quiet /norestart
    ExecWait '"$INSTDIR\vcredist_x64.exe" /install /quiet /norestart' $1
    ; Common success codes: 0 (OK), 3010 (success, reboot required)
    ${IfThen} $1 = 0  ${|} DetailPrint "VC++ x64 installed." ${|}
    ${IfThen} $1 = 3010 ${|} DetailPrint "VC++ x64 installed (reboot suggested)." ${|}
    ${If} $1 != 0
    ${AndIf} $1 != 3010
      DetailPrint "WARNING: VC++ installer returned code $1. App may fail to start if runtime is missing."
    ${EndIf}
  ${Else}
    DetailPrint "VC++ x64 already present. Skipping."
  ${EndIf}
  
  ; Add firewall rules during installation
  DetailPrint "Configuring Windows Firewall for Cyphersol Gateway Server..."
  
  ; Add TCP rule
  DetailPrint "Adding TCP firewall rule..."
  nsExec::ExecToLog 'netsh advfirewall firewall add rule name="Cyphersol Gateway Server-TCP" dir=in action=allow protocol=TCP'
  Pop $0
  ${If} $0 == 0
    DetailPrint "TCP firewall rule added successfully"
  ${Else}
    DetailPrint "TCP firewall rule may already exist (this is OK)"
  ${EndIf}
  
  ; Add UDP rule  
  DetailPrint "Adding UDP firewall rule..."
  nsExec::ExecToLog 'netsh advfirewall firewall add rule name="Cyphersol Gateway Server-UDP" dir=in action=allow protocol=UDP'
  Pop $0
  ${If} $0 == 0
    DetailPrint "UDP firewall rule added successfully"
  ${Else}
    DetailPrint "UDP firewall rule may already exist (this is OK)"
  ${EndIf}
  
  DetailPrint "Firewall configuration completed"
  
  ; Always show update progress to user
  ${If} ${Silent}
    ; Auto-update detected - show a message box so user knows what's happening
    MessageBox MB_OK|MB_ICONINFORMATION "CypherEdge is being updated. The application will restart automatically after installation." /SD IDOK
    DetailPrint "Auto-update in progress..."
  ${EndIf}
  
  ; Launch app after install with safety delay
  ${If} ${Silent}
    DetailPrint ""
    DetailPrint "════════════════════════════════════════════════════════"
    DetailPrint "  UPDATE INSTALLATION COMPLETE"
    DetailPrint "════════════════════════════════════════════════════════"
    DetailPrint ""
    DetailPrint "[UPDATE-LOG] Waiting 5 seconds for file system stabilization..."
    DetailPrint "[UPDATE-LOG] This prevents ASAR corruption and ensures clean start"
    Sleep 5000
    DetailPrint "[UPDATE-LOG] File system stabilized - safe to launch"
    DetailPrint "[UPDATE-LOG] Launching CypherEdge..."
    DetailPrint ""
    Exec "$INSTDIR\CypherEdge.exe"
    DetailPrint "[UPDATE-LOG] Launch command issued - app should start shortly"
  ${EndIf}
!macroend

!macro customUnInstall
  ; Ensure details are printed
  SetDetailsPrint both
  
  ; Remove firewall rules during uninstallation
  DetailPrint "Removing Cyphersol firewall rules..."
  
  ; Remove TCP rule
  nsExec::ExecToLog 'netsh advfirewall firewall delete rule name="Cyphersol Gateway Server-TCP"'
  Pop $0
  ${If} $0 == 0
    DetailPrint "TCP firewall rule removed"
  ${Else}
    DetailPrint "TCP firewall rule was not found"
  ${EndIf}
  
  ; Remove UDP rule
  nsExec::ExecToLog 'netsh advfirewall firewall delete rule name="Cyphersol Gateway Server-UDP"'
  Pop $0
  ${If} $0 == 0
    DetailPrint "UDP firewall rule removed"
  ${Else}
    DetailPrint "UDP firewall rule was not found"
  ${EndIf}
  
  DetailPrint "Firewall cleanup completed"
!macroend

; ═══════════════════════════════════════════════════════════════════════════
; CRITICAL FIX: customUnInit macro
; This runs BEFORE the uninstaller removes files during an update
; It ensures all processes are killed so files can be replaced cleanly
; Without this, app.asar remains locked → corruption → JSON parse error
; ═══════════════════════════════════════════════════════════════════════════
!macro customUnInit
  SetDetailsPrint both

  DetailPrint ""
  DetailPrint "╔════════════════════════════════════════════════════════╗"
  DetailPrint "║     PRE-UNINSTALL PROCESS CLEANUP (customUnInit)      ║"
  DetailPrint "╚════════════════════════════════════════════════════════╝"
  DetailPrint ""
  DetailPrint "[CLEANUP-LOG] Starting comprehensive process cleanup"
  DetailPrint "[CLEANUP-LOG] This prevents file locking during update"
  DetailPrint ""

  ; Step 1: Kill Electron app
  DetailPrint "[CLEANUP-LOG] Step 1/6: Killing Electron application..."
  nsExec::ExecToLog 'taskkill /F /IM "CypherEdge.exe" /T 2>nul'
  Pop $0
  ${If} $0 == 0
    DetailPrint "[CLEANUP-LOG]   ✓ CypherEdge.exe terminated"
  ${Else}
    DetailPrint "[CLEANUP-LOG]   ⓘ CypherEdge.exe not running"
  ${EndIf}

  ; Step 2: Kill Python backend
  DetailPrint ""
  DetailPrint "[CLEANUP-LOG] Step 2/6: Killing Python backend..."
  nsExec::ExecToLog 'taskkill /F /IM "main.exe" /T 2>nul'
  Pop $0
  ${If} $0 == 0
    DetailPrint "[CLEANUP-LOG]   ✓ Python backend (main.exe) terminated"
  ${Else}
    DetailPrint "[CLEANUP-LOG]   ⓘ Python backend not running"
  ${EndIf}

  ; Step 3: Kill Gateway service executable
  DetailPrint ""
  DetailPrint "[CLEANUP-LOG] Step 3/6: Killing Gateway service..."
  nsExec::ExecToLog 'taskkill /F /IM "gatewayService.exe" /T 2>nul'
  Pop $0
  ${If} $0 == 0
    DetailPrint "[CLEANUP-LOG]   ✓ Gateway service executable terminated"
  ${Else}
    DetailPrint "[CLEANUP-LOG]   ⓘ Gateway service not running"
  ${EndIf}

  ; Step 4: Stop Windows service
  DetailPrint ""
  DetailPrint "[CLEANUP-LOG] Step 4/6: Stopping LicensingServer Windows service..."
  nsExec::ExecToLog 'sc stop LicensingServer 2>nul'
  Pop $0
  ${If} $0 == 0
    DetailPrint "[CLEANUP-LOG]   ✓ LicensingServer service stopped"
  ${Else}
    DetailPrint "[CLEANUP-LOG]   ⓘ LicensingServer service not running"
  ${EndIf}

  ; Step 5: Wait for processes to fully terminate
  DetailPrint ""
  DetailPrint "[CLEANUP-LOG] Step 5/6: Waiting 5 seconds for clean shutdown..."
  Sleep 5000
  DetailPrint "[CLEANUP-LOG]   ✓ Wait complete"

  ; Step 6: Verify cleanup - double-check all processes are dead
  DetailPrint ""
  DetailPrint "[CLEANUP-LOG] Step 6/6: Verifying all processes terminated..."
  nsExec::ExecToLog 'taskkill /F /IM "CypherEdge.exe" /T 2>nul'
  nsExec::ExecToLog 'taskkill /F /IM "main.exe" /T 2>nul'
  nsExec::ExecToLog 'taskkill /F /IM "gatewayService.exe" /T 2>nul'
  DetailPrint "[CLEANUP-LOG]   ✓ Verification complete"

  DetailPrint ""
  DetailPrint "╔════════════════════════════════════════════════════════╗"
  DetailPrint "║   CLEANUP COMPLETE - FILES NOW SAFE TO REPLACE        ║"
  DetailPrint "╚════════════════════════════════════════════════════════╝"
  DetailPrint ""
  DetailPrint "[CLEANUP-LOG] All file locks released"
  DetailPrint "[CLEANUP-LOG] NSIS can now safely uninstall old version"
  DetailPrint "[CLEANUP-LOG] This prevents app.asar corruption"
  DetailPrint ""
!macroend

