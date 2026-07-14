package com.example.checkout.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;

import java.math.BigDecimal;

public class ProductDtos {

    public record ProductRequest(
            @NotBlank String name,
            String description,
            @DecimalMin(value = "0.0", inclusive = false) BigDecimal price,
            @Min(0) Integer stockQuantity
    ) {}

    public record ProductResponse(
            Long id,
            String name,
            String description,
            BigDecimal price,
            Integer stockQuantity,
            String sku
    ) {}
}
