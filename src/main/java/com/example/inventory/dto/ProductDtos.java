package com.example.inventory.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

public class ProductDtos {

    public record ProductRequest(
            @NotBlank String name,
            @NotBlank String sku,
            String description,
            // Selling price and stock are the storefront-facing NOT NULL columns.
            @NotNull @DecimalMin(value = "0.0", inclusive = false) BigDecimal sellingPrice,
            @NotNull @Min(0) Integer quantityInStock,
            Integer lowStockThreshold,
            @DecimalMin(value = "0.0", inclusive = false) BigDecimal unitCost,
            Long supplierId
    ) {}

    public record ProductResponse(
            Long id,
            String name,
            String sku,
            String description,
            BigDecimal sellingPrice,
            Integer quantityInStock,
            Integer lowStockThreshold,
            BigDecimal unitCost,
            String supplierName,
            boolean lowStock
    ) {}
}
