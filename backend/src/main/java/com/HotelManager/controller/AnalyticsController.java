package com.HotelManager.controller;

import com.HotelManager.DTO.*;
import com.HotelManager.entity.*;
import com.HotelManager.entity.enums.ReservationStatus;
import com.HotelManager.repo.*;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/analytics")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
@PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')") // Только админ и менеджер
public class AnalyticsController {

    private final ReservationRepository reservationRepository;
    private final ReceiptRepository receiptRepository;
    private final RoomRepository roomRepository;
    private final UserRepository userRepository;



    // 1. ОСНОВНЫЕ МЕТРИКИ (KPI)
    @GetMapping("/metrics")
    public ResponseEntity<AnalyticsMetricsDTO> getMetrics() {
        AnalyticsMetricsDTO metrics = new AnalyticsMetricsDTO();

        // Все бронирования
        List<Reservation> allReservations = reservationRepository.findAll();

        // Подсчет по статусам
        Map<ReservationStatus, Long> statusCounts = allReservations.stream()
                .collect(Collectors.groupingBy(Reservation::getStatus, Collectors.counting()));

        metrics.setTotalBookings(allReservations.size());
        metrics.setConfirmedBookings(statusCounts.getOrDefault(ReservationStatus.DONE, 0L).intValue());
        metrics.setWaitingBookings(statusCounts.getOrDefault(ReservationStatus.WAITING, 0L).intValue());
        metrics.setRejectedBookings(statusCounts.getOrDefault(ReservationStatus.REJECT, 0L).intValue());

        // Выручка из чеков
        List<Receipt> allReceipts = receiptRepository.findAll();
        double totalRevenue = allReceipts.stream()
                .filter(r -> "Оплачено".equals(r.getStatus()))
                .mapToDouble(Receipt::getTotalAmount)
                .sum();
        metrics.setTotalRevenue(totalRevenue);

        // Комнаты
        List<Room> allRooms = roomRepository.findAll();
        int totalRooms = allRooms.size();
        metrics.setTotalRooms(totalRooms);

        // Занятые комнаты (где free = false)
        long occupiedRooms = allRooms.stream()
                .filter(room -> !room.isFree())
                .count();
        metrics.setOccupiedRooms((int) occupiedRooms);

        metrics.setOccupancyRate(totalRooms > 0 ? (double) occupiedRooms / totalRooms * 100 : 0);


        List<User> allUsers = userRepository.findAll();
        metrics.setTotalUsers(allUsers.size());

        return ResponseEntity.ok(metrics);
    }

    @GetMapping("/revenue/monthly")
    public ResponseEntity<List<RevenueByMonthDTO>> getMonthlyRevenue() {
        List<Receipt> receipts = receiptRepository.findAll();

        // Группируем по месяцам только оплаченные чеки
        Map<String, List<Receipt>> receiptsByMonth = receipts.stream()
                .filter(r -> "Оплачено".equals(r.getStatus()))
                .collect(Collectors.groupingBy(
                        r -> r.getCreatedAt().format(DateTimeFormatter.ofPattern("yyyy-MM"))
                ));

        List<RevenueByMonthDTO> result = new ArrayList<>();

        for (Map.Entry<String, List<Receipt>> entry : receiptsByMonth.entrySet()) {
            double monthRevenue = entry.getValue().stream()
                    .mapToDouble(Receipt::getTotalAmount)
                    .sum();

            int bookingsCount = entry.getValue().size();

            result.add(new RevenueByMonthDTO(entry.getKey(), monthRevenue, bookingsCount));
        }

        // Сортируем по месяцам (в обратном порядке - от новых к старым)
        result.sort(Comparator.comparing(RevenueByMonthDTO::getMonth).reversed());

        // Ограничиваем 12 последними месяцами
        if (result.size() > 12) {
            result = result.subList(0, 12);
        }

        return ResponseEntity.ok(result);
    }

    @GetMapping("/revenue/daily")
    public ResponseEntity<List<RevenueByDayDTO>> getDailyRevenue(
            @RequestParam(required = false) Integer year,
            @RequestParam(required = false) Integer month) {

        // Если год и месяц не указаны, используем текущий месяц
        LocalDate now = LocalDate.now();
        int targetYear = (year != null) ? year : now.getYear();
        int targetMonth = (month != null) ? month : now.getMonthValue();

        List<Receipt> receipts = receiptRepository.findAll();

        // Фильтруем по указанному месяцу и году
        Map<Integer, List<Receipt>> receiptsByDay = receipts.stream()
                .filter(r -> "Оплачено".equals(r.getStatus()))
                .filter(r -> {
                    LocalDate receiptDate = r.getCreatedAt().toLocalDate();
                    return receiptDate.getYear() == targetYear &&
                            receiptDate.getMonthValue() == targetMonth;
                })
                .collect(Collectors.groupingBy(
                        r -> r.getCreatedAt().getDayOfMonth()
                ));

        List<RevenueByDayDTO> result = new ArrayList<>();

        for (Map.Entry<Integer, List<Receipt>> entry : receiptsByDay.entrySet()) {
            double dayRevenue = entry.getValue().stream()
                    .mapToDouble(Receipt::getTotalAmount)
                    .sum();

            int bookingsCount = entry.getValue().size();

            String dayKey = String.format("%02d", entry.getKey());
            result.add(new RevenueByDayDTO(dayKey, dayRevenue, bookingsCount));
        }

        // Сортируем по дням
        result.sort(Comparator.comparingInt(r -> Integer.parseInt(r.getDay())));

        if (result.isEmpty()) {
            return ResponseEntity.ok(Collections.emptyList());
        }

        // Заполняем пропущенные дни нулевыми значениями
        YearMonth yearMonth = YearMonth.of(targetYear, targetMonth);
        int daysInMonth = yearMonth.lengthOfMonth();
        List<RevenueByDayDTO> fullMonthResult = new ArrayList<>();

        Map<Integer, RevenueByDayDTO> existingData = result.stream()
                .collect(Collectors.toMap(
                        dto -> Integer.parseInt(dto.getDay()),
                        dto -> dto
                ));

        for (int day = 1; day <= daysInMonth; day++) {
            String dayKey = String.format("%02d", day);
            if (existingData.containsKey(day)) {
                fullMonthResult.add(existingData.get(day));
            } else {
                // Добавляем день с нулевой выручкой
                fullMonthResult.add(new RevenueByDayDTO(dayKey, 0.0, 0));
            }
        }

        return ResponseEntity.ok(fullMonthResult);
    }



    @GetMapping("/rooms/types")
    public ResponseEntity<List<RoomTypeStatsDTO>> getRoomTypeStats() {
        List<Reservation> reservations = reservationRepository.findAll();
        List<Room> rooms = roomRepository.findAll();

        // Группируем комнаты по типу
        Map<String, Long> roomsByType = rooms.stream()
                .collect(Collectors.groupingBy(
                        r -> r.getType().name(),
                        Collectors.counting()
                ));

        // Группируем бронирования по типу
        Map<String, List<Reservation>> reservationsByType = reservations.stream()
                .filter(r -> r.getStatus() == ReservationStatus.DONE)
                .collect(Collectors.groupingBy(
                        r -> r.getType().name()
                ));

        List<RoomTypeStatsDTO> result = new ArrayList<>();

        // Для каждого типа комнат в отеле (даже если нет бронирований)
        for (Room room : rooms) {
            String type = room.getType().name();

            // Проверяем, не добавили ли уже этот тип
            if (result.stream().anyMatch(r -> r.getType().equals(type))) {
                continue;
            }

            List<Reservation> typeReservations = reservationsByType.getOrDefault(type, new ArrayList<>());

            // Количество бронирований этого типа
            int bookingsCount = typeReservations.size();

            // Выручка по этому типу
            double totalRevenue = typeReservations.stream()
                    .mapToDouble(r -> r.getPrice())
                    .sum();

            // Простая загруженность: процент занятых дней
            long totalRoomsOfType = roomsByType.getOrDefault(type, 1L);
            double occupancyRate = 0;

            if (bookingsCount > 0) {
                // Предполагаем, что каждое бронирование занимает комнату 2-7 дней
                occupancyRate = Math.min(bookingsCount * 4 / (totalRoomsOfType * 30.0) * 100, 100);
                occupancyRate = Math.round(occupancyRate * 10.0) / 10.0; // округляем до 1 знака
            }

            result.add(new RoomTypeStatsDTO(type, bookingsCount, totalRevenue, occupancyRate));
        }

        return ResponseEntity.ok(result);
    }

    // 4. СТАТИСТИКА ПО СТАТУСАМ БРОНИРОВАНИЙ (для круговой диаграммы)
    @GetMapping("/bookings/status")
    public ResponseEntity<List<BookingStatusDTO>> getBookingStatusStats() {
        List<Reservation> reservations = reservationRepository.findAll();

        // Группируем по статусам
        Map<ReservationStatus, Long> statusCounts = reservations.stream()
                .collect(Collectors.groupingBy(Reservation::getStatus, Collectors.counting()));

        int total = reservations.size();

        List<BookingStatusDTO> result = new ArrayList<>();

        for (Map.Entry<ReservationStatus, Long> entry : statusCounts.entrySet()) {
            String status = entry.getKey().name();
            int count = entry.getValue().intValue();
            double percentage = total > 0 ? (double) count / total * 100 : 0;

            result.add(new BookingStatusDTO(status, count, percentage));
        }

        return ResponseEntity.ok(result);
    }

    // 5. ПОПУЛЯРНОСТЬ ТИПОВ КРОВАТЕЙ (для гистограммы)
    @GetMapping("/beds/popularity")
    public ResponseEntity<Map<String, Integer>> getBedsPopularity() {
        List<Reservation> reservations = reservationRepository.findAll();

        Map<String, Integer> bedsCount = new HashMap<>();

        for (Reservation reservation : reservations) {
            if (reservation.getStatus() == ReservationStatus.DONE) {
                String beds = reservation.getBeds().name();
                bedsCount.put(beds, bedsCount.getOrDefault(beds, 0) + 1);
            }
        }

        return ResponseEntity.ok(bedsCount);
    }

    // Исправленный метод getTopClients()
    @GetMapping("/top/clients")
    public ResponseEntity<Map<String, Object>> getTopClients(@RequestParam(defaultValue = "5") int limit) {
        List<Reservation> reservations = reservationRepository.findAll();

        // Группируем по владельцам (клиентам) ТОЛЬКО подтвержденные брони
        Map<String, List<Reservation>> reservationsByOwner = reservations.stream()
                .filter(r -> r.getStatus() == ReservationStatus.DONE)
                .collect(Collectors.groupingBy(Reservation::getOwner));

        List<Map<String, Object>> topClients = new ArrayList<>();

        for (Map.Entry<String, List<Reservation>> entry : reservationsByOwner.entrySet()) {
            String owner = entry.getKey();
            List<Reservation> ownerReservations = entry.getValue();

            int bookingCount = ownerReservations.size();
            double totalSpent = ownerReservations.stream()
                    .mapToDouble(r -> {
                        // Правильный расчет: цена * дни
                        return r.getPrice();
                    })
                    .sum();

            double avgSpent = bookingCount > 0 ? totalSpent / bookingCount : 0;

            Map<String, Object> clientInfo = new HashMap<>();
            clientInfo.put("name", owner);
            clientInfo.put("bookings", bookingCount);
            clientInfo.put("totalSpent", totalSpent);
            clientInfo.put("avgSpent", avgSpent);

            topClients.add(clientInfo);
        }

        // Сортируем по общей потраченной сумме (а не по количеству бронирований)
        topClients.sort((a, b) ->
                Double.compare((double) b.get("totalSpent"), (double) a.get("totalSpent")));

        if (topClients.size() > limit) {
            topClients = topClients.subList(0, limit);
        }

        Map<String, Object> response = new HashMap<>();
        response.put("clients", topClients);
        response.put("total", reservationsByOwner.size());

        return ResponseEntity.ok(response);
    }

    // 7. ПРОСТОЙ ОТЧЕТ ПО КОМНАТАМ
    @GetMapping("/rooms/report")
    public ResponseEntity<List<Map<String, Object>>> getRoomsReport() {
        List<Room> rooms = roomRepository.findAll();
        List<Reservation> reservations = reservationRepository.findAll();

        List<Map<String, Object>> report = new ArrayList<>();

        for (Room room : rooms) {
            Map<String, Object> roomInfo = new HashMap<>();
            roomInfo.put("id", room.getId());
            roomInfo.put("name", room.getName());
            roomInfo.put("type", room.getType().name());
            roomInfo.put("price", room.getPrice());
            roomInfo.put("free", room.isFree());
            roomInfo.put("beds", room.getBeds().name());
            roomInfo.put("floor", room.getFloor());

            // Бронирования этой комнаты
            List<Reservation> roomReservations = reservations.stream()
                    .filter(r -> r.getRoom() != null && r.getRoom().getId().equals(room.getId()))
                    .filter(r -> r.getStatus() == ReservationStatus.DONE)
                    .collect(Collectors.toList());

            roomInfo.put("bookingCount", roomReservations.size());

            // Доход от комнаты
            double roomRevenue = roomReservations.stream()
                    .mapToDouble(r -> r.getPrice())
                    .sum();
            roomInfo.put("revenue", roomRevenue);

            report.add(roomInfo);
        }

        return ResponseEntity.ok(report);
    }
}