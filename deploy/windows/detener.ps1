# detener.ps1 - para el servidor y la pantalla completa SIN desinstalar.
# Cerrar el navegador no basta: run-kiosk.ps1 lo reabre a los 3 s. Aqui se para el que lo reabre, con todo lo que abrio.
# Vuelven a arrancar al iniciar sesion (o con iniciar.ps1). Para quitarlos del todo: uninstall.ps1.
#   powershell -ExecutionPolicy Bypass -File detener.ps1
param(
  [string]$InstallDir = $(if (Test-Path "$env:ProgramData\RadioDeacero\config.json") { "$env:ProgramData\RadioDeacero" } else { Join-Path $env:LOCALAPPDATA 'RadioDeacero' }),
  [switch]$SoloPorPID,   # sin el recurso de emergencia (lo usan install/uninstall)
  [switch]$Silencioso
)
$ErrorActionPreference = 'Continue'
function Say($m) { if (-not $Silencioso) { Write-Host "  $m" } }

# Lo normal: run-server.ps1 y run-kiosk.ps1 guardan su PID en logs\ (las versiones viejas, en la raiz); se paran con todo su arbol (Node, navegador).
# Primero la pantalla: si no, relanzaria el navegador.
$stopped = 0; $pidFiles = 0
foreach ($n in @('run-kiosk.pid', 'run-server.pid')) {
  foreach ($f in @((Join-Path $InstallDir "logs\$n"), (Join-Path $InstallDir $n))) {
    if (-not (Test-Path $f)) { continue }
    $pidFiles++
    $pidNum = 0
    if (-not [int]::TryParse((Get-Content $f -Raw).Trim(), [ref]$pidNum)) { continue }
    $p = Get-Process -Id $pidNum -ErrorAction SilentlyContinue
    # Solo si el proceso ya existia cuando se escribio el archivo (descarta un PID reutilizado por otro programa).
    if ($p -and $pidNum -ne $PID -and $p.ProcessName -eq 'powershell' -and $p.StartTime -le (Get-Item $f).LastWriteTime.AddSeconds(5)) {
      & cmd /c "taskkill /F /T /PID $pidNum >nul 2>nul"
      if ($LASTEXITCODE -eq 0) { Say "Parado: $n (PID $pidNum)"; $stopped++ }
      else { Say "AVISO: no se pudo parar $n (PID $pidNum): es de otro usuario o tiene permisos elevados; reinicia el PC o paralo como administrador." }
    }
  }
}

# Recurso de emergencia (instalacion antigua, sin archivos PID): sin permiso para consultar procesos no hay forma de reconocerlos por su
# linea de comandos, asi que se paran los PowerShell SIN ventana (los que lanzaron los accesos de Inicio). Las ventanas visibles no se tocan.
if ($pidFiles -eq 0 -and -not $SoloPorPID) {
  Say 'Sin archivos PID (instalacion antigua): se paran los PowerShell ocultos de este usuario.'
  Get-Process powershell -ErrorAction SilentlyContinue | Where-Object { $_.Id -ne $PID -and $_.MainWindowHandle -eq 0 } | ForEach-Object {
    & cmd /c "taskkill /F /T /PID $($_.Id) >nul 2>nul"; Say "Parado: PowerShell oculto (PID $($_.Id))"; $stopped++
  }
}

if ($stopped -eq 0) { Say 'No habia nada corriendo que parar.' } else { Say 'Listo. Al iniciar sesion de nuevo arrancan solos (o usa Iniciar).' }
