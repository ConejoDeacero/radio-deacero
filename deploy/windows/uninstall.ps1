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
Start-Sleep -Seconds 1

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
