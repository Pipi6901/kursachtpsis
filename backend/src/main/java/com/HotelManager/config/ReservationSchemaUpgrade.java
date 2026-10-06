package com.HotelManager.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import javax.sql.DataSource;
import java.sql.Connection;

/**
 * Обновляет таблицу броней в уже существующей базе PostgreSQL: Hibernate (ddl-auto=update) сам добавляет новые
 * столбцы, но не расширяет ограничение допустимых значений статуса, поэтому значение COMPLETED («Завершено»)
 * без этого шага было бы отклонено базой. Те же действия описаны в docs/sql/booking-upgrade.sql.
 * В новой базе (и во встраиваемой H2 тестов) ограничение создаётся сразу со всеми значениями, шаг ничего не меняет.
 */
@Slf4j
@Component
@Order(0)
@RequiredArgsConstructor
public class ReservationSchemaUpgrade implements ApplicationRunner {

    private static final String SQL = """
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
            $$
            """;

    private final JdbcTemplate jdbc;
    private final DataSource dataSource;

    @Override
    public void run(ApplicationArguments args) {
        try (Connection c = dataSource.getConnection()) {
            if (!"PostgreSQL".equalsIgnoreCase(c.getMetaData().getDatabaseProductName())) {
                return;
            }
        } catch (Exception e) {
            log.warn("Не удалось определить тип базы данных, обновление таблицы броней пропущено: {}", e.getMessage());
            return;
        }
        try {
            jdbc.execute(SQL);
            log.info("Таблица броней проверена: столбцы дат и статус «Завершено» доступны");
        } catch (Exception e) {
            log.error("Не удалось обновить таблицу броней (см. docs/sql/booking-upgrade.sql): {}", e.getMessage());
        }
    }
}
