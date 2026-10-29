# estado.ps1 - muestra si esta instalado, si corre y las direcciones con la clave de control remoto.
#   powershell -ExecutionPolicy Bypass -File estado.ps1
param(
  [string]$InstallDir = $(if (Test-Path "$env:ProgramData\RadioDeacero\config.json") { "$env:ProgramData\RadioDeacero" } else { Join-Path $env:LOCALAPPDATA 'RadioDeacero' })
)
$ErrorActionPreference = 'Continue'
function Say($m) { Write-Host "  $m" }

$cfgFile = Join-Path $InstallDir 'config.json'
if (-not (Test-Path $cfgFile)) { Say 'No esta instalado (usa Instalar en el menu).'; exit 0 }
$cfg = Get-Content $cfgFile -Raw | ConvertFrom-Json
Say "Instalado en:  $InstallDir"
Say "Vista / modo:  $($cfg.view) / $($cfg.mode)"

$h = $null
try { $h = Invoke-RestMethod -UseBasicParsing "http://127.0.0.1:$($cfg.port)/api/health" -TimeoutSec 3 } catch { }
if ($h -and $h.ok) { Say "Servidor:      CORRIENDO (yt-dlp $($h.ytdlp))" }
else {
  Say 'Servidor:      DETENIDO (usa Iniciar). Ultimas lineas del log:'
  Get-Content (Join-Path $InstallDir 'logs\server.log') -Tail 5 -ErrorAction SilentlyContinue | ForEach-Object { Say "    $_" }
}

$ips = @(Get-NetIPConfiguration -ErrorAction SilentlyContinue | Where-Object { $_.IPv4DefaultGateway -and $_.IPv4Address } | ForEach-Object { $_.IPv4Address.IPAddress })
Say "En este equipo:  http://localhost:$($cfg.port)/kiosco"
if ($cfg.host -ne '127.0.0.1') {
  foreach ($ip in $ips) { Say "Control remoto:   http://${ip}:$($cfg.port)/remote?t=$($cfg.token)" }
  Say "Clave:            $($cfg.token)"
} else { Say 'Solo este equipo (sin control desde la red).' }

$sh = New-Object -ComObject WScript.Shell
$auto = @()
foreach ($dir in @([Environment]::GetFolderPath('Startup'), [Environment]::GetFolderPath('CommonStartup'))) {
  if ($dir -and (Test-Path (Join-Path $dir 'RadioDeacero-Servidor.lnk'))) { $auto += $dir }
}
if ($auto.Count) { Say "Arranca solo al iniciar sesion (acceso en: $($auto -join ' ; '))" } else { Say 'AVISO: no hay acceso en la carpeta Inicio: no arrancara solo al iniciar sesion.' }
