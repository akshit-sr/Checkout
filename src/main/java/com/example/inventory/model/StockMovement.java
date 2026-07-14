package com.example.inventory.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

@Entity
@Table(name = "stock_movements")
@Getter
@Setter
@NoArgsConstructor
public class StockMovement {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "product_id", nullable = false)
    private com.example.checkout.model.Product product;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private MovementType type;

    @Column(nullable = false)
    private Integer quantityChanged; // positive for IN, negative for OUT

    @Column(nullable = false)
    private Integer resultingQuantity; // stock level after this movement

    // who/what triggered it — in a real app this would be a User reference
    private String performedBy;

    private String reason;

    @Column(nullable = false, updatable = false)
    private Instant timestamp = Instant.now();

    public enum MovementType {
        STOCK_IN, STOCK_OUT, ADJUSTMENT
    }
}
