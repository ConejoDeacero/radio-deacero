@echo off
rem Quita DEACERO Play Lite de este PC (pide permisos de administrador una vez).
setlocal
cd /d "%~dp0"
fltmc >nul 2>&1
if errorlevel 1 (
  echo Se necesitan permisos de administrador. Windows va a mostrar un aviso: aceptalo.
  powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0uninstall.ps1" -InstallDir "%ProgramData%\RadioDeacero" -StartupDir "%ProgramData%\Microsoft\Windows\Start Menu\Programs\Startup"
pause
