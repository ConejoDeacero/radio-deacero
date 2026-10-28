# uninstall.ps1 - quita DEACERO Play Lite de este equipo (paran los procesos, accesos de Inicio, regla de firewall y carpeta).
#   powershell -ExecutionPolicy Bypass -File deploy\windows\uninstall.ps1 [-KeepData]
param(
  [string]$InstallDir = (Join-Path $env:LOCALAPPDATA 'RadioDeacero'),
  [switch]$KeepData,   # conserva podcasts e historial (<InstallDir>\data)
  [string]$StartupDir = [Environment]::GetFolderPath('Startup')
)
$ErrorActionPreference = 'Continue'
function Say($m) { Write-Host "  $m" }

Say "Parando procesos de $InstallDir ..."
# Por el nombre de la carpeta + palabras propias (la ruta puede estar en forma corta o larga y no coincidir).
$leaf = Split-Path $InstallDir -Leaf
Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
  Where-Object { $_.ProcessId -ne $PID -and $_.CommandLine -and $_.CommandLine -like "*$leaf*" -and $_.Name -match 'powershell|node|msedge|chrome' -and ($_.CommandLine -match 'run-server|run-kiosk|server\.js|radio-kiosk-profile') } |
  ForEach-Object { try { Stop-Process -Id $_.ProcessId -Force -ErrorAction Stop } catch { } }
# Sin administrador no se pueden consultar procesos: se paran por el PID que guardan run-server/run-kiosk (ver install.ps1).
foreach ($n in @('run-server.pid', 'run-kiosk.pid')) {
  $f = Join-Path $InstallDir $n
  if (-not (Test-Path $f)) { continue }
  $pidNum = 0
  if (-not [int]::TryParse((Get-Content $f -Raw).Trim(), [ref]$pidNum)) { continue }
  $p = Get-Process -Id $pidNum -ErrorAction SilentlyContinue
  if ($p -and $pidNum -ne $PID -and $p.ProcessName -eq 'powershell' -and $p.StartTime -le (Get-Item $f).LastWriteTime.AddSeconds(5)) { & cmd /c "taskkill /F /T /PID $pidNum >nul 2>nul" }
}
Start-Sleep -Seconds 1

foreach ($t in @('RadioDeacero-Servidor', 'RadioDeacero-Pantalla')) {   # tareas de autorun.ps1 (si las hay)
  $null = schtasks /Query /TN $t 2>&1
  if ($LASTEXITCODE -eq 0) { $null = schtasks /Delete /TN $t /F 2>&1; Say "Tarea quitada: $t" }
}
foreach ($n in @('RadioDeacero-Servidor.lnk', 'RadioDeacero-Pantalla.lnk')) {
  $f = Join-Path $StartupDir $n
  if (Test-Path $f) { Remove-Item $f -Force; Say "Acceso quitado: $f" }
}

$admin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if ($admin) { Get-NetFirewallRule -DisplayName 'Radio Deacero' -ErrorAction SilentlyContinue | Remove-NetFirewallRule; Say 'Regla de firewall quitada.' }

if (Test-Path $InstallDir) {
  if ($KeepData) {
    Get-ChildItem $InstallDir -Force | Where-Object { $_.Name -ne 'data' } | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
    Say "Carpeta limpiada; se conservan los datos en $InstallDir\data"
  } else {
    Remove-Item $InstallDir -Recurse -Force -ErrorAction SilentlyContinue
    if (Test-Path $InstallDir) { Say "AVISO: no se pudo borrar todo $InstallDir (algun archivo en uso); reintenta tras cerrar sesion." } else { Say "Carpeta borrada: $InstallDir" }
  }
} else { Say 'No habia carpeta de instalacion.' }
Say 'Listo.'
