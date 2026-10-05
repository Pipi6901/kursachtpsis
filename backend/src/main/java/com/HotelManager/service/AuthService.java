package com.HotelManager.service;

import com.HotelManager.DTO.JwtRequest;
import com.HotelManager.DTO.JwtResponse;
import com.HotelManager.DTO.RegistrationUserDTO;
import com.HotelManager.DTO.UserDTO;
import com.HotelManager.entity.Role;
import com.HotelManager.entity.User;
import com.HotelManager.exception.AppError;
import com.HotelManager.repo.RoleRepository;
import com.HotelManager.repo.UserRepository;
import com.HotelManager.utils.JwtTokenUtils;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

import static org.apache.catalina.realm.UserDatabaseRealm.getRoles;

@Service
@RequiredArgsConstructor
@Slf4j
public class AuthService {
    private final UserRepository userRepository;
    private final JwtTokenUtils jwtTokenUtils;
    private final AuthenticationManager authenticationManager;
    private final UserService userService;
    private final RoleService roleService;
    private final RoleRepository roleRepository;


    public ResponseEntity<?> createAuthToken(JwtRequest authRequest) {
        try {
            authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(authRequest.getUsername(), authRequest.getPassword())
            );
        } catch (BadCredentialsException e) {
            return new ResponseEntity<>(new AppError(HttpStatus.UNAUTHORIZED.value(), "Неверный логин или пароль"), HttpStatus.UNAUTHORIZED);
        }
        User user = userRepository.findByUsername(authRequest.getUsername())
                .orElseThrow(() -> new RuntimeException("Пользователь не найден"));

        UserDetails userDetails = loadUserByUsername(authRequest.getUsername());
        String token = jwtTokenUtils.generateToken(userDetails);

        List<String> roles = user.getRoles().stream()
                .map(Role::getName)
                .collect(Collectors.toList());

        return ResponseEntity.ok(new JwtResponse(token, roles));
    }

    public ResponseEntity<?> createNewUser(RegistrationUserDTO registrationUserDTO) {
        if (userService.findByUsername(registrationUserDTO.getUsername()).isPresent() ||
                userService.findByEmail(registrationUserDTO.getEmail()).isPresent()) {
            return new ResponseEntity<>(new AppError(HttpStatus.BAD_REQUEST.value(), "Пользователь с указанными данными уже существует"), HttpStatus.BAD_REQUEST);
        }
        User user = userService.createNewUser(registrationUserDTO);

        return ResponseEntity.ok(new UserDTO(user.getId(), user.getUsername(), user.getEmail(), user.getName(), user.getPhone(), user.getBalance()));
    }

    public UserDetails loadUserByUsername(String username) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("Пользователь не найден"));

        List<SimpleGrantedAuthority> authorities = user.getRoles().stream()
                .map(role -> new SimpleGrantedAuthority(role.getName()))
                .collect(Collectors.toList());

        log.info("Роли в UserDetails (из loadUserByUsername): {}", authorities);

        return new org.springframework.security.core.userdetails.User(
                user.getUsername(),
                user.getPassword(),
                authorities
        );
    }

}