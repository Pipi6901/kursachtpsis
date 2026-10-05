package com.HotelManager.DTO;

import lombok.AllArgsConstructor;
import lombok.Data;
import org.springframework.core.SpringVersion;

@Data
@AllArgsConstructor
public class JwtRequest {

    private String username;
    private String password;
    private String email;
    private String name;
    private String phone;
}
