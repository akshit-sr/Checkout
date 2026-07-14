package com.example.checkout;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * Single entry point for the combined platform: the checkout storefront and the
 * inventory back office run in one Spring Boot process against one database.
 * Scanning is widened to {@code com.example} so both the checkout and inventory
 * packages are picked up. Scheduling is enabled for the low-stock email alert.
 */
@SpringBootApplication(scanBasePackages = "com.example")
@EntityScan("com.example")
@EnableJpaRepositories("com.example")
@EnableScheduling
public class CheckoutApiApplication {

    public static void main(String[] args) {
        SpringApplication.run(CheckoutApiApplication.class, args);
    }
}
