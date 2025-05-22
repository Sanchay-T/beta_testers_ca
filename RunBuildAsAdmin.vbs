Set UAC = CreateObject("Shell.Application")
Set WshShell = CreateObject("WScript.Shell")
Set FSO = CreateObject("Scripting.FileSystemObject")

' Get the script directory
scriptDir = FSO.GetParentFolderName(WScript.ScriptFullName)
' Full path to the batch file
batchFile = scriptDir & "\build.bat"

' Check if the batch file exists
If FSO.FileExists(batchFile) Then
    ' Run the batch file as administrator
    UAC.ShellExecute "cmd.exe", "/c " & batchFile, "", "runas", 1
Else
    MsgBox "Error: build.bat not found in the same directory as this script.", vbCritical, "File Not Found"
End If 