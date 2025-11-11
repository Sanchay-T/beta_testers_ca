param()

$paths = @(
  'C:\Users\sanch\AppData\Local\Programs\CypherEdge-UAT',
  'C:\Users\sanch\AppData\Roaming\CypherEdge-UAT'
)

Get-Process -Name 'CypherEdge-UAT' -ErrorAction SilentlyContinue | ForEach-Object {
  try {
    $_ | Stop-Process -Force -ErrorAction Stop
  } catch {}
}

foreach ($p in $paths) {
  if (Test-Path $p) {
    try {
      $acl = Get-Acl $p
      $user = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
      $rule = New-Object System.Security.AccessControl.FileSystemAccessRule($user,'FullControl','ContainerInherit,ObjectInherit','None','Allow')
      $acl.SetAccessRule($rule)
      Set-Acl -Path $p -AclObject $acl -ErrorAction SilentlyContinue
    } catch {}

    try {
      Remove-Item -LiteralPath $p -Recurse -Force -ErrorAction Stop
    } catch {}
  }
}
