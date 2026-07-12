package com.example.checkout.controller;

import com.example.checkout.dto.OrderDtos.OrderResponse;
import com.example.checkout.dto.OrderDtos.UpdateStatusRequest;
import com.example.checkout.service.OrderService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/orders")
public class OrderController {

    private final OrderService orderService;

    public OrderController(OrderService orderService) {
        this.orderService = orderService;
    }

    @PostMapping("/checkout")
    public ResponseEntity<OrderResponse> checkout(Authentication auth) {
        return ResponseEntity.ok(orderService.checkout(auth.getName()));
    }

    @GetMapping
    public ResponseEntity<List<OrderResponse>> myOrders(Authentication auth) {
        return ResponseEntity.ok(orderService.getOrdersForUser(auth.getName()));
    }

    // ADMIN only (enforced in SecurityConfig) — every customer's orders, for fulfillment
    @GetMapping("/all")
    public ResponseEntity<List<OrderResponse>> allOrders() {
        return ResponseEntity.ok(orderService.getAllOrders());
    }

    // ADMIN only (enforced in SecurityConfig) — e.g. mark an order as SHIPPED
    @PutMapping("/{id}/status")
    public ResponseEntity<OrderResponse> updateStatus(@PathVariable Long id, @RequestBody UpdateStatusRequest request) {
        return ResponseEntity.ok(orderService.updateStatus(id, request.status()));
    }
}
