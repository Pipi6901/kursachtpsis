package com.HotelManager.controller;

import com.HotelManager.DTO.RoomCommentResponseDTO;
import com.HotelManager.entity.Room;
import com.HotelManager.entity.Comment;
import com.HotelManager.entity.User;
import com.HotelManager.repo.CommentRepository;
import com.HotelManager.repo.RoomRepository;
import com.HotelManager.repo.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/comments")
@RequiredArgsConstructor
public class CommentController {

    private final CommentRepository roomCommentRepository;
    private final RoomRepository roomRepository;
    private final UserRepository userRepository;

    // Получение всех комментариев для номера
    @GetMapping("/{roomId}")
    public ResponseEntity<List<RoomCommentResponseDTO>> getCommentsByRoom(@PathVariable Long roomId) {
        List<RoomCommentResponseDTO> comments = roomCommentRepository.findByRoomId(roomId)
                .stream()
                .map(comment -> new RoomCommentResponseDTO(comment.getId(), comment.getText(), comment.getAuthor(), comment.getCreatedAt()))
                .collect(Collectors.toList());
        return ResponseEntity.ok(comments);
    }

    // Добавление комментария
    @PostMapping("/{roomId}/add")
    @PreAuthorize("hasAnyRole('USER', 'ADMIN')")
    public ResponseEntity<?> addComment(@PathVariable Long roomId, @RequestBody Comment comment) {
        String username = SecurityContextHolder.getContext().getAuthentication().getName();
        Room room = roomRepository.findById(roomId)
                .orElseThrow(() -> new RuntimeException("Номер не найден"));

        comment.setAuthor(username);
        comment.setRoom(room);
        comment.setCreatedAt(LocalDateTime.now());

        Comment savedComment = roomCommentRepository.save(comment);

        RoomCommentResponseDTO responseDTO = new RoomCommentResponseDTO();
        responseDTO.setId(savedComment.getId());
        responseDTO.setText(savedComment.getText());
        responseDTO.setAuthor(savedComment.getAuthor());
        responseDTO.setCreatedAt(savedComment.getCreatedAt());

        return ResponseEntity.ok(responseDTO);
    }

    @DeleteMapping("/{commentId}/delete")
    @PreAuthorize("hasAnyRole('MANAGER')")
    public ResponseEntity<?> deleteComment(@PathVariable Long commentId) {
        Comment comment = roomCommentRepository.findById(commentId)
                .orElseThrow(() -> new RuntimeException("Комментарий не найден"));

        roomCommentRepository.delete(comment);
        return ResponseEntity.ok("Комментарий удален");
    }
}