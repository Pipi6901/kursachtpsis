@echo off
rem ============================================================================
rem  Настройки запуска. Скопируйте этот файл в config.bat (рядом) и задайте свои значения.
rem  Файл config.bat в репозиторий не попадает (см. .gitignore).
rem  В значениях не используйте символы: & % ^ ! " < > | а также кириллицу (ключи передаются в заголовках HTTP).
rem  Значения CHANGE-ME-... — образцы: обязательно замените их своими.
rem ============================================================================

rem --- База данных PostgreSQL (имя БД hotel и пользователь postgres заданы в application.properties) ---
set "DB_PASSWORD=postgres"

rem --- Серверная часть ---
rem Секрет подписи JWT-токенов: длинная случайная строка (не менее 32 символов)
set "JWT_SECRET=CHANGE-ME-long-random-string-at-least-32-characters"

rem --- Интеллектуальный сервис ---
rem Общий секрет между сервером и ML-сервисом: одинаков на обоих узлах (задаётся здесь один раз)
set "ML_API_KEY=CHANGE-ME-long-random-key"
rem Парольная фраза шифрования моделей на диске (AES-256-GCM). При смене ранее обученные модели
rem станут нечитаемыми, и сервер обучит их заново автоматически.
set "ML_ENCRYPTION_KEY=CHANGE-ME-model-encryption-passphrase"
rem set "ML_PORT=8001"
rem Если ML-сервис работает на другом компьютере:
rem   на узле ML-сервиса:  set "ML_HOST=0.0.0.0"          (слушать все сетевые интерфейсы; откройте порт в брандмауэре)
rem   на узле сервера:     set "ML_SERVICE_URL=http://192.168.0.20:8001"

rem --- HTTPS между сервером и ML-сервисом (сначала выполните enable-tls.bat) ---
rem set "USE_TLS=1"
rem Пароль хранилища доверенных сертификатов (тот же, что при создании; по умолчанию changeit)
rem set "ML_TRUST_STORE_PASSWORD=changeit"

rem --- Резервные копии ---
rem Парольная фраза шифрования копий БД. Если не задана, будет запрошена при создании копии.
rem set "BACKUP_PASSPHRASE=CHANGE-ME-backup-passphrase"
rem Каталог bin установленного PostgreSQL, если pg_dump и psql не найдены автоматически
rem set "PG_BIN=C:\Program Files\PostgreSQL\16\bin"
