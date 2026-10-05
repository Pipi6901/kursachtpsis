package com.HotelManager.controller;

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
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
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

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

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

    @Value("${upload.img}")
    protected String uploadImg;

    @GetMapping
    public ResponseEntity<?> getAllRooms(){
        List<Room> rooms = roomRepository.findAll();

        List<RoomDTO> roomDTOs = rooms.stream().map(room -> {
            RoomDTO roomDTO = new RoomDTO();
            roomDTO.setId(room.getId());
            roomDTO.setName(room.getName());
            roomDTO.setPrice(room.getPrice());
            roomDTO.setFree(room.isFree());
            roomDTO.setDays(room.getDays());
            roomDTO.setType(room.getType());
            roomDTO.setBeds(room.getBeds());
            roomDTO.setNumber(room.getNumber());
            roomDTO.setDescription(room.getDescription());
            roomDTO.setFloor(room.getFloor());
            roomDTO.setComments(room.getComments());

            if (room.getPhoto() != null && !room.getPhoto().isEmpty()) {
                roomDTO.setPhoto("http://localhost:8080/img/hotel/" + room.getPhoto());
            }

            return roomDTO;
        }).toList();

        return ResponseEntity.ok(roomDTOs);
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> getRoom(@PathVariable Long id){
        Room room = roomRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Номер не найден"));

        RoomDTO roomDTO = new RoomDTO();
        roomDTO.setId(room.getId());
        roomDTO.setName(room.getName());
        roomDTO.setPrice(room.getPrice());
        roomDTO.setFree(room.isFree());
        roomDTO.setDays(room.getDays());
        roomDTO.setType(room.getType());
        roomDTO.setBeds(room.getBeds());
        roomDTO.setNumber(room.getNumber());
        roomDTO.setDescription(room.getDescription());
        roomDTO.setFloor(room.getFloor());
        roomDTO.setComments(room.getComments());

        if (room.getPhoto() != null && !room.getPhoto().isEmpty()) {
            roomDTO.setPhoto("http://localhost:8080/img/hotel/" + room.getPhoto());
        }

        return ResponseEntity.ok(roomDTO);
    }

    @PostMapping("/{id}/createRent")
    public ResponseEntity<?> createRent(
            @PathVariable Long id,
            @RequestParam int days
    ) {
        String currentUser = SecurityContextHolder.getContext().getAuthentication().getName();

        User user = userRepository.findByUsername(currentUser)
                .orElseThrow(() -> new RuntimeException("Пользователь не найден"));

        Room room = roomRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Номер не найден"));

        if (!room.isFree()) {
            return ResponseEntity
                    .badRequest()
                    .body(new ErrorResponse(
                            true,
                            "Номер уже занят, бронирование невозможно"
                    ));
        }

        int totalCost = room.getPrice() * days;

        if (user.getBalance() < totalCost) {
            return ResponseEntity
                    .badRequest()
                    .body(new ErrorResponse(
                            true,
                            "Недостаточно средств на балансе для бронирования"
                    ));
        }

        Reservation reservation = Reservation.builder()
                .name(room.getName())
                .owner(currentUser)
                .photo(room.getPhoto())
                .description(room.getDescription())
                .status(ReservationStatus.WAITING)
                .number(room.getNumber())
                .price(totalCost)
                .days(days)
                .type(room.getType())
                .beds(room.getBeds())
                .floor(room.getFloor())
                .room(room)
                .build();

        room.setFree(false);
        roomRepository.save(room);

        reservationRepository.save(reservation);
        log.info("Бронирование создано: ID={}, Статус={}", reservation.getId(), reservation.getStatus());

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
    public ResponseEntity<?> addRoom(
            @RequestPart(value = "room") String roomJson,
            @RequestPart(value = "file", required = false) MultipartFile photo) {

        String resultPhoto = "";
        try {
            if (photo != null && !Objects.requireNonNull(photo.getOriginalFilename()).isEmpty()) {
                String uuidFile = UUID.randomUUID().toString();
                String fileName = uuidFile + "_" + photo.getOriginalFilename();

                Path uploadPath = Paths.get(uploadImg);
                if (!Files.exists(uploadPath)) {
                    Files.createDirectories(uploadPath);
                }

                Path filePath = uploadPath.resolve(fileName);
                Files.copy(photo.getInputStream(), filePath, StandardCopyOption.REPLACE_EXISTING);

                resultPhoto = fileName;
            }

            ObjectMapper objectMapper = new ObjectMapper();
            objectMapper.configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);
            RoomDTO roomDTO = objectMapper.readValue(roomJson, RoomDTO.class);

            Room room = Room.builder()
                    .name(roomDTO.getName())
                    .photo(resultPhoto)
                    .price(roomDTO.getPrice())
                    .free(roomDTO.isFree())
                    .days(roomDTO.getDays())
                    .type(roomDTO.getType())
                    .beds(roomDTO.getBeds())
                    .number(roomDTO.getNumber())
                    .description(roomDTO.getDescription())
                    .floor(roomDTO.getFloor())
                    .build();

            roomRepository.save(room);
            return ResponseEntity.ok(room);

        } catch (IOException e) {
            return ResponseEntity.badRequest().body("Ошибка загрузки фотографии: " + e.getMessage());
        }
    }


    @PreAuthorize("hasAnyRole('MANAGER', 'ADMIN')")
    @PutMapping("/{id}/edit")
    public ResponseEntity<?> updateRoom(
            @PathVariable Long id,
            @RequestPart(value = "room", required = false) String roomJson,
            @RequestPart(value = "file", required = false) MultipartFile photo) {

        Room existingRoom = roomRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Номер не найден"));

        try {
            ObjectMapper objectMapper = new ObjectMapper();
            objectMapper.configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);

            if (roomJson != null && !roomJson.isEmpty()) {
                RoomDTO roomDTO = objectMapper.readValue(roomJson, RoomDTO.class);

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
            }

            String resultPhoto = existingRoom.getPhoto();
            if (photo != null && !photo.isEmpty()) {
                String uuidFile = UUID.randomUUID().toString();
                String fileName = uuidFile + "_" + photo.getOriginalFilename();

                Path uploadPath = Paths.get(uploadImg);
                if (!Files.exists(uploadPath)) {
                    Files.createDirectories(uploadPath);
                }

                Path filePath = uploadPath.resolve(fileName);
                Files.copy(photo.getInputStream(), filePath, StandardCopyOption.REPLACE_EXISTING);

                resultPhoto = fileName;
            }

            existingRoom.setPhoto(resultPhoto);
            roomRepository.save(existingRoom);

            return ResponseEntity.ok(existingRoom);

        } catch (IOException e) {
            return ResponseEntity.badRequest().body("Ошибка загрузки фотографии: " + e.getMessage());
        }
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
        List<Room> rooms = roomRepository.findByNameContaining(name);

        List<RoomDTO> roomDTOs = rooms.stream().map(room -> {
            RoomDTO roomDTO = new RoomDTO();
            roomDTO.setId(room.getId());
            roomDTO.setName(room.getName());
            roomDTO.setPrice(room.getPrice());
            roomDTO.setFree(room.isFree());
            roomDTO.setDays(room.getDays());
            roomDTO.setType(room.getType());
            roomDTO.setBeds(room.getBeds());
            roomDTO.setNumber(room.getNumber());
            roomDTO.setDescription(room.getDescription());
            roomDTO.setFloor(room.getFloor());
            roomDTO.setComments(room.getComments());

            if (room.getPhoto() != null && !room.getPhoto().isEmpty()) {
                roomDTO.setPhoto("http://localhost:8080/img/hotel/" + room.getPhoto());
            }

            return roomDTO;
        }).toList();

        return ResponseEntity.ok(roomDTOs);
    }



}
