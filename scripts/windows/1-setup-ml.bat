@echo off
call "%~dp0_env.bat"
echo === Установка интеллектуального сервиса: виртуальное окружение и библиотеки ===
echo.

set "PYTHON="
for %%V in (3.13 3.12 3.11) do call :try_py %%V
if defined PYTHON goto have_python
where python >nul 2>nul || goto no_python
python -c "import sys; sys.exit(0 if sys.version_info >= (3, 11) else 1)" >nul 2>nul || goto no_python
set "PYTHON=python"

:have_python
echo Используется Python: %PYTHON%
if exist "%ML_PY%" goto have_venv
echo Создаю виртуальное окружение ml-service\.venv ...
%PYTHON% -m venv "%ROOT%\ml-service\.venv" || goto fail

:have_venv
"%ML_PY%" -m pip install --upgrade pip || goto fail
"%ML_PY%" -m pip install -r "%ROOT%\ml-service\requirements.txt" || goto fail
echo.
echo Готово. Запуск сервиса: 2-start-ml.bat
exit /b 0

:try_py
if defined PYTHON exit /b 0
py -%1 -c "import sys" >nul 2>nul && set "PYTHON=py -%1"
exit /b 0

:no_python
echo Не найден Python 3.11 или новее (рекомендуется 3.13). Установите его с https://www.python.org/downloads/
echo и отметьте пункт "Add python.exe to PATH". Затем запустите этот файл снова.
exit /b 1

:fail
echo.
echo Установка не удалась. Проверьте подключение к интернету и сообщения выше.
exit /b 1
