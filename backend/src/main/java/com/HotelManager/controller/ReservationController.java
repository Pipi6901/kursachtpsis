package com.HotelManager.controller;

import com.HotelManager.DTO.ReservationResponseDTO;
import com.HotelManager.entity.Receipt;
import com.HotelManager.entity.Reservation;
import com.HotelManager.entity.Room;
import com.HotelManager.entity.User;
import com.HotelManager.entity.enums.ReservationStatus;
import com.HotelManager.repo.ReceiptRepository;
import com.HotelManager.repo.ReservationRepository;
import com.HotelManager.repo.RoomRepository;
import com.HotelManager.repo.UserRepository;
import com.HotelManager.service.RoomAvailabilityService;
import jakarta.transaction.Transactional; // Используем правильный импорт для Spring/Jakarta
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@RestController
@CrossOrigin(origins = "*")
@RequiredArgsConstructor
@RequestMapping("/reservations")
public class ReservationController {

    private final ReservationRepository reservationRepository;
    private final RoomRepository roomRepository;
    private final UserRepository userRepository;
    private final ReceiptRepository receiptRepository;
    private final RoomAvailabilityService availability;


    @GetMapping
    public ResponseEntity<?> getReservation() {
        String currentUser = SecurityContextHolder.getContext().getAuthentication().getName();

        User user = userRepository.findByUsername(currentUser)
                .orElseThrow(() -> new RuntimeException("Пользователь не найден"));

        List<String> roles = user.getRoles().stream()
                .map(role -> role.getName())
                .collect(Collectors.toList());

        List<Reservation> reservations;

        if (roles.contains("ROLE_ADMIN") || roles.contains("ROLE_MANAGER")) {
            // Администратор/Менеджер видят все активные и ожидающие брони
            reservations = reservationRepository.findAll().stream()
                    .filter(r -> r.getStatus() != ReservationStatus.REJECT)
                    .collect(Collectors.toList());
        } else if (roles.contains("ROLE_USER")) {
            // Пользователь видит свои активные и ожидающие брони
            reservations = reservationRepository.findByOwner(currentUser).stream()
                    .filter(r -> r.getStatus() != ReservationStatus.REJECT)
                    .collect(Collectors.toList());
        } else {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body("Нет доступа к заявкам");
        }

        List<ReservationResponseDTO> reservationDTOs = reservations.stream()
                .map(this::convertToDTO)
                .collect(Collectors.toList());

        return ResponseEntity.ok(reservationDTOs);
    }

    @PreAuthorize("hasRole('MANAGER')")
    @PostMapping("/{id}/confirm")
    @Transactional // Добавим @Transactional
    public ResponseEntity<?> confirmReservation(@PathVariable Long id) {
        Reservation reservation = reservationRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Бронирование не найдено"));

        if (reservation.getStatus() != ReservationStatus.WAITING) {
            return ResponseEntity.badRequest().body("Подтвердить можно только бронь в статусе «Ожидание».");
        }

        reservation.setStatus(ReservationStatus.DONE);
        reservationRepository.save(reservation);

        return ResponseEntity.ok(convertToDTO(reservation));
    }

    @PreAuthorize("hasRole('MANAGER')")
    @PostMapping("/{id}/reject")
    @Transactional // Добавим @Transactional
    public ResponseEntity<?> rejectReservation(@PathVariable Long id) {
        Reservation reservation = reservationRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Бронирование не найдено"));

        if (reservation.getStatus() == ReservationStatus.REJECT) {
            return ResponseEntity.badRequest().body("Бронирование уже отменено.");
        }
        if (reservation.getStatus() == ReservationStatus.COMPLETED) {
            return ResponseEntity.badRequest().body("Проживание завершено, отказать в брони нельзя.");
        }

        User user = userRepository.findByUsername(reservation.getOwner())
                .orElseThrow(() -> new RuntimeException("Пользователь не найден"));

        // Возвращаем полную стоимость бронирования: в поле price уже записана сумма за все сутки
        int totalCost = reservation.getPrice();
        user.setBalance(user.getBalance() + totalCost);
        userRepository.save(user);

        reservation.setStatus(ReservationStatus.REJECT);
        reservationRepository.save(reservation);
        releaseRoom(reservation);

        Receipt receipt = receiptRepository.findByReservationId(reservation.getId())
                .orElseThrow(() -> new RuntimeException("Чек не найден"));

        receipt.setStatus("Отменен");
        receiptRepository.save(receipt);

        return ResponseEntity.ok(convertToDTO(reservation));
    }

    @PreAuthorize("hasAnyRole('USER')")
    @PostMapping("/{id}/cancel")
    @Transactional
    public ResponseEntity<?> cancelReservation(@PathVariable Long id) {
        String currentUser = SecurityContextHolder.getContext().getAuthentication().getName();

        Reservation reservation = reservationRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Бронирование не найдено"));

        if (!reservation.getOwner().equals(currentUser)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body("Вы не можете отменить это бронирование");
        }

        User user = userRepository.findByUsername(reservation.getOwner())
                .orElseThrow(() -> new RuntimeException("Пользователь не найден"));

        if (reservation.getStatus() == ReservationStatus.COMPLETED) {
            return ResponseEntity.badRequest().body("Проживание завершено, отменить бронь нельзя.");
        }

        // Предполагается, что возвращается только цена
        int totalCost = reservation.getPrice();
        user.setBalance(user.getBalance() + totalCost);
        userRepository.save(user);

        receiptRepository.deleteByReservationId(id);
        reservationRepository.deleteById(id);
        releaseRoom(reservation);

        return ResponseEntity.ok("Бронь удалена");
    }


    @PreAuthorize("hasAnyRole('USER', 'MANAGER', 'ADMIN')")
    @PostMapping("/{id}/moveOut") // <-- ИСПРАВЛЕННЫЙ МЕТОД
    @Transactional
    public ResponseEntity<?> moveOut(@PathVariable Long id) {
        String currentUser = SecurityContextHolder.getContext().getAuthentication().getName();

        Reservation reservation = reservationRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Бронирование не найдено"));

        // Устанавливаем проверку для всех ролей, чтобы не мог выселить чужую бронь
        if (SecurityContextHolder.getContext().getAuthentication().getAuthorities().stream().noneMatch(a -> a.getAuthority().equals("ROLE_ADMIN") || a.getAuthority().equals("ROLE_MANAGER"))) {
            if (!reservation.getOwner().equals(currentUser)) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN).body("Ошибка выселения: Вы не являетесь владельцем этой брони.");
            }
        }


        // Выселить можно подтверждённую бронь, проживание по которой уже началось
        switch (reservation.getStatus()) {
            case COMPLETED -> {
                return ResponseEntity.badRequest().body("Выселение уже выполнено.");
            }
            case REJECT -> {
                return ResponseEntity.badRequest().body("Бронь отклонена, выселение невозможно.");
            }
            case WAITING -> {
                return ResponseEntity.badRequest().body("Бронь ещё не подтверждена менеджером.");
            }
            default -> { }
        }
        LocalDate start = availability.effectiveStart(reservation);
        LocalDate end = availability.effectiveEnd(reservation);
        if (start.isAfter(LocalDate.now())) {
            return ResponseEntity.badRequest().body("Проживание ещё не началось. Если планы изменились, отмените бронь.");
        }

        // 1. Проживание считается состоявшимся: бронь остаётся в базе и попадает в статистику и выручку
        reservation.setStartDate(start);
        reservation.setEndDate(end);
        reservation.setStatus(ReservationStatus.COMPLETED);
        reservation.setMovedOutAt(LocalDateTime.now());
        reservationRepository.save(reservation);

        // 2. Чек получает статус «Завершен» (выручка по такому чеку учитывается)
        Receipt receipt = receiptRepository.findByReservationId(id).orElse(null);
        if (receipt != null) {
            receipt.setStatus("Завершен");
            receiptRepository.save(receipt);
        }

        // 3. Освобождаем номер, если на сегодняшнюю ночь нет другой брони
        releaseRoom(reservation);

        return ResponseEntity.ok("Выселение успешно завершено!");
    }

    @PreAuthorize("hasAnyRole('USER', 'ADMIN')")
    @DeleteMapping("/{id}/delete")
    @Transactional
    public ResponseEntity<?> deleteReservation(@PathVariable Long id) {
        Reservation reservation = reservationRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Бронирование не найдено"));

        receiptRepository.deleteByReservationId(id);
        reservationRepository.deleteById(id);
        // освобождаем комнату, если она была занята этим бронированием (для предотвращения зависших броней)
        releaseRoom(reservation);

        return ResponseEntity.ok("Бронь удалена");
    }

    /** После выхода брони из числа активных пересчитывает, занят ли номер сегодняшней ночью другой бронью. */
    private void releaseRoom(Reservation reservation) {
        Room room = reservation.getRoom();
        if (room != null) {
            availability.refreshOccupancy(room, reservation.getId());
            roomRepository.save(room);
        }
    }

    private ReservationResponseDTO convertToDTO(Reservation reservation) {
        ReservationResponseDTO dto = new ReservationResponseDTO();
        dto.setId(reservation.getId());
        dto.setName(reservation.getName());
        dto.setPrice(reservation.getPrice());
        dto.setStatus(reservation.getStatus().name());
        dto.setOwner(reservation.getOwner());
        dto.setDays(reservation.getDays());
        dto.setStartDate(reservation.getStartDate());
        dto.setEndDate(reservation.getEndDate());
        dto.setMovedOutAt(reservation.getMovedOutAt());
        dto.setType(reservation.getType());
        dto.setBeds(reservation.getBeds());
        dto.setNumber(reservation.getNumber());
        dto.setDescription(reservation.getDescription());
        dto.setFloor(reservation.getFloor());

        Room room = reservation.getRoom();
        if (room != null) {
            dto.setRoomId(room.getId());
            dto.setRoomPrice(room.getPrice());

            if (room.getPhoto() != null && !room.getPhoto().isEmpty()) {
                dto.setPhoto("http://localhost:8080/img/hotel/" + room.getPhoto());
            }
        }

        // ВАЖНО: Проверка наличия чека, чтобы избежать ошибки при удаленном чеке
        Receipt receipt = receiptRepository.findByReservationId(reservation.getId()).orElse(null);
        if (receipt != null) {
            dto.setReceiptStatus(receipt.getStatus());
        } else {
            // Устанавливаем статус по умолчанию, если чек удален (например, после отмены)
            dto.setReceiptStatus("Удален/Нет");
        }

        return dto;
    }


}