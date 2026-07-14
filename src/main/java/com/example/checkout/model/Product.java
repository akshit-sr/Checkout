package com.example.checkout.model;

import com.example.inventory.model.Supplier;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;

/**
 * The single product record shared by the storefront and the inventory back
 * office. {@code price}/{@code stockQuantity} are the customer-facing selling
 * price and available stock; {@code unitCost}, {@code lowStockThreshold} and
 * {@code supplier} are the warehouse fields managed in the inventory tab.
 * Legacy products created before the inventory fields existed simply leave them null.
 */
@Entity
@Table(name = "products")
@Getter
@Setter
@NoArgsConstructor
public class Product {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    // Not unique — duplicate SKUs are allowed.
    private String sku;

    @Column(length = 2000)
    private String description;

    // Customer-facing selling price.
    @Column(nullable = false)
    private BigDecimal price;

    // Available stock.
    @Column(nullable = false)
    private Integer stockQuantity;

    // --- Warehouse fields (managed in the inventory back office) ---
    private BigDecimal unitCost;

    // Per-product reorder threshold; falls back to the app-wide default if null.
    private Integer lowStockThreshold;

    @ManyToOne
    @JoinColumn(name = "supplier_id")
    private Supplier supplier;

    public boolean isLowStock(int defaultThreshold) {
        int threshold = lowStockThreshold != null ? lowStockThreshold : defaultThreshold;
        return stockQuantity != null && stockQuantity <= threshold;
    }
}
