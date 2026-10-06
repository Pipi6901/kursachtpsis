-- =============================================================================
-- Календарь бронирования и статус «Завершено» (гость нажал «Выселиться» — проживание состоялось).
--
-- Сервер выполняет эти действия сам при запуске (класс ReservationSchemaUpgrade), поэтому вручную запускать
-- скрипт не нужно. Он приведён для администратора БД, который применяет изменения под своей учётной записью:
--   psql -U postgres -d hotel -f docs/sql/booking-upgrade.sql
--
-- Что меняется в таблице reservation (строки броней не изменяются):
--   * добавляются пустые столбцы start_date, end_date, moved_out_at — у старых броней дат нет, сервер берёт
--     заезд из даты чека, а выезд считает как заезд плюс число суток;
--   * расширяется ограничение допустимых значений status: к WAITING, DONE и REJECT добавляется COMPLETED.
-- Скрипт можно выполнять повторно.
-- =============================================================================
DO $$
DECLARE
    c record;
BEGIN
    IF to_regclass('reservation') IS NOT NULL THEN
        ALTER TABLE reservation ADD COLUMN IF NOT EXISTS start_date DATE;
        ALTER TABLE reservation ADD COLUMN IF NOT EXISTS end_date DATE;
        ALTER TABLE reservation ADD COLUMN IF NOT EXISTS moved_out_at TIMESTAMP(6);

        IF NOT EXISTS (SELECT 1 FROM pg_constraint
                       WHERE conrelid = 'reservation'::regclass AND contype = 'c'
                         AND pg_get_constraintdef(oid) LIKE '%COMPLETED%') THEN
            FOR c IN SELECT conname FROM pg_constraint
                     WHERE conrelid = 'reservation'::regclass AND contype = 'c'
                       AND pg_get_constraintdef(oid) LIKE '%status%'
            LOOP
                EXECUTE format('ALTER TABLE reservation DROP CONSTRAINT %I', c.conname);
            END LOOP;
            ALTER TABLE reservation ADD CONSTRAINT reservation_status_check
                CHECK (status IN ('WAITING', 'DONE', 'REJECT', 'COMPLETED'));
        END IF;
    END IF;
END
$$;
