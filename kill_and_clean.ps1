$procs = Get-Process -Name 'CypherEdge-UAT' -ErrorAction SilentlyContinue
if ($procs) {
  $procs | Stop-Process -Force -PassThru
}
$path = 'C:\Users\sanch\AppData\Local\Programs\CypherEdge-UAT'
if (Test-Path $path) {
  Remove-Item -LiteralPath $path -Recurse -Force -ErrorAction SilentlyContinue
}
$path2 = 'C:\Users\sanch\AppData\Roaming\CypherEdge-UAT'
if (Test-Path $path2) {
  Remove-Item -LiteralPath $path2 -Recurse -Force -ErrorAction SilentlyContinue
}
