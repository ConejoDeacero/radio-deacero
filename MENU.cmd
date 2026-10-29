@echo off
rem DEACERO Play Lite para Windows - menu unico. Doble clic y elige una opcion. Los pasos estan en LEEME.txt.
rem (Sin acentos a proposito: la consola de Windows los muestra mal.)
setlocal EnableExtensions
cd /d "%~dp0"
title DEACERO Play Lite
set "W=%~dp0deploy\windows"
set "PSX=powershell -NoProfile -ExecutionPolicy Bypass -File"
set "TODOS=%ProgramData%\RadioDeacero"
set "SOLOYO=%LOCALAPPDATA%\RadioDeacero"
set "INICIO_COMUN=%ProgramData%\Microsoft\Windows\Start Menu\Programs\Startup"
set "LOG=%TEMP%\radio-deacero-install.log"

rem El menu se relanza solo, con permisos de administrador, para estas dos acciones.
if /i "%~1"=="admin-instalar" goto :admin_instalar
if /i "%~1"=="admin-desinstalar" goto :admin_desinstalar

:menu
cls
call :donde
echo ==================================================
echo    DEACERO Play Lite
echo ==================================================
echo    Instalacion actual: %ESTADO%
echo.
echo    1  Instalar o actualizar PARA TODOS los usuarios   [pide permisos de administrador]
echo    2  Instalar o actualizar SOLO PARA MI usuario      [no pide administrador]
echo    3  Iniciar
echo    4  Detener
echo    5  Ver estado y clave de control remoto
echo    6  Desinstalar
echo    0  Salir
echo.
set "OP="
set /p "OP=Elige una opcion y presiona Enter: "
if "%OP%"=="1" goto :op1
if "%OP%"=="2" goto :op2
if "%OP%"=="3" goto :op3
if "%OP%"=="4" goto :op4
if "%OP%"=="5" goto :op5
if "%OP%"=="6" goto :op6
if "%OP%"=="0" exit /b
goto :menu

rem ---------------------------------------------------------------- 1: para todos (administrador)
:op1
if exist "%SOLOYO%\config.json" (
  echo.
  echo Ya hay una instalacion SOLO PARA TU USUARIO. Desinstalala primero con la opcion 6, para no tener dos.
  goto :fin
)
call :preguntar_vista "%TODOS%"
fltmc >nul 2>&1
if not errorlevel 1 goto :admin_instalar_aqui
echo.
echo Windows va a mostrar un aviso de administrador: aceptalo.
powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -ArgumentList 'admin-instalar','%VISTA%' -Verb RunAs -Wait"
echo.
echo Arrancando con tu usuario normal...
%PSX% "%W%\iniciar.ps1" -InstallDir "%TODOS%"
goto :fin

rem ---------------------------------------------------------------- 2: solo este usuario
:op2
if exist "%TODOS%\config.json" (
  echo.
  echo Ya hay una instalacion PARA TODOS los usuarios. Desinstalala primero con la opcion 6, para no tener dos.
  goto :fin
)
call :preguntar_vista "%SOLOYO%"
call :argumentos_vista
echo.
echo Instalando en %SOLOYO% ...
%PSX% "%W%\install.ps1" -InstallDir "%SOLOYO%" %ARGV% -LogFile "%LOG%"
echo.
echo Registro guardado en %LOG%
goto :fin

rem ---------------------------------------------------------------- 3 a 5
:op3
echo.
%PSX% "%W%\iniciar.ps1" -InstallDir "%INST%"
goto :fin

:op4
echo.
%PSX% "%W%\detener.ps1" -InstallDir "%INST%"
goto :fin

:op5
echo.
%PSX% "%W%\estado.ps1" -InstallDir "%INST%"
goto :fin

rem ---------------------------------------------------------------- 6: desinstalar
:op6
echo.
if not exist "%INST%\config.json" (
  echo No hay nada instalado.
  goto :fin
)
set "SI="
set /p "SI=Se quitara la app de %INST%. Escribe S para continuar: "
if /i not "%SI%"=="S" goto :menu
if /i "%INST%"=="%TODOS%" goto :op6_admin
%PSX% "%W%\uninstall.ps1" -InstallDir "%INST%"
goto :fin
:op6_admin
fltmc >nul 2>&1
if not errorlevel 1 goto :admin_desinstalar_aqui
echo Windows va a mostrar un aviso de administrador: aceptalo.
powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -ArgumentList 'admin-desinstalar' -Verb RunAs -Wait"
goto :fin

:fin
echo.
pause
goto :menu

rem ---------------------------------------------------------------- partes que corren como administrador
:admin_instalar
set "VISTA=%~2"
:admin_instalar_aqui
call :argumentos_vista
echo Instalando para todos los usuarios en %TODOS% ...
%PSX% "%W%\install.ps1" -InstallDir "%TODOS%" -StartupDir "%INICIO_COMUN%" %ARGV% -LogFile "%LOG%"
echo.
echo Registro guardado en %LOG%
if /i "%~1"=="admin-instalar" (
  echo.
  echo Esta ventana de administrador ya termino. Puedes cerrarla.
  pause
  exit /b
)
goto :fin

:admin_desinstalar
:admin_desinstalar_aqui
%PSX% "%W%\uninstall.ps1" -InstallDir "%TODOS%"
if /i "%~1"=="admin-desinstalar" (
  echo.
  pause
  exit /b
)
goto :fin

rem ---------------------------------------------------------------- ayudas
:donde
set "INST=%TODOS%"
if exist "%TODOS%\config.json" goto :donde_todos
set "INST=%SOLOYO%"
if exist "%SOLOYO%\config.json" goto :donde_yo
set "ESTADO=no instalado"
goto :eof
:donde_todos
set "ESTADO=para todos los usuarios, en %TODOS%"
goto :eof
:donde_yo
set "ESTADO=solo para %USERNAME%, en %SOLOYO%"
goto :eof

rem Si ya esta instalado se conserva su vista; si no, se pregunta.
:preguntar_vista
set "VISTA="
if exist "%~1\config.json" (
  echo.
  echo Ya esta instalado: se actualiza conservando la clave, la vista y los datos.
  goto :eof
)
echo.
echo    Como quieres la pantalla?
echo      1  Kiosco: hora grande y video difuminado de fondo, solo para ver   [recomendado]
echo      2  Reproductor normal, con botones
set "V="
set /p "V=Elige 1 o 2 y presiona Enter [1]: "
if "%V%"=="2" (set "VISTA=normal") else (set "VISTA=kiosco")
goto :eof

:argumentos_vista
set "ARGV="
if /i "%VISTA%"=="kiosco" set "ARGV=-View kiosco -Mode video"
if /i "%VISTA%"=="normal" set "ARGV=-View normal -Mode audio"
goto :eof
