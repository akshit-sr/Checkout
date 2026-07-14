package com.example.inventory.service;

import com.example.inventory.dto.SupplierDtos.SupplierRequest;
import com.example.inventory.dto.SupplierDtos.SupplierResponse;
import com.example.inventory.exception.ApiException;
import com.example.inventory.model.Supplier;
import com.example.inventory.repository.SupplierRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class SupplierService {

    private final SupplierRepository supplierRepository;

    public SupplierService(SupplierRepository supplierRepository) {
        this.supplierRepository = supplierRepository;
    }

    public List<SupplierResponse> getAll() {
        return supplierRepository.findAll().stream().map(this::toResponse).toList();
    }

    public SupplierResponse create(SupplierRequest request) {
        Supplier supplier = new Supplier();
        supplier.setName(request.name());
        supplier.setContactEmail(request.contactEmail());
        supplier.setPhone(request.phone());
        return toResponse(supplierRepository.save(supplier));
    }

    Supplier findOrThrow(Long id) {
        return supplierRepository.findById(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Supplier not found"));
    }

    private SupplierResponse toResponse(Supplier s) {
        return new SupplierResponse(s.getId(), s.getName(), s.getContactEmail(), s.getPhone());
    }
}
