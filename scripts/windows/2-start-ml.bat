@echo off
call "%~dp0_env.bat"
if exist "%ML_PY%" goto run
echo Сначала выполните 1-setup-ml.bat (установка окружения Python).
exit /b 1

:run
title Интеллектуальный сервис (ML) - порт %ML_PORT%
cd /d "%ROOT%\ml-service"
echo Интеллектуальный сервис: %ML_SERVICE_URL%  (документация API: /docs)
echo Модели хранятся в %ML_MODELS_DIR% в зашифрованном виде.
echo Остановка: Ctrl+C
echo.
"%ML_PY%" -m app
