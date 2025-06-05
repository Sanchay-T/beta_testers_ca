; Cyphersol Custom NSIS Installer Script
; This file handles firewall rules during install/uninstall

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