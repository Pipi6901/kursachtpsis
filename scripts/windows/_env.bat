@echo off
rem Общие настройки для всех скриптов. Подключается командой: call "%~dp0_env.bat"
chcp 65001 >nul

rem Корень проекта - два каталога выше этого файла
for %%I in ("%~dp0..\..") do set "ROOT=%%~fI"

rem Пользовательские настройки (создаются из config.example.bat)
if exist "%~dp0config.bat" call "%~dp0config.bat"

rem Значения по умолчанию - только для разработки, перед эксплуатацией задайте свои в config.bat
set "USING_DEFAULTS="
if not defined DB_PASSWORD set "DB_PASSWORD=postgres"
if not defined JWT_SECRET set "JWT_SECRET=change-me-to-a-long-random-secret-string-0123456789"
if not defined ML_API_KEY set "ML_API_KEY=dev-ml-key-change-me"
if not defined ML_ENCRYPTION_KEY set "ML_ENCRYPTION_KEY=dev-model-encryption-passphrase"
if not defined ML_PORT set "ML_PORT=8001"
if not exist "%~dp0config.bat" set "USING_DEFAULTS=1"

set "ML_SERVICE_URL=http://localhost:%ML_PORT%"
if /i not "%USE_TLS%"=="1" goto tls_done
set "ML_SSL_CERTFILE=%ROOT%\certs\ml-service.crt"
set "ML_SSL_KEYFILE=%ROOT%\certs\ml-service.key"
set "ML_SERVICE_URL=https://localhost:%ML_PORT%"
set "ML_TRUST_STORE=%ROOT%\certs\ml-truststore.p12"
:tls_done

set "ML_MODELS_DIR=%ROOT%\ml-service\models"
set "ML_PY=%ROOT%\ml-service\.venv\Scripts\python.exe"

if not defined USING_DEFAULTS goto env_done
echo [!] Файл scripts\windows\config.bat не найден: используются ключи по умолчанию, ТОЛЬКО для разработки.
echo     Скопируйте config.example.bat в config.bat и задайте свои значения.
echo.
:env_done
exit /b 0
