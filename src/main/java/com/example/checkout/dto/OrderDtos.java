package com.example.checkout.dto;

import com.example.checkout.model.Order.OrderStatus;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

public class OrderDtos {

    public record OrderItemResponse(
            Long productId,
            String productName,
            Integer quantity,
            BigDecimal unitPriceAtPurchase
    ) {}

    public record OrderResponse(
            Long id,
            String customerEmail,
            List<OrderItemResponse> items,
            BigDecimal totalAmount,
            OrderStatus status,
            Instant createdAt
    ) {}

    public record UpdateStatusRequest(OrderStatus status) {}
}
