package com.HotelManager.DTO;

import com.HotelManager.entity.Role;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@AllArgsConstructor
public class UserDTO {

    private Long id;
    private String username;
    private String email;
    private String name;
    private String phone;
    private int balance;
    private List<String> roles;

    public UserDTO() {

    }

    public UserDTO(Long id, String username, String email, String name, String phone, int balance) {
        this.id = id;
        this.username = username;
        this.email = email;
        this.name = name;
        this.phone = phone;
        this.balance = balance;
    }


}
