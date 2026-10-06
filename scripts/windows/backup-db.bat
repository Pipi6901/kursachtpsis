@echo off
call "%~dp0_env.bat"
if exist "%ML_PY%" goto run
echo Сначала выполните 1-setup-ml.bat: для шифрования копий используется то же окружение Python.
exit /b 1

:run
rem Параметры подключения: DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD (по умолчанию localhost:5432, БД hotel, postgres).
rem Дополнительно можно передать --only-forecast (только таблицы модуля прогнозирования).
"%ML_PY%" "%ROOT%\scripts\db_backup.py" backup --out "%ROOT%\backups" %*
exit /b %ERRORLEVEL%
