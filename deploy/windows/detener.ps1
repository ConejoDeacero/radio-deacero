# detener.ps1 - para el servidor y la pantalla completa SIN desinstalar (el navegador se reabre solo si solo lo cierras).
# Vuelven a arrancar al iniciar sesion. Para dejarlos de forma permanente: uninstall.ps1.
#   powershell -ExecutionPolicy Bypass -File "%LOCALAPPDATA%\RadioDeacero\detener.ps1"
param([string]$InstallDir = $PSScriptRoot)
$ErrorActionPreference = 'Continue'
function Say($m) { Write-Host "  $m" }

# Lo normal: run-server.ps1 y run-kiosk.ps1 guardan su PID; se paran con todo su arbol (Node, navegador).
$stopped = 0; $pidFiles = 0
foreach ($n in @('run-kiosk.pid', 'run-server.pid')) {   # primero la pantalla: si no, relanza el navegador
  $f = Join-Path $InstallDir $n
  if (-not (Test-Path $f)) { continue }
  $pidFiles++
  $pidNum = 0
  if (-not [int]::TryParse((Get-Content $f -Raw).Trim(), [ref]$pidNum)) { continue }
  $p = Get-Process -Id $pidNum -ErrorAction SilentlyContinue
  # Solo si el proceso ya existia cuando se escribio el archivo (descarta un PID reutilizado por otro programa).
  if ($p -and $pidNum -ne $PID -and $p.ProcessName -eq 'powershell' -and $p.StartTime -le (Get-Item $f).LastWriteTime.AddSeconds(5)) {
    & cmd /c "taskkill /F /T /PID $pidNum >nul 2>nul"
    Say "Parado: $n (PID $pidNum)"; $stopped++
  }
}

# Instalacion antigua (sin archivos PID): sin permiso para consultar procesos no hay forma de reconocerlos por su linea de comandos,
# asi que se paran los PowerShell SIN ventana (los que lanzaron los accesos de Inicio). Las ventanas visibles no se tocan.
if ($pidFiles -eq 0) {
  Say 'Sin archivos PID (instalacion antigua): se paran los PowerShell ocultos de este usuario.'
  Get-Process powershell -ErrorAction SilentlyContinue | Where-Object { $_.Id -ne $PID -and $_.MainWindowHandle -eq 0 } | ForEach-Object {
    & cmd /c "taskkill /F /T /PID $($_.Id) >nul 2>nul"; Say "Parado: PowerShell oculto (PID $($_.Id))"; $stopped++
  }
}

if ($stopped -eq 0) { Say 'No habia nada corriendo que parar.' } else { Say 'Listo. Al iniciar sesion de nuevo arrancan solos.' }
