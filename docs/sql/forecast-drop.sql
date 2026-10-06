-- =============================================================================
-- Удаление модуля прогнозирования: удаляет ТОЛЬКО его таблицы (mk_*, fc_*) со всеми данными.
-- Таблицы и данные гостиничной системы не затрагиваются. Выполняйте только при остановленной
-- серверной части и после резервной копии (scripts/db_backup.py backup --only-forecast).
--
--   psql -U postgres -d hotel -f docs/sql/forecast-drop.sql
--
-- После удаления серверная часть при следующем запуске создаст таблицы заново и загрузит демонстрационные данные.
-- =============================================================================
BEGIN;
DROP TABLE IF EXISTS fc_model_warning;
DROP TABLE IF EXISTS fc_model_backtest_point;
DROP TABLE IF EXISTS fc_model_channel_effect;
DROP TABLE IF EXISTS fc_model_candidate;
DROP TABLE IF EXISTS fc_model;
DROP TABLE IF EXISTS fc_algorithm;
DROP TABLE IF EXISTS fc_sales_weekly;
DROP TABLE IF EXISTS mk_campaign;
DROP TABLE IF EXISTS mk_channel;
COMMIT;
