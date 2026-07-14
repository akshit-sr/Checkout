package com.example.inventory.service;

import com.example.checkout.model.Product;
import com.example.checkout.repository.ProductRepository;
import com.example.checkout.service.ProductStreamService;
import com.example.inventory.dto.ProductDtos.ProductRequest;
import com.example.inventory.dto.ProductDtos.ProductResponse;
import com.example.inventory.exception.ApiException;
import com.example.inventory.model.Supplier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * Product management for the inventory back office. Operates on the single
 * shared {@link Product} table, so anything created/edited here is immediately
 * the same product the storefront shows. Broadcasts an SSE on every change so
 * customers browsing see updated stock, prices, and new products live.
 */
@Service
public class InventoryProductService {

    private final ProductRepository productRepository;
    private final SupplierService supplierService;
    private final ProductStreamService productStreamService;

    @Value("${app.inventory.low-stock-threshold:10}")
    private int defaultLowStockThreshold;

    public InventoryProductService(ProductRepository productRepository, SupplierService supplierService,
                                   ProductStreamService productStreamService) {
        this.productRepository = productRepository;
        this.supplierService = supplierService;
        this.productStreamService = productStreamService;
    }

    public List<ProductResponse> getAll() {
        return productRepository.findAll().stream().map(this::toResponse).toList();
    }

    public ProductResponse getById(Long id) {
        return toResponse(findOrThrow(id));
    }

    public List<ProductResponse> getLowStockProducts() {
        return productRepository.findAll().stream()
                .filter(p -> p.isLowStock(defaultLowStockThreshold))
                .map(this::toResponse)
                .toList();
    }

    public ProductResponse create(ProductRequest request) {
        Product product = new Product();
        applyRequest(product, request);
        Product saved = productRepository.save(product);
        productStreamService.broadcast("created");
        return toResponse(saved);
    }

    public ProductResponse update(Long id, ProductRequest request) {
        Product product = findOrThrow(id);
        applyRequest(product, request);
        Product saved = productRepository.save(product);
        productStreamService.broadcast("stock-changed");
        return toResponse(saved);
    }

    public void delete(Long id) {
        if (!productRepository.existsById(id)) {
            throw new ApiException(HttpStatus.NOT_FOUND, "Product not found");
        }
        productRepository.deleteById(id);
        productStreamService.broadcast("deleted");
    }

    Product findOrThrow(Long id) {
        return productRepository.findById(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Product not found"));
    }

    Product save(Product product) {
        return productRepository.save(product);
    }

    int getDefaultLowStockThreshold() {
        return defaultLowStockThreshold;
    }

    private void applyRequest(Product product, ProductRequest request) {
        product.setName(request.name());
        product.setSku(request.sku());
        product.setDescription(request.description());
        // The inventory tab's "selling price" is the storefront price.
        product.setPrice(request.sellingPrice());
        product.setStockQuantity(request.quantityInStock());
        product.setLowStockThreshold(request.lowStockThreshold());
        product.setUnitCost(request.unitCost());

        if (request.supplierId() != null) {
            Supplier supplier = supplierService.findOrThrow(request.supplierId());
            product.setSupplier(supplier);
        }
    }

    private ProductResponse toResponse(Product p) {
        return new ProductResponse(
                p.getId(),
                p.getName(),
                p.getSku(),
                p.getDescription(),
                p.getPrice(),
                p.getStockQuantity(),
                p.getLowStockThreshold(),
                p.getUnitCost(),
                p.getSupplier() != null ? p.getSupplier().getName() : null,
                p.isLowStock(defaultLowStockThreshold)
        );
    }
}
