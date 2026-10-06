@echo off
call "%~dp0_env.bat"
set "S=%~dp0"
echo Запуск трёх узлов в отдельных окнах: ML-сервис, серверная часть, клиентская часть.
echo Первый запуск занимает несколько минут (сборка и загрузка библиотек).
echo.
start "ML-сервис" cmd /k call "%S%2-start-ml.bat"
timeout /t 3 /nobreak >nul
start "Серверная часть" cmd /k call "%S%3-start-backend.bat"
start "Клиентская часть" cmd /k call "%S%4-start-frontend.bat"
echo Когда в окнах появятся сообщения о запуске, откройте http://localhost:4200
echo Вход: учётная запись администратора или менеджера, раздел "Прогноз" в верхнем меню.
