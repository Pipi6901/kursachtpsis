package com.HotelManager.config;

import com.HotelManager.entity.Room;
import com.HotelManager.entity.RoomImage;
import com.HotelManager.repo.RoomRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Номера, созданные до появления нескольких фотографий, хранят единственное фото в поле {@code room.photo}. При
 * запуске оно один раз добавляется в таблицу {@code room_image} как первая фотография (обложка), чтобы такие номера
 * можно было дополнять новыми снимками. Только добавляет строки в новую таблицу: данные номеров не меняются.
 */
@Slf4j
@Component
@Order(1)
@RequiredArgsConstructor
public class RoomImageBackfill implements ApplicationRunner {

    private final RoomRepository rooms;

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        int added = 0;
        for (Room room : rooms.findAll()) {
            String photo = room.getPhoto();
            if (photo != null && !photo.isBlank() && room.getImages().isEmpty()) {
                room.getImages().add(RoomImage.builder().room(room).fileName(photo).position(0).build());
                added++;
            }
        }
        if (added > 0) {
            log.info("Фотографии {} номеров перенесены в таблицу room_image", added);
        }
    }
}
