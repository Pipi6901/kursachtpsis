package com.HotelManager.controller;

import com.HotelManager.DTO.BusyPeriodDTO;
import com.HotelManager.DTO.ReservationDTO;
import com.HotelManager.DTO.RoomDTO;
import com.HotelManager.entity.Receipt;
import com.HotelManager.entity.Reservation;
import com.HotelManager.entity.Room;
import com.HotelManager.entity.User;
import com.HotelManager.entity.enums.ReservationStatus;
import com.HotelManager.exception.ErrorResponse;
import com.HotelManager.repo.ReceiptRepository;
import com.HotelManager.repo.ReservationRepository;
import com.HotelManager.repo.RoomRepository;
import com.HotelManager.repo.UserRepository;
import com.HotelManager.service.RoomAvailabilityService;
import com.HotelManager.service.RoomMediaService;
import tools.jackson.databind.DeserializationFeature;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.json.JsonMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import jakarta.transaction.Transactional;

import java.io.IOException;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

@Slf4j
@RestController
@CrossOrigin(origins = "*")
@RequiredArgsConstructor
@RequestMapping("/rooms")
public class RoomController {

    private final RoomRepository roomRepository;
    private final UserRepository userRepository;
    private final ReservationRepository reservationRepository;
    private final ReceiptRepository receiptRepository;
    private final RoomAvailabilityService availability;
    private final RoomMediaService media;

    /** Разбор JSON описания номера из multipart-запроса; неизвестные поля игнорируются. */
    private static final ObjectMapper JSON = JsonMapper.builder()
            .disable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES)
            .build();

    /** Описание номера для клиента; «свободен» означает свободен сегодняшней ночью. */
    private RoomDTO toDto(Room room) {
        RoomDTO roomDTO = new RoomDTO();
        roomDTO.setId(room.getId());
        roomDTO.setName(room.getName());
        roomDTO.setPrice(room.getPrice());
        roomDTO.setFree(availability.isFreeNow(room));
        roomDTO.setDays(room.getDays());
        roomDTO.setType(room.getType());
        roomDTO.setBeds(room.getBeds());
        roomDTO.setNumber(room.getNumber());
        roomDTO.setDescription(room.getDescription());
        roomDTO.setFloor(room.getFloor());
        roomDTO.setComments(room.getComments());
        roomDTO.setArea(room.getArea());
        roomDTO.setView(room.getView());
        roomDTO.setAmenities(new ArrayList<>(room.getAmenities()));
        roomDTO.setImages(room.getImages().stream()
                .map(image -> new RoomDTO.Image(image.getId(), imageUrl(image.getFileName())))
                .toList());

        if (room.getPhoto() != null && !room.getPhoto().isEmpty()) {
            roomDTO.setPhoto(imageUrl(room.getPhoto()));
        }
        return roomDTO;
    }

    private static String imageUrl(String fileName) {
        return "http://localhost:8080/img/hotel/" + fileName;
    }

    @GetMapping
    public ResponseEntity<?> getAllRooms(){
        List<RoomDTO> roomDTOs = roomRepository.findAll().stream().map(this::toDto).toList();
        return ResponseEntity.ok(roomDTOs);
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> getRoom(@PathVariable Long id){
        Room room = roomRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Номер не найден"));
        return ResponseEntity.ok(toDto(room));
    }

    /**
     * Номера, свободные на все ночи периода [from, to): дата выезда не включается, поэтому в день выезда
     * предыдущего гостя номер уже можно забронировать.
     */
    @GetMapping("/available")
    public ResponseEntity<?> getAvailableRooms(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        if (!to.isAfter(from)) {
            return ResponseEntity.badRequest().body(new ErrorResponse(true, "Дата выезда должна быть позже даты заезда"));
        }
        List<RoomDTO> free = roomRepository.findAll().stream()
                .filter(room -> !availability.isBusy(room, from, to, null))
                .map(this::toDto)
                .toList();
        return ResponseEntity.ok(free);
    }

    /** Занятые периоды номера для календаря бронирования (по умолчанию — на год вперёд). */
    @GetMapping("/{id}/busy")
    public ResponseEntity<?> getBusyPeriods(
            @PathVariable Long id,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        Room room = roomRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Номер не найден"));
        LocalDate start = from != null ? from : LocalDate.now();
        LocalDate end = to != null ? to : start.plusDays(366);
        List<BusyPeriodDTO> periods = availability.busyPeriods(room, start, end);
        return ResponseEntity.ok(periods);
    }

    /**
     * Бронирование номера на даты. Даты заезда и выезда задаются параметрами {@code startDate}/{@code endDate};
     * для обратной совместимости можно передать только {@code days}: проживание начинается сегодня.
     */
    @PostMapping("/{id}/createRent")
    @Transactional
    public ResponseEntity<?> createRent(
            @PathVariable Long id,
            @RequestParam(required = false) Integer days,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate
    ) {
        String currentUser = SecurityContextHolder.getContext().getAuthentication().getName();

        User user = userRepository.findByUsername(currentUser)
                .orElseThrow(() -> new RuntimeException("Пользователь не найден"));

        Room room = roomRepository.findByIdForUpdate(id)
                .orElseThrow(() -> new RuntimeException("Номер не найден"));

        LocalDate today = LocalDate.now();
        LocalDate start;
        LocalDate end;
        if (startDate == null && endDate == null) {
            if (days == null) {
                return bad("Укажите даты проживания");
            }
            start = today;
            end = today.plusDays(days);
        } else if (startDate == null || endDate == null) {
            return bad("Укажите обе даты: заезда и выезда");
        } else {
            start = startDate;
            end = endDate;
        }

        long nights = ChronoUnit.DAYS.between(start, end);
        if (start.isBefore(today)) {
            return bad("Дата заезда не может быть в прошлом");
        }
        if (nights < 1) {
            return bad("Дата выезда должна быть позже даты заезда");
        }
        if (nights > RoomAvailabilityService.MAX_NIGHTS) {
            return bad("Максимальный срок проживания – " + RoomAvailabilityService.MAX_NIGHTS + " суток");
        }
        if (availability.isBusy(room, start, end, null)) {
            return bad("Номер занят на выбранные даты, бронирование невозможно");
        }

        int totalCost = room.getPrice() * (int) nights;

        if (user.getBalance() < totalCost) {
            return bad("Недостаточно средств на балансе для бронирования");
        }

        Reservation reservation = Reservation.builder()
                .name(room.getName())
                .owner(currentUser)
                .photo(room.getPhoto())
                .description(room.getDescription())
                .status(ReservationStatus.WAITING)
                .number(room.getNumber())
                .price(totalCost)
                .days((int) nights)
                .startDate(start)
                .endDate(end)
                .type(room.getType())
                .beds(room.getBeds())
                .floor(room.getFloor())
                .room(room)
                .build();

        // номер занят «сейчас» только если проживание охватывает сегодняшнюю ночь
        if (!start.isAfter(today)) {
            room.setFree(false);
            roomRepository.save(room);
        }

        reservationRepository.save(reservation);
        log.info("Бронирование создано: ID={}, Статус={}, {} – {}", reservation.getId(), reservation.getStatus(), start, end);

        user.setBalance(user.getBalance() - totalCost);
        userRepository.save(user);

        Receipt receipt = Receipt.builder()
                .reservation(reservation)
                .user(user)
                .totalAmount(totalCost)
                .createdAt(LocalDateTime.now())
                .status("Оплачено")
                .build();

        receiptRepository.save(receipt);

        return ResponseEntity.ok(reservation);
    }

    private ResponseEntity<ErrorResponse> bad(String message) {
        return ResponseEntity.badRequest().body(new ErrorResponse(true, message));
    }

//    @PostMapping("/{id}/application") // http://localhost:8080/automobiles/1/application
//    public ResponseEntity<?> createReservation(@PathVariable Long id) {
//        String currentUser = SecurityContextHolder.getContext().getAuthentication().getName();
//        log.info("Current user: {}", currentUser);
//
//        Room room = roomRepository.findById(id)
//                .orElseThrow(() -> new RuntimeException("Номер не найден"));
//
//
//        Reservation reservation = Reservation.builder()
//                .price(automobile.getPrice())
//                .buyer(currentUser)
//                .titleAuto(automobile.getName())
//                .status(ApplicationStatus.WAITING)
//                .automobile(automobile)
//                .build();
//
//        reservationRepository.save(reservation);
//        return ResponseEntity.ok(application);
//    }

    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping(value = "/add", consumes = {"multipart/form-data"})
    @Transactional
    public ResponseEntity<?> addRoom(
            @RequestPart(value = "room") String roomJson,
            @RequestPart(value = "file", required = false) MultipartFile photo,
            @RequestPart(value = "files", required = false) List<MultipartFile> photos) {
        try {
            RoomDTO roomDTO = JSON.readValue(roomJson, RoomDTO.class);

            Room room = Room.builder()
                    .name(roomDTO.getName())
                    .photo("")
                    .price(roomDTO.getPrice())
                    .free(roomDTO.isFree())
                    .days(roomDTO.getDays())
                    .type(roomDTO.getType())
                    .beds(roomDTO.getBeds())
                    .number(roomDTO.getNumber())
                    .description(roomDTO.getDescription())
                    .floor(roomDTO.getFloor())
                    .area(roomDTO.getArea())
                    .view(blankToNull(roomDTO.getView()))
                    .build();
            room.getAmenities().addAll(media.cleanAmenities(roomDTO.getAmenities()));
            media.applyImages(room, null, media.store(uploads(photo, photos)));

            roomRepository.save(room);
            return ResponseEntity.ok(toDto(room));

        } catch (IOException | IllegalArgumentException e) {
            return bad("Ошибка загрузки фотографий: " + e.getMessage());
        }
    }


    @PreAuthorize("hasAnyRole('MANAGER', 'ADMIN')")
    @PutMapping("/{id}/edit")
    @Transactional
    public ResponseEntity<?> updateRoom(
            @PathVariable Long id,
            @RequestPart(value = "room", required = false) String roomJson,
            @RequestPart(value = "file", required = false) MultipartFile photo,
            @RequestPart(value = "files", required = false) List<MultipartFile> photos) {

        Room existingRoom = roomRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Номер не найден"));

        try {
            List<Long> imageOrder = null;

            if (roomJson != null && !roomJson.isEmpty()) {
                RoomDTO roomDTO = JSON.readValue(roomJson, RoomDTO.class);

                if (roomDTO.getName() != null) {
                    existingRoom.setName(roomDTO.getName());
                }
                if (roomDTO.getPrice() != 0) {
                    existingRoom.setPrice(roomDTO.getPrice());
                }
                if (roomDTO.getType() != null) {
                    existingRoom.setType(roomDTO.getType());
                }
                if (roomDTO.getBeds() != null) {
                    existingRoom.setBeds(roomDTO.getBeds());
                }
                if (roomDTO.getNumber() != 0) {
                    existingRoom.setNumber(roomDTO.getNumber());
                }
                if (roomDTO.getDescription() != null) {
                    existingRoom.setDescription(roomDTO.getDescription());
                }
                if (roomDTO.getFloor() != 0) {
                    existingRoom.setFloor(roomDTO.getFloor());
                }
                if (roomDTO.isFree() != existingRoom.isFree()) {
                    existingRoom.setFree(roomDTO.isFree());
                }
                if (roomDTO.getArea() != null) {
                    existingRoom.setArea(roomDTO.getArea() > 0 ? roomDTO.getArea() : null);
                }
                if (roomDTO.getView() != null) {
                    existingRoom.setView(blankToNull(roomDTO.getView()));
                }
                if (roomDTO.getAmenities() != null) {
                    existingRoom.getAmenities().clear();
                    existingRoom.getAmenities().addAll(media.cleanAmenities(roomDTO.getAmenities()));
                }
                imageOrder = roomDTO.getImageOrder();
            }

            media.applyImages(existingRoom, imageOrder, media.store(uploads(photo, photos)));
            roomRepository.save(existingRoom);

            return ResponseEntity.ok(toDto(existingRoom));

        } catch (IOException | IllegalArgumentException e) {
            return bad("Ошибка загрузки фотографий: " + e.getMessage());
        }
    }

    /** Загруженные файлы запроса: одиночное поле {@code file} (прежний формат) и список {@code files}. */
    private static List<MultipartFile> uploads(MultipartFile single, List<MultipartFile> many) {
        List<MultipartFile> all = new ArrayList<>();
        if (single != null) {
            all.add(single);
        }
        if (many != null) {
            all.addAll(many);
        }
        return all;
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    @PreAuthorize("hasAnyRole('ADMIN')")
    @DeleteMapping("/{id}/delete")
    public ResponseEntity<?> deleteRoom(@PathVariable Long id) {
        Room room = roomRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Номер не найдена"));

        roomRepository.delete(room);
        return ResponseEntity.ok("Номер удален");
    }


    @GetMapping("/searchRoom")
    public ResponseEntity<?> searchByName(@RequestParam String name){
        List<RoomDTO> roomDTOs = roomRepository.findByNameContaining(name).stream().map(this::toDto).toList();
        return ResponseEntity.ok(roomDTOs);
    }

}
