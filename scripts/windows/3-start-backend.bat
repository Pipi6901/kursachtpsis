@echo off
call "%~dp0_env.bat"
title Серверная часть - порт 8080
set "JAR=%ROOT%\backend\target\HotelManager-0.0.1-SNAPSHOT.jar"
cd /d "%ROOT%\backend"

where java >nul 2>nul
if errorlevel 1 goto no_java
if /i "%~1"=="rebuild" del "%JAR%" >nul 2>nul
if exist "%JAR%" goto run

echo Сборка серверной части (при первом запуске Maven скачивает библиотеки, это может занять несколько минут)...
call mvnw.cmd -DskipTests package
if errorlevel 1 goto fail

:run
echo Серверная часть: http://localhost:8080   ML-сервис: %ML_SERVICE_URL%
echo Новые таблицы модуля прогнозирования создаются автоматически; существующие данные не изменяются.
echo Остановка: Ctrl+C
echo.
java -jar "%JAR%"
exit /b %ERRORLEVEL%

:no_java
echo Не найдена Java. Установите JDK 17 или новее и добавьте её в PATH (или задайте JAVA_HOME).
exit /b 1

:fail
echo.
echo Сборка не удалась. Проверьте, что установлена JDK 17+ и есть подключение к интернету.
exit /b 1
