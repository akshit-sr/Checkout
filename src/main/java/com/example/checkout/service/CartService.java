package com.example.checkout.service;

import com.example.checkout.dto.CartDtos.AddItemRequest;
import com.example.checkout.dto.CartDtos.CartItemResponse;
import com.example.checkout.dto.CartDtos.CartResponse;
import com.example.checkout.exception.ApiException;
import com.example.checkout.model.Cart;
import com.example.checkout.model.CartItem;
import com.example.checkout.model.Product;
import com.example.checkout.model.User;
import com.example.checkout.repository.CartRepository;
import com.example.checkout.repository.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;

@Service
public class CartService {

    private final CartRepository cartRepository;
    private final UserRepository userRepository;
    private final ProductService productService;

    public CartService(CartRepository cartRepository, UserRepository userRepository, ProductService productService) {
        this.cartRepository = cartRepository;
        this.userRepository = userRepository;
        this.productService = productService;
    }

    public CartResponse getCart(String userEmail) {
        return toResponse(getOrCreateCart(userEmail));
    }

    public CartResponse addItem(String userEmail, AddItemRequest request) {
        User user = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "User not found"));
        if (user.getRole() == User.Role.ADMIN) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Admin accounts cannot place orders");
        }

        Cart cart = getOrCreateCart(userEmail);
        Product product = productService.findOrThrow(request.productId());

        CartItem existing = cart.getItems().stream()
                .filter(item -> item.getProduct().getId().equals(product.getId()))
                .findFirst()
                .orElse(null);

        int alreadyInCart = existing != null ? existing.getQuantity() : 0;
        int resultingQuantity = alreadyInCart + request.quantity();

        // Validate the resulting cart quantity against stock, not just the amount
        // being added, so repeated adds can't exceed available stock.
        if (resultingQuantity > product.getStockQuantity()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Not enough stock for " + product.getName());
        }

        if (existing != null) {
            existing.setQuantity(resultingQuantity);
        } else {
            CartItem item = new CartItem();
            item.setCart(cart);
            item.setProduct(product);
            item.setQuantity(request.quantity());
            cart.getItems().add(item);
        }

        return toResponse(cartRepository.save(cart));
    }

    public CartResponse setItemQuantity(String userEmail, Long productId, int quantity) {
        Cart cart = getOrCreateCart(userEmail);
        CartItem item = cart.getItems().stream()
                .filter(i -> i.getProduct().getId().equals(productId))
                .findFirst()
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Item not in cart"));

        if (quantity <= 0) {
            cart.getItems().remove(item);
        } else {
            Product product = item.getProduct();
            if (quantity > product.getStockQuantity()) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "Not enough stock for " + product.getName());
            }
            item.setQuantity(quantity);
        }
        return toResponse(cartRepository.save(cart));
    }

    public CartResponse removeItem(String userEmail, Long productId) {
        Cart cart = getOrCreateCart(userEmail);
        cart.getItems().removeIf(item -> item.getProduct().getId().equals(productId));
        return toResponse(cartRepository.save(cart));
    }

    Cart getOrCreateCart(String userEmail) {
        User user = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "User not found"));

        return cartRepository.findByUserId(user.getId())
                .orElseGet(() -> {
                    Cart cart = new Cart();
                    cart.setUser(user);
                    return cartRepository.save(cart);
                });
    }

    private CartResponse toResponse(Cart cart) {
        var items = cart.getItems().stream()
                .map(item -> new CartItemResponse(
                        item.getProduct().getId(),
                        item.getProduct().getName(),
                        item.getQuantity(),
                        item.getProduct().getPrice(),
                        item.getProduct().getPrice().multiply(BigDecimal.valueOf(item.getQuantity()))
                ))
                .toList();

        BigDecimal total = items.stream()
                .map(CartItemResponse::lineTotal)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        return new CartResponse(cart.getId(), items, total);
    }
}
