# autorun.ps1 - hace que el servidor y la pantalla arranquen solos al iniciar sesion, con tareas programadas
# (mas firmes que los accesos de la carpeta Inicio: con espera para que la red este lista).
#   powershell -ExecutionPolicy Bypass -File autorun.ps1 [-Remove]
# No necesita administrador (la tarea es del usuario actual). Si Windows no deja crearla, se conservan los accesos de Inicio.
# Para que arranque "en cuanto se prende el equipo" el PC debe entrar solo a la sesion (inicio de sesion automatico, lo configura IT).
param(
  [string]$InstallDir = (Join-Path $env:LOCALAPPDATA 'RadioDeacero'),
  [int]$DelaySeconds = 15,   # espera tras iniciar sesion antes de lanzar el servidor (la pantalla espera 10 s mas)
  [switch]$Remove,           # quita las tareas y vuelve a los accesos de Inicio
  [string]$StartupDir = [Environment]::GetFolderPath('Startup')
)
$ErrorActionPreference = 'Continue'
function Say($m) { Write-Host "  $m" }

$user = "$env:USERDOMAIN\$env:USERNAME"
$ps = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
$items = @(
  @{ Task = 'RadioDeacero-Servidor'; Lnk = 'RadioDeacero-Servidor.lnk'; Script = 'run-server.ps1'; Delay = $DelaySeconds },
  @{ Task = 'RadioDeacero-Pantalla'; Lnk = 'RadioDeacero-Pantalla.lnk'; Script = 'run-kiosk.ps1'; Delay = $DelaySeconds + 10 }
)
function Delay-Text([int]$s) { '{0:0000}:{1:00}' -f [math]::Floor($s / 60), ($s % 60) }

if ($Remove) {
  foreach ($i in $items) { $null = schtasks /Delete /TN $i.Task /F 2>&1; if ($LASTEXITCODE -eq 0) { Say "Tarea quitada: $($i.Task)" } }
  Say 'Listo. Para volver a los accesos de Inicio, ejecuta install.ps1 otra vez.'
  exit 0
}

$ok = 0; $wanted = 0
foreach ($i in $items) {
  $script = Join-Path $InstallDir $i.Script
  if (-not (Test-Path $script)) { Say "No esta $script (se omite)."; continue }
  $wanted++
  $tr = "`"$ps`" -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$script`""
  $out = schtasks /Create /TN $i.Task /TR $tr /SC ONLOGON /RU $user /DELAY (Delay-Text $i.Delay) /RL LIMITED /F 2>&1
  if ($LASTEXITCODE -eq 0) { $ok++; Say "Tarea creada: $($i.Task) (al iniciar sesion $user, espera $($i.Delay) s)" }
  else { Say "No se pudo crear $($i.Task): $(($out | Out-String).Trim())" }
}

if ($wanted -gt 0 -and $ok -eq $wanted) {
  # Con las tareas hechas se quitan los accesos de Inicio: si no, el servidor se lanzaria dos veces.
  foreach ($i in $items) { $f = Join-Path $StartupDir $i.Lnk; if (Test-Path $f) { Remove-Item $f -Force; Say "Acceso de Inicio quitado: $($i.Lnk)" } }
  Say 'Listo: arrancara solo al iniciar sesion.'
} else {
  foreach ($i in $items) { $null = schtasks /Delete /TN $i.Task /F 2>&1 }   # no dejar una tarea sola
  Say 'Windows no dejo crear las tareas: se conservan los accesos de la carpeta Inicio (hacen lo mismo).'
  exit 1
}
