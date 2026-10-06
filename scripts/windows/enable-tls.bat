@echo off
call "%~dp0_env.bat"
if exist "%ML_PY%" goto run
echo Сначала выполните 1-setup-ml.bat.
exit /b 1

:run
echo === Создание самоподписанного сертификата для HTTPS между сервером и ML-сервисом ===
echo Для хранилища доверенных сертификатов нужна утилита keytool из JDK (JAVA_HOME или PATH).
echo.
"%ML_PY%" "%ROOT%\scripts\make_certs.py" --out "%ROOT%\certs" || exit /b 1
echo.
echo Чтобы включить HTTPS, добавьте в scripts\windows\config.bat строку:   set "USE_TLS=1"
echo Если при создании хранилища использовался другой пароль, задайте ML_TRUST_STORE_PASSWORD.
echo Затем перезапустите ML-сервис и серверную часть.
