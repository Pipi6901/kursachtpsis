package com.HotelManager.controller;

import com.HotelManager.DTO.UserDTO;
import com.HotelManager.repo.RoleRepository;
import com.HotelManager.repo.UserRepository;
import com.HotelManager.entity.User;
import com.HotelManager.entity.Role;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequiredArgsConstructor
@RequestMapping("/users")
public class UserController {

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;

    @PreAuthorize("hasRole('ADMIN')")
    @GetMapping
    public ResponseEntity<?> getAllUsers(){
        List<User> users = userRepository.findAll();

        List<UserDTO> userDTOs = users.stream().map(user -> {
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

            return userDTO;
        }).toList();
        return ResponseEntity.ok(userDTOs);
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> findByIdUser(@PathVariable Long id){
        User user = userRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("user not found"));

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

    @GetMapping("/searchUser")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> searchUser(@RequestParam String name){

        List<User> users = userRepository.findByNameContaining(name);

        List<UserDTO> userDTOs = users.stream().map(user -> {
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

            return userDTO;
        }).toList();

        return ResponseEntity.ok(userDTOs);
    }

    @PreAuthorize("hasRole('ADMIN')")
    @PutMapping("/editRole/{id}")
    public ResponseEntity<?> editRoleUser(@PathVariable Long id, @RequestParam String roleName){
        User user = userRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Пользователь не найден"));

        Role role = roleRepository.findByName(roleName)
                .orElseThrow(() -> new RuntimeException("Роль не найдена"));

        user.setRoles(new ArrayList<>(List.of(role)));

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

    @PreAuthorize("hasRole('ADMIN')")
    @DeleteMapping("/delete/{id}")
    public ResponseEntity<?> deleteUser(@PathVariable Long id){
        User user = userRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Пользователь не найден"));

        List<String> roles = user.getRoles().stream()
                .map(Role::getName)
                .collect(Collectors.toList());

        userRepository.delete(user);

        return ResponseEntity.ok(new UserDTO(
                user.getId(),
                user.getName(),
                user.getUsername(),
                user.getEmail(),
                user.getPhone(),
                user.getBalance(),
                roles
        ));
    }
}
