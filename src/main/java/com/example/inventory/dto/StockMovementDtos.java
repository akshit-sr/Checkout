package com.example.inventory.dto;

import com.example.inventory.model.StockMovement.MovementType;
import jakarta.validation.constraints.NotNull;

import java.time.Instant;

public class StockMovementDtos {

    public record StockMovementRequest(
            @NotNull Long productId,
            @NotNull MovementType type,
            @NotNull Integer quantity, // always positive; direction comes from `type`
            String performedBy,
            String reason
    ) {}

    public record StockMovementResponse(
            Long id,
            Long productId,
            String productName,
            MovementType type,
            Integer quantityChanged,
            Integer resultingQuantity,
            String performedBy,
            String reason,
            Instant timestamp
    ) {}
}
