package com.HotelManager.DTO;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class RegistrationUserDTO {

    private String username;
    private String password;
    private String email;
    private String name;
    private String phone;
}
