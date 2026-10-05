package com.HotelManager.DTO;

import com.HotelManager.entity.Role;
import lombok.AllArgsConstructor;
import lombok.Data;

import java.util.List;

@Data
@AllArgsConstructor
public class JwtResponse {
    private String token;
    private List<String> roles;
}
