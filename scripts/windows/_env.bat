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

rem Адрес ML-сервиса: по умолчанию этот же компьютер; на отдельном узле задаётся в config.bat
set "ML_SCHEME=http"
if /i "%USE_TLS%"=="1" set "ML_SCHEME=https"
if not defined ML_SERVICE_URL set "ML_SERVICE_URL=%ML_SCHEME%://localhost:%ML_PORT%"
if /i not "%USE_TLS%"=="1" goto tls_done
if not defined ML_SSL_CERTFILE set "ML_SSL_CERTFILE=%ROOT%\certs\ml-service.crt"
if not defined ML_SSL_KEYFILE set "ML_SSL_KEYFILE=%ROOT%\certs\ml-service.key"
if not defined ML_TRUST_STORE set "ML_TRUST_STORE=%ROOT%\certs\ml-truststore.p12"
:tls_done

set "ML_MODELS_DIR=%ROOT%\ml-service\models"
set "ML_PY=%ROOT%\ml-service\.venv\Scripts\python.exe"

rem Предупреждение, если в config.bat остались образцы CHANGE-ME-...
set "PLACEHOLDER="
if /i "%JWT_SECRET:~0,9%"=="CHANGE-ME" set "PLACEHOLDER=1"
if /i "%ML_API_KEY:~0,9%"=="CHANGE-ME" set "PLACEHOLDER=1"
if /i "%ML_ENCRYPTION_KEY:~0,9%"=="CHANGE-ME" set "PLACEHOLDER=1"
if not defined PLACEHOLDER goto placeholder_done
echo [!] В config.bat остались значения-образцы CHANGE-ME-...: замените их своими секретами.
echo.
:placeholder_done

if not defined USING_DEFAULTS goto env_done
echo [!] Файл scripts\windows\config.bat не найден: используются ключи по умолчанию, ТОЛЬКО для разработки.
echo     Скопируйте config.example.bat в config.bat и задайте свои значения.
echo.
:env_done
exit /b 0
