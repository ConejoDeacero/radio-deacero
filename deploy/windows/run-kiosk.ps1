# run-kiosk.ps1 - abre la app en pantalla completa (Edge o Chrome) y la reabre si se cierra.
# Lo copia install.ps1 a <InstallDir>. -DryRun solo muestra que navegador y que direccion usaria.
param([switch]$DryRun)

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$cfg = Get-Content (Join-Path $root 'config.json') -Raw | ConvertFrom-Json

$path = '/'
if ($cfg.view -eq 'kiosco') { $path = '/kiosco' }
$url = "http://localhost:$($cfg.port)$path`?mode=$($cfg.mode)"
if ($cfg.estirar -gt 1) { $url += "&estirar=$($cfg.estirar)" }   # panel panoramico estirado: ver install.ps1 -Estirar

$candidates = @(
  "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
  "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
  "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
  "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
)
$browser = $candidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $browser) { Write-Host 'No encontre Edge ni Chrome.'; exit 1 }

# Perfil propio: no toca el navegador personal. --autoplay-policy: sin esto no deja sonar la musica sin un clic.
$profile = Join-Path $root 'radio-kiosk-profile'
$args = @('--kiosk', $url, '--edge-kiosk-type=fullscreen', "--user-data-dir=$profile", '--no-first-run', '--no-default-browser-check',
  '--disable-session-crashed-bubble', '--disable-features=Translate,TranslateUI', '--autoplay-policy=no-user-gesture-required', '--noerrdialogs', '--disable-infobars')

if ($DryRun) { Write-Host "Navegador: $browser"; Write-Host "Direccion: $url"; Write-Host "Argumentos: $($args -join ' ')"; exit 0 }

$logs = Join-Path $root 'logs'   # el PID va en logs\ (cualquier usuario puede escribir ahi) para que detener/instalar/desinstalar lo paren
New-Item -ItemType Directory -Force -Path $logs | Out-Null
$PID | Set-Content -Path (Join-Path $logs 'run-kiosk.pid') -Encoding ASCII

# esperar al servidor (evita abrir una pagina de error al iniciar sesion)
while ($true) {
  try { $r = Invoke-RestMethod -UseBasicParsing "http://127.0.0.1:$($cfg.port)/api/health" -TimeoutSec 2; if ($r.ok) { break } } catch { }
  Start-Sleep -Seconds 2
}
while ($true) {
  Start-Process -FilePath $browser -ArgumentList $args -Wait
  Start-Sleep -Seconds 3
}
