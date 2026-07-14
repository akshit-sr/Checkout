package com.example.inventory.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

public class SupplierDtos {

    public record SupplierRequest(
            @NotBlank String name,
            @Email String contactEmail,
            String phone
    ) {}

    public record SupplierResponse(
            Long id,
            String name,
            String contactEmail,
            String phone
    ) {}
}
