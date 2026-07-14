package com.example.inventory.controller;

import com.example.inventory.dto.StockMovementDtos.StockMovementRequest;
import com.example.inventory.dto.StockMovementDtos.StockMovementResponse;
import com.example.inventory.service.StockMovementService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/inventory/stock-movements")
public class StockMovementController {

    private final StockMovementService stockMovementService;

    public StockMovementController(StockMovementService stockMovementService) {
        this.stockMovementService = stockMovementService;
    }

    @PostMapping
    public ResponseEntity<StockMovementResponse> recordMovement(@Valid @RequestBody StockMovementRequest request) {
        return ResponseEntity.ok(stockMovementService.recordMovement(request));
    }

    @GetMapping("/product/{productId}")
    public ResponseEntity<List<StockMovementResponse>> getHistory(@PathVariable Long productId) {
        return ResponseEntity.ok(stockMovementService.getHistoryForProduct(productId));
    }
}
