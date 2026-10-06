package com.HotelManager.service;

import com.HotelManager.DTO.BusyPeriodDTO;
import com.HotelManager.entity.Receipt;
import com.HotelManager.entity.Reservation;
import com.HotelManager.entity.Room;
import com.HotelManager.entity.enums.ReservationStatus;
import com.HotelManager.repo.ReceiptRepository;
import com.HotelManager.repo.ReservationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.Comparator;
import java.util.EnumSet;
import java.util.List;
import java.util.Set;

/**
 * Занятость номеров по датам.
 *
 * <p>Проживание описывается полуинтервалом [заезд, выезд): ночь даты выезда уже свободна, поэтому следующий гость
 * может заехать в день выезда предыдущего. Брони, созданные до появления календаря, дат не имеют: для них заезд
 * берётся из даты чека, выезд — заезд плюс число суток.
 */
@Service
@RequiredArgsConstructor
public class RoomAvailabilityService {

    /** Брони, которые занимают номер: ожидают подтверждения или подтверждены. */
    public static final Set<ReservationStatus> ACTIVE = EnumSet.of(ReservationStatus.WAITING, ReservationStatus.DONE);

    /** Состоявшиеся проживания: попадают в статистику и выручку. Выселение переводит бронь из DONE в COMPLETED. */
    public static final Set<ReservationStatus> LIVED = EnumSet.of(ReservationStatus.DONE, ReservationStatus.COMPLETED);

    public static final int MAX_NIGHTS = 100;

    private final ReservationRepository reservationRepository;
    private final ReceiptRepository receiptRepository;

    // ------------------------------------------------------------------------------------------ даты брони

    public LocalDate effectiveStart(Reservation r) {
        if (r.getStartDate() != null) {
            return r.getStartDate();
        }
        return receiptRepository.findByReservationId(r.getId())
                .map(Receipt::getCreatedAt)
                .map(t -> t.toLocalDate())
                .orElse(LocalDate.now());
    }

    public LocalDate effectiveEnd(Reservation r) {
        if (r.getEndDate() != null) {
            return r.getEndDate();
        }
        return effectiveStart(r).plusDays(Math.max(r.getDays(), 1));
    }

    // ------------------------------------------------------------------------------------------ занятость

    public List<Reservation> activeReservations(Long roomId) {
        return reservationRepository.findByRoomIdAndStatusIn(roomId, ACTIVE);
    }

    private boolean overlaps(Reservation r, LocalDate from, LocalDate to) {
        return effectiveStart(r).isBefore(to) && from.isBefore(effectiveEnd(r));
    }

    /** Есть ли активная бронь, которая занимает номер сегодняшней ночью. */
    public boolean coversToday(Room room, Long ignoreReservationId) {
        LocalDate today = LocalDate.now();
        return activeReservations(room.getId()).stream()
                .filter(r -> !r.getId().equals(ignoreReservationId))
                .anyMatch(r -> overlaps(r, today, today.plusDays(1)));
    }

    /**
     * Занят ли номер хотя бы одну ночь периода [from, to). Номер, помеченный занятым вручную (или бронью старого
     * образца, срок которой истёк, но гость не выселен), считается занятым в течение сегодняшней ночи.
     */
    public boolean isBusy(Room room, LocalDate from, LocalDate to, Long ignoreReservationId) {
        List<Reservation> active = activeReservations(room.getId());
        for (Reservation r : active) {
            if (r.getId().equals(ignoreReservationId)) {
                continue;
            }
            if (overlaps(r, from, to)) {
                return true;
            }
        }
        LocalDate today = LocalDate.now();
        return !room.isFree() && !from.isAfter(today) && today.isBefore(to);
    }

    /** Свободен ли номер прямо сейчас: признак номера и отсутствие брони на сегодняшнюю ночь. */
    public boolean isFreeNow(Room room) {
        return room.isFree() && !coversToday(room, null);
    }

    /** Пересчитывает признак «свободен» после отмены брони, отказа, выселения или удаления. */
    public void refreshOccupancy(Room room, Long leavingReservationId) {
        room.setFree(!coversToday(room, leavingReservationId));
    }

    /** Периоды занятости номера, которые заканчиваются после {@code from}; без сведений о гостях. */
    public List<BusyPeriodDTO> busyPeriods(Room room, LocalDate from, LocalDate to) {
        return activeReservations(room.getId()).stream()
                .filter(r -> overlaps(r, from, to))
                .map(r -> new BusyPeriodDTO(effectiveStart(r), effectiveEnd(r)))
                .sorted(Comparator.comparing(BusyPeriodDTO::getFrom))
                .toList();
    }
}
