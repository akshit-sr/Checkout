package com.example.checkout.controller;

import com.example.checkout.dto.CartDtos.AddItemRequest;
import com.example.checkout.dto.CartDtos.CartResponse;
import com.example.checkout.dto.CartDtos.SetQuantityRequest;
import com.example.checkout.service.CartService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/cart")
public class CartController {

    private final CartService cartService;

    public CartController(CartService cartService) {
        this.cartService = cartService;
    }

    @GetMapping
    public ResponseEntity<CartResponse> getCart(Authentication auth) {
        return ResponseEntity.ok(cartService.getCart(auth.getName()));
    }

    @PostMapping("/items")
    public ResponseEntity<CartResponse> addItem(Authentication auth, @Valid @RequestBody AddItemRequest request) {
        return ResponseEntity.ok(cartService.addItem(auth.getName(), request));
    }

    @PutMapping("/items/{productId}")
    public ResponseEntity<CartResponse> setQuantity(Authentication auth, @PathVariable Long productId,
                                                    @Valid @RequestBody SetQuantityRequest request) {
        return ResponseEntity.ok(cartService.setItemQuantity(auth.getName(), productId, request.quantity()));
    }

    @DeleteMapping("/items/{productId}")
    public ResponseEntity<CartResponse> removeItem(Authentication auth, @PathVariable Long productId) {
        return ResponseEntity.ok(cartService.removeItem(auth.getName(), productId));
    }
}
