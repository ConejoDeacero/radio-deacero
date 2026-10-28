# update.ps1 - baja la ultima version de GitHub y la instala encima (conserva clave, puerto, vista, modo, podcasts e historial).
# Vive en la carpeta de instalacion (install.ps1 lo copia ahi):
#   powershell -ExecutionPolicy Bypass -File "%LOCALAPPDATA%\RadioDeacero\update.ps1" [-UpdateYtDlp] [-NoStart]
# El repo es publico: no hace falta Git ni credenciales.
param(
  [string]$InstallDir = $PSScriptRoot,
  [string]$Repo = 'ConejoDeacero/radio-deacero',
  [string]$Branch = 'main',
  [switch]$UpdateYtDlp,   # de paso, actualiza yt-dlp.exe (YouTube cambia seguido y es lo que mas se rompe)
  [switch]$NoStart        # no arrancar al terminar
)
$ErrorActionPreference = 'Stop'
function Say($m) { Write-Host "  $m" }

if (-not $InstallDir -or -not (Test-Path (Join-Path $InstallDir 'config.json'))) {
  throw "No encuentro una instalacion en '$InstallDir'. Ejecuta este update.ps1 desde la carpeta de instalacion o pasa -InstallDir."
}
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12   # PowerShell 5.1 usa TLS viejo por defecto

$tmp = Join-Path $env:TEMP ('radio-update-' + [guid]::NewGuid().ToString('N').Substring(0, 8))
New-Item -ItemType Directory -Force -Path $tmp | Out-Null
try {
  $url = "https://github.com/$Repo/archive/refs/heads/$Branch.zip"
  Say "Bajando $url ..."
  $zip = Join-Path $tmp 'src.zip'
  try { Invoke-WebRequest -UseBasicParsing $url -OutFile $zip }
  catch { throw "No pude bajar los cambios de GitHub ($($_.Exception.Message)). Si este equipo no llega a GitHub, copia el zip de la app y ejecuta install.ps1." }
  Expand-Archive -Path $zip -DestinationPath $tmp -Force
  $src = Get-ChildItem $tmp -Directory | Select-Object -First 1
  $inst = Join-Path $src.FullName 'deploy\windows\install.ps1'
  if (-not (Test-Path $inst)) { throw "El zip no trae deploy\windows\install.ps1 (rama '$Branch')." }

  if ($UpdateYtDlp) {
    $yt = Join-Path $InstallDir 'bin\yt-dlp.exe'
    if (Test-Path $yt) { Say 'Actualizando yt-dlp...'; & $yt -U } else { Say 'Sin yt-dlp.exe portatil en la carpeta (se usa el del sistema): no se toca.' }
  }

  $argv = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $inst, '-InstallDir', $InstallDir)
  if ($NoStart) { $argv += '-NoStart' }
  & (Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe') @argv
  if ($LASTEXITCODE -ne 0) { throw "install.ps1 termino con codigo $LASTEXITCODE" }
} finally {
  Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
}
