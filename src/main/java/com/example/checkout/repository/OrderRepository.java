package com.example.checkout.repository;

import com.example.checkout.model.Order;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface OrderRepository extends JpaRepository<Order, Long> {
    // Newest orders first (id is monotonic, so this is unambiguous).
    List<Order> findByUserIdOrderByIdDesc(Long userId);

    List<Order> findAllByOrderByIdDesc();
}
