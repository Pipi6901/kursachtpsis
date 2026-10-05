package com.HotelManager.controller;


import com.HotelManager.DTO.UserDTO;
import com.HotelManager.entity.Role;
import com.HotelManager.entity.User;
import com.HotelManager.exception.AppError;
import com.HotelManager.repo.UserRepository;
import com.HotelManager.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequiredArgsConstructor
@RequestMapping("/profile")
public class ProfileController {

    private final UserRepository userRepository;
    private final UserService userService;


    @Value("${upload.img}")
    protected String uploadImg;

    @GetMapping("/me")
    public ResponseEntity<?> getCurrentUser(){
        String currentUser = SecurityContextHolder.getContext().getAuthentication().getName();
        User user = userRepository.findByUsername(currentUser)
                .orElseThrow(() -> new RuntimeException("Пользователь не найден"));

        return ResponseEntity.ok(Map.of(
                "id", user.getId(),
                "username", user.getUsername(),
                "email", user.getEmail(),
                "name", user.getName(),
                "phone", user.getPhone(),
                "balance", user.getBalance(),
                "roles", user.getRoles().stream().map(Role::getName).collect(Collectors.toList())
        ));
    }

    @PutMapping("/edit")
    public ResponseEntity<?> editProfile(@RequestBody UserDTO userDTO){
        String currentUser = SecurityContextHolder.getContext().getAuthentication().getName();
        User user = userRepository.findByUsername(currentUser)
                .orElseThrow(() -> new RuntimeException("Пользователь не найден"));

        if (userDTO.getName() != null && !userDTO.getName().isEmpty()) {
            user.setName(userDTO.getName());
        }
        if (userDTO.getPhone() != null && !userDTO.getPhone().isEmpty()) {
            user.setPhone(userDTO.getPhone());
        }
        if (userService.findByEmail(userDTO.getEmail()).isPresent()){
            return new ResponseEntity<>(new AppError(HttpStatus.BAD_REQUEST.value(), "Пользователь с таким email уже существует"), HttpStatus.BAD_REQUEST);
        }
        if (userDTO.getEmail() != null && !userDTO.getEmail().isEmpty()) {
            user.setEmail(userDTO.getEmail());
        }

        userRepository.save(user);
        return ResponseEntity.ok(user);
    }


    @PutMapping("/topUpBalance")
    public ResponseEntity<?> topUpBalance(@RequestParam int balance){
        String currentUser = SecurityContextHolder.getContext().getAuthentication().getName();

        User user = userRepository.findByUsername(currentUser)
                .orElseThrow(()-> new RuntimeException("Пользователь не найден"));

        user.setBalance(balance);
        userRepository.save(user);

        UserDTO userDTO = new UserDTO();
        userDTO.setId(user.getId());
        userDTO.setUsername(user.getUsername());
        userDTO.setEmail(user.getEmail());
        userDTO.setName(user.getName());
        userDTO.setPhone(user.getPhone());
        userDTO.setBalance(user.getBalance());

        List<String> roles = user.getRoles().stream()
                .map(Role::getName)
                .collect(Collectors.toList());
        userDTO.setRoles(roles);

        return ResponseEntity.ok(userDTO);
    }

}