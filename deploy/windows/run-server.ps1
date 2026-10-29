# run-server.ps1 - arranca el servidor y lo relanza si se cae. Lo copia install.ps1 a <InstallDir>.
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$cfg = Get-Content (Join-Path $root 'config.json') -Raw | ConvertFrom-Json
$env:PORT = [string]$cfg.port
$env:HOST = [string]$cfg.host
$env:DATA_DIR = Join-Path $root 'data'
if ($cfg.token) { $env:REMOTE_TOKEN = [string]$cfg.token } else { Remove-Item Env:\REMOTE_TOKEN -ErrorAction SilentlyContinue }
$env:PATH = (Join-Path $root 'bin') + ';' + $env:PATH   # yt-dlp.exe portatil, si se descargo

$logs = Join-Path $root 'logs'
New-Item -ItemType Directory -Force -Path $logs | Out-Null
# El PID va en logs\ (cualquier usuario puede escribir ahi, en la raiz no) para que detener/instalar/desinstalar paren el proceso sin consultar procesos.
$PID | Set-Content -Path (Join-Path $logs 'run-server.pid') -Encoding ASCII
$log = Join-Path $logs 'server.log'
if ((Test-Path $log) -and ((Get-Item $log).Length -gt 5MB)) { Move-Item $log "$log.1" -Force }   # sin crecer sin limite

Set-Location (Join-Path $root 'app')
# Todo el log en UTF-8 (mezclar redirecciones de PowerShell 5.1 con Add-Content deja el archivo en dos codificaciones ilegibles)
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
function Log($m) { "[$(Get-Date -Format 's')] $m" | Out-File -FilePath $log -Append -Encoding utf8 }
while ($true) {
  Log 'arrancando servidor'
  # Ruta ABSOLUTA a server.js: asi install/uninstall reconocen el proceso de Node como suyo y pueden pararlo.
  & $cfg.node (Join-Path $root 'app\server.js') 2>&1 | ForEach-Object { "$_" } | Out-File -FilePath $log -Append -Encoding utf8
  Log "el servidor termino (codigo $LASTEXITCODE); se reintenta en 3 s"
  Start-Sleep -Seconds 3
}
