package com.example.inventory.service;

import com.example.checkout.model.Product;
import com.example.checkout.service.ProductStreamService;
import com.example.inventory.dto.StockMovementDtos.StockMovementRequest;
import com.example.inventory.dto.StockMovementDtos.StockMovementResponse;
import com.example.inventory.exception.ApiException;
import com.example.inventory.model.StockMovement;
import com.example.inventory.model.StockMovement.MovementType;
import com.example.inventory.repository.StockMovementRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.util.List;

@Service
public class StockMovementService {

    private final StockMovementRepository stockMovementRepository;
    private final InventoryProductService productService;
    private final ProductStreamService productStreamService;

    public StockMovementService(StockMovementRepository stockMovementRepository,
                                InventoryProductService productService,
                                ProductStreamService productStreamService) {
        this.stockMovementRepository = stockMovementRepository;
        this.productService = productService;
        this.productStreamService = productStreamService;
    }

    /**
     * Records a stock change and updates the product's quantity in one
     * transaction, so the audit log and the live quantity never drift apart.
     * Used by the inventory back office for restocks and adjustments.
     */
    @Transactional
    public StockMovementResponse recordMovement(StockMovementRequest request) {
        Product product = productService.findOrThrow(request.productId());

        int delta = switch (request.type()) {
            case STOCK_IN -> request.quantity();
            case STOCK_OUT -> -request.quantity();
            case ADJUSTMENT -> request.quantity(); // caller passes the signed delta directly
        };

        int newQuantity = product.getStockQuantity() + delta;
        if (newQuantity < 0) {
            throw new ApiException(HttpStatus.BAD_REQUEST,
                    "Movement would result in negative stock for " + product.getName());
        }

        product.setStockQuantity(newQuantity);
        productService.save(product);

        StockMovement movement = new StockMovement();
        movement.setProduct(product);
        movement.setType(request.type());
        movement.setQuantityChanged(delta);
        movement.setResultingQuantity(newQuantity);
        movement.setPerformedBy(request.performedBy());
        movement.setReason(request.reason());

        StockMovementResponse response = toResponse(stockMovementRepository.save(movement));

        // Push the new stock level to the storefront once the change commits.
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    productStreamService.broadcast("stock-changed");
                }
            });
        }

        return response;
    }

    /**
     * Logs a customer purchase as a STOCK_OUT movement for the audit trail.
     * The order flow has already decremented the stock, so this only records the
     * movement — it does not change the quantity.
     */
    public void logSale(Product product, int quantity, String reason) {
        StockMovement movement = new StockMovement();
        movement.setProduct(product);
        movement.setType(MovementType.STOCK_OUT);
        movement.setQuantityChanged(-quantity);
        movement.setResultingQuantity(product.getStockQuantity());
        movement.setPerformedBy("checkout-service");
        movement.setReason(reason);
        stockMovementRepository.save(movement);
    }

    public List<StockMovementResponse> getHistoryForProduct(Long productId) {
        return stockMovementRepository.findByProductIdOrderByTimestampDesc(productId)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    private StockMovementResponse toResponse(StockMovement m) {
        return new StockMovementResponse(
                m.getId(),
                m.getProduct().getId(),
                m.getProduct().getName(),
                m.getType(),
                m.getQuantityChanged(),
                m.getResultingQuantity(),
                m.getPerformedBy(),
                m.getReason(),
                m.getTimestamp()
        );
    }
}
