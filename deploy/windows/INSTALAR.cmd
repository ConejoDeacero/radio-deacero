@echo off
rem Instala DEACERO Play Lite en este PC para TODOS los usuarios (pide permisos de administrador una vez).
rem Para otra vista o modo, cambia -View kiosco -Mode video (normal / audio) en la linea de install.ps1.
setlocal
cd /d "%~dp0"
fltmc >nul 2>&1
if errorlevel 1 (
  echo Se necesitan permisos de administrador. Windows va a mostrar un aviso: aceptalo.
  powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)
set "DEST=%ProgramData%\RadioDeacero"
set "INICIO=%ProgramData%\Microsoft\Windows\Start Menu\Programs\Startup"
set "LOG=%TEMP%\radio-deacero-install.log"
echo Instalando en %DEST% ...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install.ps1" -InstallDir "%DEST%" -StartupDir "%INICIO%" -View kiosco -Mode video -LogFile "%LOG%"
echo.
echo (Todo lo anterior queda guardado en %LOG%)
pause
