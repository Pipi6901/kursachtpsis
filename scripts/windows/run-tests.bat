@echo off
call "%~dp0_env.bat"
set "FAILED="
if exist "%ML_PY%" goto ml
echo Сначала выполните 1-setup-ml.bat.
exit /b 1

:ml
echo === 1/4  ML-сервис (pytest) ===
"%ML_PY%" -m pip install -q -r "%ROOT%\ml-service\requirements-dev.txt" || set "FAILED=1"
pushd "%ROOT%\ml-service"
"%ML_PY%" -m pytest -q || set "FAILED=1"
popd

echo.
echo === 2/4  Скрипты резервного копирования и TLS (pytest) ===
"%ML_PY%" -m pytest -q "%ROOT%\scripts\tests" || set "FAILED=1"

echo.
echo === 3/4  Серверная часть (JUnit, встроенная БД H2, основная база не затрагивается) ===
pushd "%ROOT%\backend"
call mvnw.cmd -q test || set "FAILED=1"
popd

echo.
echo === 4/4  Клиентская часть (Karma, нужен установленный Google Chrome) ===
pushd "%ROOT%\frontend"
if exist node_modules goto fe_test
call npm ci || set "FAILED=1"
:fe_test
call npm run test:ci || set "FAILED=1"
popd

echo.
if defined FAILED (
  echo ИТОГ: есть непройденные проверки, см. сообщения выше.
  exit /b 1
)
echo ИТОГ: все проверки пройдены.
