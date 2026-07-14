package com.example.checkout.service;

import com.example.checkout.exception.ApiException;
import com.example.checkout.model.Order;
import com.example.checkout.model.Order.OrderStatus;
import com.example.checkout.repository.OrderRepository;
import com.example.checkout.repository.ProductRepository;
import com.example.checkout.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class OrderServiceTest {

    @Mock private OrderRepository orderRepository;
    @Mock private ProductRepository productRepository;
    @Mock private UserRepository userRepository;
    @Mock private CartService cartService;
    @Mock private ProductStreamService productStreamService;
    @Mock private com.example.inventory.service.StockMovementService stockMovementService;

    @InjectMocks
    private OrderService orderService;

    private Order pendingOrder;

    @BeforeEach
    void setUp() {
        pendingOrder = new Order();
        pendingOrder.setId(1L);
        pendingOrder.setStatus(OrderStatus.PENDING);
        pendingOrder.setTotalAmount(BigDecimal.valueOf(100));
    }

    @Test
    void updateStatus_allowsPendingToPaid() {
        when(orderRepository.findById(1L)).thenReturn(Optional.of(pendingOrder));
        when(orderRepository.save(any(Order.class))).thenAnswer(inv -> inv.getArgument(0));

        var response = orderService.updateStatus(1L, OrderStatus.PAID);

        assertEquals(OrderStatus.PAID, response.status());
        verify(orderRepository).save(pendingOrder);
    }

    @Test
    void updateStatus_rejectsPendingToShipped_skippingPaid() {
        when(orderRepository.findById(1L)).thenReturn(Optional.of(pendingOrder));

        ApiException ex = assertThrows(ApiException.class,
                () -> orderService.updateStatus(1L, OrderStatus.SHIPPED));

        assertTrue(ex.getMessage().contains("Cannot transition"));
        verify(orderRepository, never()).save(any());
    }

    @Test
    void updateStatus_rejectsTransitionFromTerminalState() {
        pendingOrder.setStatus(OrderStatus.DELIVERED);
        when(orderRepository.findById(1L)).thenReturn(Optional.of(pendingOrder));

        assertThrows(ApiException.class, () -> orderService.updateStatus(1L, OrderStatus.CANCELLED));
    }

    @Test
    void updateStatus_throwsWhenOrderNotFound() {
        when(orderRepository.findById(99L)).thenReturn(Optional.empty());

        assertThrows(ApiException.class, () -> orderService.updateStatus(99L, OrderStatus.PAID));
    }
}
