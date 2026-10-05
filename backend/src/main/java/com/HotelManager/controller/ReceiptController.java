package com.HotelManager.controller;

import com.HotelManager.DTO.ReceiptDTO;
import com.HotelManager.entity.Receipt;
import com.HotelManager.repo.ReceiptRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/receipts")
@RequiredArgsConstructor
public class ReceiptController {

    private final ReceiptRepository receiptRepository;

    @GetMapping("/reservation/{reservationId}")
    public ResponseEntity<ReceiptDTO> getReceiptByReservationId(@PathVariable Long reservationId) {
        Receipt receipt = receiptRepository.findByReservationId(reservationId)
                .orElseThrow(() -> new RuntimeException("Чек не найден"));

        ReceiptDTO receiptDTO = new ReceiptDTO();
        receiptDTO.setId(receipt.getId());
        receiptDTO.setUserName(receipt.getUser().getUsername());
        receiptDTO.setRoomName(receipt.getReservation().getRoom().getName());
        receiptDTO.setDays(receipt.getReservation().getDays());
        receiptDTO.setTotalAmount(receipt.getTotalAmount());
        receiptDTO.setCreatedAt(receipt.getCreatedAt());
        receiptDTO.setStatus(receipt.getStatus());

        return ResponseEntity.ok(receiptDTO);
    }
}
