# uninstall.ps1 - quita DEACERO Play Lite de este equipo (paran los procesos, accesos de Inicio, regla de firewall y carpeta).
#   powershell -ExecutionPolicy Bypass -File uninstall.ps1 [-KeepData]
# Si se instalo para todos los usuarios (C:\ProgramData\RadioDeacero) hay que ejecutarlo como administrador.
param(
  [string]$InstallDir = $(if (Test-Path "$env:ProgramData\RadioDeacero\config.json") { "$env:ProgramData\RadioDeacero" } else { Join-Path $env:LOCALAPPDATA 'RadioDeacero' }),
  [switch]$KeepData   # conserva podcasts e historial (<InstallDir>\data)
)
$ErrorActionPreference = 'Continue'
function Say($m) { Write-Host "  $m" }
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$admin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

Say "Parando procesos de $InstallDir ..."
# Con administrador se reconocen por el NOMBRE de la carpeta + palabras propias (la ruta puede estar en forma corta o larga y no coincidir).
$leaf = Split-Path $InstallDir -Leaf
Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
  Where-Object { $_.ProcessId -ne $PID -and $_.CommandLine -and $_.CommandLine -like "*$leaf*" -and $_.Name -match 'powershell|node|msedge|chrome' -and ($_.CommandLine -match 'run-server|run-kiosk|server\.js|radio-kiosk-profile') } |
  ForEach-Object { try { Stop-Process -Id $_.ProcessId -Force -ErrorAction Stop } catch { } }
# Sin administrador no se pueden consultar procesos: se paran por el PID que guardan run-server/run-kiosk.
& (Join-Path $here 'detener.ps1') -InstallDir $InstallDir -SoloPorPID
Start-Sleep -Seconds 1

# Accesos de Inicio: el del usuario actual y el comun (instalacion para todos los usuarios).
$startups = @([Environment]::GetFolderPath('Startup'), [Environment]::GetFolderPath('CommonStartup')) | Where-Object { $_ }
foreach ($dir in $startups) {
  foreach ($n in @('RadioDeacero-Servidor.lnk', 'RadioDeacero-Pantalla.lnk')) {
    $f = Join-Path $dir $n
    if (Test-Path $f) {
      try { Remove-Item $f -Force -ErrorAction Stop; Say "Acceso quitado: $f" }
      catch { Say "AVISO: no pude quitar $f (hace falta administrador)." }
    }
  }
}

if ($admin) { Get-NetFirewallRule -DisplayName 'Radio Deacero' -ErrorAction SilentlyContinue | Remove-NetFirewallRule; Say 'Regla de firewall quitada.' }

if (Test-Path $InstallDir) {
  if ($KeepData) {
    Get-ChildItem $InstallDir -Force | Where-Object { $_.Name -ne 'data' } | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
    Say "Carpeta limpiada; se conservan los datos en $InstallDir\data"
  } else {
    Remove-Item $InstallDir -Recurse -Force -ErrorAction SilentlyContinue
    if (Test-Path $InstallDir) { Say "AVISO: no se pudo borrar todo $InstallDir (algun archivo en uso o falta de permisos); reintenta tras cerrar sesion o como administrador." } else { Say "Carpeta borrada: $InstallDir" }
  }
} else { Say 'No habia carpeta de instalacion.' }
Say 'Listo.'
