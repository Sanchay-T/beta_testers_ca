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
  
  ; Launch app after install
  ${If} ${Silent}
    DetailPrint "Launching CypherEdge after update..."
    Exec "$INSTDIR\CypherEdge.exe"
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

