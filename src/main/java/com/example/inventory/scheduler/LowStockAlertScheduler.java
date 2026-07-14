package com.example.inventory.scheduler;

import com.example.inventory.dto.ProductDtos.ProductResponse;
import com.example.inventory.service.InventoryProductService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
public class LowStockAlertScheduler {

    private static final Logger log = LoggerFactory.getLogger(LowStockAlertScheduler.class);

    private final InventoryProductService productService;
    private final JavaMailSender mailSender;

    @Value("${app.inventory.alert-recipient}")
    private String alertRecipient;

    public LowStockAlertScheduler(InventoryProductService productService, JavaMailSender mailSender) {
        this.productService = productService;
        this.mailSender = mailSender;
    }

    /**
     * Runs once every day at 8 AM server time. Cron format: sec min hour day month weekday.
     * Replaces what used to be a manual daily inventory check.
     */
    @Scheduled(cron = "0 0 8 * * *")
    public void checkLowStockAndNotify() {
        List<ProductResponse> lowStockProducts = productService.getLowStockProducts();

        if (lowStockProducts.isEmpty()) {
            log.info("Low-stock check ran: no products below threshold.");
            return;
        }

        String body = buildEmailBody(lowStockProducts);

        SimpleMailMessage message = new SimpleMailMessage();
        message.setTo(alertRecipient);
        message.setSubject("Low Stock Alert: " + lowStockProducts.size() + " product(s) need reordering");
        message.setText(body);

        try {
            mailSender.send(message);
            log.info("Low-stock alert email sent for {} product(s).", lowStockProducts.size());
        } catch (Exception ex) {
            // Don't let a mail server outage crash the scheduled job; log and move on.
            log.error("Failed to send low-stock alert email", ex);
        }
    }

    private String buildEmailBody(List<ProductResponse> products) {
        StringBuilder sb = new StringBuilder("The following products are at or below their low-stock threshold:\n\n");
        for (ProductResponse p : products) {
            sb.append(String.format("- %s (SKU: %s) — %d units remaining%n", p.name(), p.sku(), p.quantityInStock()));
        }
        return sb.toString();
    }
}
