# iniciar.ps1 - arranca el servidor y la pantalla completa ahora (sin esperar a iniciar sesion).
#   powershell -ExecutionPolicy Bypass -File iniciar.ps1
# Ejecutalo desde una ventana NORMAL (no como administrador): asi la app corre con tu usuario y se puede detener sin permisos especiales.
param(
  [string]$InstallDir = $(if (Test-Path "$env:ProgramData\RadioDeacero\config.json") { "$env:ProgramData\RadioDeacero" } else { Join-Path $env:LOCALAPPDATA 'RadioDeacero' })
)
$ErrorActionPreference = 'Continue'
function Say($m) { Write-Host "  $m" }

$cfgFile = Join-Path $InstallDir 'config.json'
if (-not (Test-Path $cfgFile)) { Say "No esta instalado en $InstallDir. Usa primero la opcion Instalar del menu."; exit 1 }
$cfg = Get-Content $cfgFile -Raw | ConvertFrom-Json
$ps = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'

$admin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if ($admin) { Say 'AVISO: esta ventana es de administrador; lo que arranque correra con esos permisos y los demas usuarios no podran pararlo. Mejor usa una ventana normal.' }

function Test-Server { try { return [bool](Invoke-RestMethod -UseBasicParsing "http://127.0.0.1:$($cfg.port)/api/health" -TimeoutSec 2).ok } catch { return $false } }
# Un lanzador (run-*.ps1) esta vivo si su PID guardado existe y es de PowerShell (y ya existia cuando se guardo el archivo).
function Test-Launcher($name) {
  $f = Join-Path $InstallDir "logs\$name.pid"
  if (-not (Test-Path $f)) { return $false }
  $pidNum = 0
  if (-not [int]::TryParse((Get-Content $f -Raw).Trim(), [ref]$pidNum)) { return $false }
  $p = Get-Process -Id $pidNum -ErrorAction SilentlyContinue
  return [bool]($p -and $p.ProcessName -eq 'powershell' -and $p.StartTime -le (Get-Item $f).LastWriteTime.AddSeconds(5))
}
function Start-Hidden($script) {
  Start-Process $ps -ArgumentList '-NoProfile', '-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden', '-File', "`"$(Join-Path $InstallDir $script)`"" -WindowStyle Hidden
}

if (Test-Server) { Say 'El servidor ya estaba corriendo.' }
else {
  if (Test-Launcher 'run-server') { Say 'El servidor se esta (re)arrancando; se espera a que responda.' } else { Start-Hidden 'run-server.ps1'; Say 'Servidor lanzado.' }
  $up = $false
  for ($i = 0; $i -lt 40 -and -not $up; $i++) { Start-Sleep -Seconds 1; $up = Test-Server }
  if ($up) { Say 'Servidor listo.' } else { Say "AVISO: el servidor no respondio en 40 s. Revisa $InstallDir\logs\server.log"; exit 1 }
}

if ($cfg.kiosk -eq $false) { Say 'Esta instalacion no abre pantalla completa (solo servidor).' }
elseif (Test-Launcher 'run-kiosk') { Say 'La pantalla completa ya estaba abierta.' }
else { Start-Hidden 'run-kiosk.ps1'; Say 'Pantalla completa lanzada.' }
Say 'Listo.'
