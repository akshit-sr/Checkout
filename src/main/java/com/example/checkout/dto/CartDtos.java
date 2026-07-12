package com.example.checkout.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.util.List;

public class CartDtos {

    public record AddItemRequest(
            @NotNull Long productId,
            @Min(1) Integer quantity
    ) {}

    public record SetQuantityRequest(
            @NotNull @Min(0) Integer quantity
    ) {}

    public record CartItemResponse(
            Long productId,
            String productName,
            Integer quantity,
            BigDecimal unitPrice,
            BigDecimal lineTotal
    ) {}

    public record CartResponse(
            Long cartId,
            List<CartItemResponse> items,
            BigDecimal total
    ) {}
}
