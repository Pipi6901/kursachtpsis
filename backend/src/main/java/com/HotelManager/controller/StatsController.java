package com.HotelManager.controller;

import com.HotelManager.DTO.statsDTO.LengthOfStayAnalysisDTO;
import com.HotelManager.DTO.statsDTO.PopProfitRatingDTO;
import com.HotelManager.DTO.RoomStatsDTO;
import com.HotelManager.entity.Reservation;
import com.HotelManager.entity.enums.ReservationStatus;
import com.HotelManager.repo.ReservationRepository;
import com.HotelManager.repo.RoomRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Comparator;
import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/stats")
@RequiredArgsConstructor
public class StatsController {

    private final ReservationRepository reservationRepository;
    private final RoomRepository roomRepository;

    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<PopProfitRatingDTO> getStatistics() {
        List<Reservation> reservations = reservationRepository.findAll();

        int totalIncome = reservations.stream()
                .filter(reservation -> reservation.getStatus() == ReservationStatus.DONE)
                .mapToInt(reservation -> reservation.getDays() * reservation.getRoom().getPrice())
                .sum();

        List<RoomStatsDTO> topRoomsByIncome = reservations.stream()
                .filter(reservation -> reservation.getStatus() == ReservationStatus.DONE)
                .collect(Collectors.groupingBy(reservation -> reservation.getRoom()))
                .entrySet().stream()
                .map(entry -> new RoomStatsDTO(
                        entry.getKey().getName(),
                        entry.getValue().stream()
                                .mapToInt(reservation -> reservation.getDays() * reservation.getRoom().getPrice())
                                .sum()))
                .sorted(Comparator.comparingInt(RoomStatsDTO::getIncome).reversed())
                .limit(5)
                .collect(Collectors.toList());

        List<RoomStatsDTO> topRoomsByBookings = reservations.stream()
                .filter(reservation -> reservation.getStatus() == ReservationStatus.DONE)
                .collect(Collectors.groupingBy(reservation -> reservation.getRoom()))
                .entrySet().stream()
                .map(entry -> new RoomStatsDTO(
                        entry.getKey().getName(),
                        entry.getValue().size()))
                .sorted(Comparator.comparingInt(RoomStatsDTO::getIncome).reversed())
                .limit(5)
                .collect(Collectors.toList());

        PopProfitRatingDTO popProfitRatingDTO = new PopProfitRatingDTO();
        popProfitRatingDTO.setTotalIncome(totalIncome);
        popProfitRatingDTO.setTopRoomsByIncome(topRoomsByIncome);
        popProfitRatingDTO.setTopRoomsByBookings(topRoomsByBookings);

        return ResponseEntity.ok(popProfitRatingDTO);
    }

    @GetMapping("/lenght-of-stay")
    public ResponseEntity<LengthOfStayAnalysisDTO> getLenghtOfStay() {
        List<Reservation> reservations = reservationRepository.findAll();

        int OneThree = (int) reservations.stream()
                .filter(reservation -> reservation.getDays() <= 3)
                .count();

        int FourSix = (int) reservations.stream()
                .filter(reservation -> reservation.getDays() >= 4 && reservation.getDays() <= 6)
                .count();

        int SevenNine = (int) reservations.stream()
                .filter(reservation -> reservation.getDays() >= 7 && reservation.getDays() <= 9)
                .count();

        int TenAndMore = (int) reservations.stream()
                .filter(reservation -> reservation.getDays() >= 10)
                .count();

        LengthOfStayAnalysisDTO lengthOfStayAnalysisDTO = new LengthOfStayAnalysisDTO();
        lengthOfStayAnalysisDTO.setOneThree(OneThree);
        lengthOfStayAnalysisDTO.setFourSix(FourSix);
        lengthOfStayAnalysisDTO.setSevenNine(SevenNine);
        lengthOfStayAnalysisDTO.setTenAndMore(TenAndMore);

        return ResponseEntity.ok(lengthOfStayAnalysisDTO);
    }
}