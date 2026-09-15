@echo off
cd /d "%~dp0"
echo Generation de l'executable PTN2PDF...
echo.
call npm run dist
echo.
if errorlevel 1 (
  echo Echec de la generation, voir les erreurs ci-dessus.
) else (
  echo Termine ! Executable disponible dans le dossier release\
  start "" explorer "%~dp0release"
)
pause
