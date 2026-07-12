package com.example.checkout.config;

import com.example.checkout.model.User;
import com.example.checkout.repository.UserRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.password.PasswordEncoder;

/**
 * Seeds a default ADMIN account on startup so the store always has someone
 * who can add products and restock. Idempotent: skips if the account exists.
 * Credentials come from app.admin.email / app.admin.password (see
 * application.properties), which are overridable via ADMIN_EMAIL / ADMIN_PASSWORD
 * environment variables in real deployments.
 */
@Configuration
public class DataInitializer {

    @Value("${app.admin.email}")
    private String adminEmail;

    @Value("${app.admin.password}")
    private String adminPassword;

    @Bean
    CommandLineRunner seedAdmin(UserRepository userRepository, PasswordEncoder passwordEncoder) {
        return args -> {
            if (userRepository.existsByEmail(adminEmail)) {
                return;
            }
            User admin = new User();
            admin.setEmail(adminEmail);
            admin.setPassword(passwordEncoder.encode(adminPassword));
            admin.setRole(User.Role.ADMIN);
            userRepository.save(admin);
        };
    }
}
