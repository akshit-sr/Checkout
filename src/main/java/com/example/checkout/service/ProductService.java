package com.example.checkout.service;

import com.example.checkout.dto.ProductDtos.ProductRequest;
import com.example.checkout.dto.ProductDtos.ProductResponse;
import com.example.checkout.exception.ApiException;
import com.example.checkout.model.Product;
import com.example.checkout.repository.ProductRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class ProductService {

    private final ProductRepository productRepository;
    private final ProductStreamService productStreamService;

    public ProductService(ProductRepository productRepository, ProductStreamService productStreamService) {
        this.productRepository = productRepository;
        this.productStreamService = productStreamService;
    }

    public List<ProductResponse> getAll() {
        return productRepository.findAll().stream().map(this::toResponse).toList();
    }

    public ProductResponse getById(Long id) {
        return toResponse(findOrThrow(id));
    }

    public ProductResponse create(ProductRequest request) {
        Product product = new Product();
        product.setName(request.name());
        product.setDescription(request.description());
        product.setPrice(request.price());
        product.setStockQuantity(request.stockQuantity());
        ProductResponse saved = toResponse(productRepository.save(product));
        productStreamService.broadcast("created");
        return saved;
    }

    public ProductResponse update(Long id, ProductRequest request) {
        Product product = findOrThrow(id);
        product.setName(request.name());
        product.setDescription(request.description());
        product.setPrice(request.price());
        product.setStockQuantity(request.stockQuantity());
        ProductResponse saved = toResponse(productRepository.save(product));
        productStreamService.broadcast("updated");
        return saved;
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

    private ProductResponse toResponse(Product p) {
        return new ProductResponse(p.getId(), p.getName(), p.getDescription(),
                p.getPrice(), p.getStockQuantity(), p.getSku());
    }
}
