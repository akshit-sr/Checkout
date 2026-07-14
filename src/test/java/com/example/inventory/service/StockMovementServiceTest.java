package com.example.inventory.service;

import com.example.checkout.model.Product;
import com.example.checkout.service.ProductStreamService;
import com.example.inventory.dto.StockMovementDtos.StockMovementRequest;
import com.example.inventory.exception.ApiException;
import com.example.inventory.model.StockMovement;
import com.example.inventory.model.StockMovement.MovementType;
import com.example.inventory.repository.StockMovementRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class StockMovementServiceTest {

    @Mock private StockMovementRepository stockMovementRepository;
    @Mock private InventoryProductService productService;
    @Mock private ProductStreamService productStreamService;

    @InjectMocks
    private StockMovementService stockMovementService;

    private Product product;

    @BeforeEach
    void setUp() {
        product = new Product();
        product.setId(1L);
        product.setName("Widget");
        product.setSku("WID-001");
        product.setStockQuantity(20);
        product.setUnitCost(BigDecimal.valueOf(5));
    }

    @Test
    void stockIn_increasesQuantityAndLogsMovement() {
        when(productService.findOrThrow(1L)).thenReturn(product);
        when(productService.save(any(Product.class))).thenAnswer(inv -> inv.getArgument(0));
        when(stockMovementRepository.save(any(StockMovement.class))).thenAnswer(inv -> inv.getArgument(0));

        var request = new StockMovementRequest(1L, MovementType.STOCK_IN, 15, "manager1", "Restock");
        var response = stockMovementService.recordMovement(request);

        assertEquals(35, response.resultingQuantity());
        assertEquals(15, response.quantityChanged());
        assertEquals(35, product.getStockQuantity());
        verify(stockMovementRepository).save(any(StockMovement.class));
    }

    @Test
    void stockOut_decreasesQuantity() {
        when(productService.findOrThrow(1L)).thenReturn(product);
        when(productService.save(any(Product.class))).thenAnswer(inv -> inv.getArgument(0));
        when(stockMovementRepository.save(any(StockMovement.class))).thenAnswer(inv -> inv.getArgument(0));

        var request = new StockMovementRequest(1L, MovementType.STOCK_OUT, 5, "warehouse1", "Order fulfillment");
        var response = stockMovementService.recordMovement(request);

        assertEquals(15, response.resultingQuantity());
        assertEquals(-5, response.quantityChanged());
    }

    @Test
    void stockOut_rejectsMovementThatWouldGoNegative() {
        when(productService.findOrThrow(1L)).thenReturn(product);

        var request = new StockMovementRequest(1L, MovementType.STOCK_OUT, 999, "warehouse1", "Bad request");

        ApiException ex = assertThrows(ApiException.class,
                () -> stockMovementService.recordMovement(request));

        assertTrue(ex.getMessage().contains("negative stock"));
        verify(stockMovementRepository, never()).save(any());
    }

    @Test
    void adjustment_appliesSignedDeltaDirectly() {
        when(productService.findOrThrow(1L)).thenReturn(product);
        when(productService.save(any(Product.class))).thenAnswer(inv -> inv.getArgument(0));
        when(stockMovementRepository.save(any(StockMovement.class))).thenAnswer(inv -> inv.getArgument(0));

        // negative adjustment, e.g. correcting a miscount
        var request = new StockMovementRequest(1L, MovementType.ADJUSTMENT, -3, "auditor1", "Cycle count correction");
        var response = stockMovementService.recordMovement(request);

        assertEquals(17, response.resultingQuantity());
    }
}
