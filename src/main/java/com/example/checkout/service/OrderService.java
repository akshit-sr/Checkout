package com.example.checkout.service;

import com.example.checkout.dto.OrderDtos.OrderItemResponse;
import com.example.checkout.dto.OrderDtos.OrderResponse;
import com.example.checkout.exception.ApiException;
import com.example.checkout.model.Cart;
import com.example.checkout.model.Order;
import com.example.checkout.model.Order.OrderStatus;
import com.example.checkout.model.OrderItem;
import com.example.checkout.model.Product;
import com.example.checkout.model.User;
import com.example.checkout.repository.OrderRepository;
import com.example.checkout.repository.ProductRepository;
import com.example.checkout.repository.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.EnumMap;
import java.util.EnumSet;
import java.util.List;
import java.util.Map;

@Service
public class OrderService {

    private final OrderRepository orderRepository;
    private final ProductRepository productRepository;
    private final UserRepository userRepository;
    private final CartService cartService;
    private final ProductStreamService productStreamService;
    private final com.example.inventory.service.StockMovementService stockMovementService;

    // Legal transitions for the order state machine.
    private static final Map<OrderStatus, EnumSet<OrderStatus>> ALLOWED_TRANSITIONS = new EnumMap<>(OrderStatus.class);
    static {
        ALLOWED_TRANSITIONS.put(OrderStatus.PENDING, EnumSet.of(OrderStatus.PAID, OrderStatus.CANCELLED));
        ALLOWED_TRANSITIONS.put(OrderStatus.PAID, EnumSet.of(OrderStatus.SHIPPED, OrderStatus.CANCELLED));
        ALLOWED_TRANSITIONS.put(OrderStatus.SHIPPED, EnumSet.of(OrderStatus.DELIVERED));
        ALLOWED_TRANSITIONS.put(OrderStatus.DELIVERED, EnumSet.noneOf(OrderStatus.class));
        ALLOWED_TRANSITIONS.put(OrderStatus.CANCELLED, EnumSet.noneOf(OrderStatus.class));
    }

    public OrderService(OrderRepository orderRepository, ProductRepository productRepository,
                         UserRepository userRepository, CartService cartService,
                         ProductStreamService productStreamService,
                         com.example.inventory.service.StockMovementService stockMovementService) {
        this.orderRepository = orderRepository;
        this.productRepository = productRepository;
        this.userRepository = userRepository;
        this.cartService = cartService;
        this.productStreamService = productStreamService;
        this.stockMovementService = stockMovementService;
    }

    /**
     * Converts the user's current cart into an Order, decrements stock,
     * and empties the cart. Runs in one transaction so a failure midway
     * (e.g., insufficient stock) rolls back cleanly.
     */
    @Transactional
    public OrderResponse checkout(String userEmail) {
        User user = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "User not found"));

        if (user.getRole() == User.Role.ADMIN) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Admin accounts cannot place orders");
        }

        Cart cart = cartService.getOrCreateCart(userEmail);
        if (cart.getItems().isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Cart is empty");
        }

        Order order = new Order();
        order.setUser(user);
        // Payment is taken at checkout, so orders start as PAID and are ready
        // for the admin to ship — no manual "confirm payment" step needed.
        order.setStatus(OrderStatus.PAID);

        BigDecimal total = BigDecimal.ZERO;

        for (var cartItem : cart.getItems()) {
            Product product = productRepository.findById(cartItem.getProduct().getId())
                    .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Product not found"));

            if (product.getStockQuantity() < cartItem.getQuantity()) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "Not enough stock for " + product.getName());
            }

            product.setStockQuantity(product.getStockQuantity() - cartItem.getQuantity());
            productRepository.save(product);

            OrderItem orderItem = new OrderItem();
            orderItem.setOrder(order);
            orderItem.setProduct(product);
            orderItem.setQuantity(cartItem.getQuantity());
            orderItem.setUnitPriceAtPurchase(product.getPrice());
            order.getItems().add(orderItem);

            total = total.add(product.getPrice().multiply(BigDecimal.valueOf(cartItem.getQuantity())));
        }

        order.setTotalAmount(total);
        Order saved = orderRepository.save(order);

        // Record each sold line as a STOCK_OUT movement for the inventory audit
        // trail. Stock was already decremented above, so this only logs it.
        for (OrderItem item : saved.getItems()) {
            stockMovementService.logSale(item.getProduct(), item.getQuantity(),
                    "Order #" + saved.getId() + " checkout");
        }

        cart.getItems().clear(); // empty the cart after successful checkout

        // Push the live stock update only once the order has actually committed,
        // so streaming never interferes with the checkout transaction.
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                productStreamService.broadcast("stock-changed");
            }
        });

        return toResponse(saved);
    }

    public List<OrderResponse> getOrdersForUser(String userEmail) {
        User user = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "User not found"));
        return orderRepository.findByUserIdOrderByIdDesc(user.getId()).stream().map(this::toResponse).toList();
    }

    /** All orders across all customers — admin view for fulfilling/shipping. */
    public List<OrderResponse> getAllOrders() {
        return orderRepository.findAllByOrderByIdDesc().stream().map(this::toResponse).toList();
    }

    public OrderResponse updateStatus(Long orderId, OrderStatus newStatus) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Order not found"));

        EnumSet<OrderStatus> allowed = ALLOWED_TRANSITIONS.get(order.getStatus());
        if (allowed == null || !allowed.contains(newStatus)) {
            throw new ApiException(HttpStatus.BAD_REQUEST,
                    "Cannot transition order from " + order.getStatus() + " to " + newStatus);
        }

        order.setStatus(newStatus);
        order.setUpdatedAt(Instant.now());
        return toResponse(orderRepository.save(order));
    }

    private OrderResponse toResponse(Order order) {
        var items = order.getItems().stream()
                .map(i -> new OrderItemResponse(
                        i.getProduct().getId(),
                        i.getProduct().getName(),
                        i.getQuantity(),
                        i.getUnitPriceAtPurchase()
                ))
                .toList();

        String customerEmail = order.getUser() != null ? order.getUser().getEmail() : null;
        return new OrderResponse(order.getId(), customerEmail, items,
                order.getTotalAmount(), order.getStatus(), order.getCreatedAt());
    }
}
