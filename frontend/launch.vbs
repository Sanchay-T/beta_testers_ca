Set oShell = CreateObject("WScript.Shell")
oShell.Run "cmd /k title MyElectronApp & cd /d C:\Users\admin\Desktop\CA-Offline\frontend & npm run electron", 1, False