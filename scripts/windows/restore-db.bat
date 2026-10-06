@echo off
call "%~dp0_env.bat"
if exist "%ML_PY%" goto check_args
echo Сначала выполните 1-setup-ml.bat.
exit /b 1

:check_args
if "%~2"=="" goto usage
echo Копия будет восстановлена в НОВУЮ базу данных "%~2". Рабочая база не изменяется.
rem Целостность файла и парольная фраза проверяются до создания базы.
"%ML_PY%" "%ROOT%\scripts\db_backup.py" restore "%~1" --db "%~2" --create-db
exit /b %ERRORLEVEL%

:usage
echo Использование: restore-db.bat ^<файл копии^> ^<имя новой базы данных^>
echo Пример:        restore-db.bat ..\..\backups\hotel_full_20261005_231455.sql.enc hotel_restore
exit /b 1
