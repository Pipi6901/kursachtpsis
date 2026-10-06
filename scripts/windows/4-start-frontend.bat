@echo off
call "%~dp0_env.bat"
title Клиентская часть - порт 4200
cd /d "%ROOT%\frontend"

where node >nul 2>nul
if errorlevel 1 goto no_node
if exist node_modules goto run
echo Установка библиотек клиентской части (npm ci), при первом запуске это занимает несколько минут...
call npm ci
if errorlevel 1 goto fail

:run
echo Клиентская часть: http://localhost:4200   (после запуска страница откроется в браузере вручную)
echo Остановка: Ctrl+C
echo.
call npm start
exit /b %ERRORLEVEL%

:no_node
echo Не найден Node.js. Установите Node.js 18 LTS или 20 LTS с https://nodejs.org/
exit /b 1

:fail
echo.
echo Установка библиотек не удалась. Проверьте подключение к интернету и сообщения выше.
exit /b 1
