package com.HotelManager.DTO;


import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class RoomCommentResponseDTO {
    private Long id;
    private String text;
    private String author;
    private LocalDateTime createdAt;
}