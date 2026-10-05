package com.HotelManager.service;

import com.HotelManager.entity.Role;
import com.HotelManager.repo.RoleRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.NoSuchElementException;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class RoleService {
    private final RoleRepository roleRepository;

    public Role getRole_User(){
        return getUserRole("ROLE_USER");
    }

    public Role getRole_Manager(){
        return getUserRole("ROLE_MANAGER");
    }

    public Role getUserRole(String roleName){
        return roleRepository.findByName(roleName)
                .orElseThrow(() -> new NoSuchElementException("Role '" + roleName + "' not found in database"));
    }


}