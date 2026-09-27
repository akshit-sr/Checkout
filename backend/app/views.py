from datetime import UTC
from decimal import Decimal


def timestamp(value):
    return (
        value.replace(tzinfo=UTC).isoformat().replace("+00:00", "Z")
        if value.tzinfo is None
        else value.astimezone(UTC).isoformat().replace("+00:00", "Z")
    )


def product_view(p):
    return {
        "id": p.id,
        "name": p.name,
        "description": p.description,
        "price": p.price,
        "stockQuantity": p.stock_quantity,
        "sku": p.sku,
    }


def inventory_view(p, threshold):
    return {
        "id": p.id,
        "name": p.name,
        "sku": p.sku,
        "description": p.description,
        "sellingPrice": p.price,
        "quantityInStock": p.stock_quantity,
        "lowStockThreshold": p.low_stock_threshold,
        "unitCost": p.unit_cost,
        "supplierName": p.supplier.name if p.supplier else None,
        "lowStock": p.stock_quantity
        <= (p.low_stock_threshold if p.low_stock_threshold is not None else threshold),
    }


def supplier_view(s):
    return {
        "id": s.id,
        "name": s.name,
        "contactEmail": s.contact_email,
        "phone": s.phone,
    }


def cart_view(cart):
    items = [
        {
            "productId": i.product_id,
            "productName": i.product.name,
            "quantity": i.quantity,
            "unitPrice": i.product.price,
            "lineTotal": i.product.price * i.quantity,
        }
        for i in cart.items
    ]
    return {
        "cartId": cart.id,
        "items": items,
        "total": sum((i["lineTotal"] for i in items), Decimal(0)),
    }


def order_view(order):
    return {
        "id": order.id,
        "customerEmail": order.user.email,
        "items": [
            {
                "productId": i.product_id,
                "productName": i.product.name,
                "quantity": i.quantity,
                "unitPriceAtPurchase": i.unit_price_at_purchase,
            }
            for i in order.items
        ],
        "totalAmount": order.total_amount,
        "status": order.status,
        "createdAt": timestamp(order.created_at),
    }


def movement_view(m):
    return {
        "id": m.id,
        "productId": m.product_id,
        "productName": m.product.name,
        "type": m.type,
        "quantityChanged": m.quantity_changed,
        "resultingQuantity": m.resulting_quantity,
        "performedBy": m.performed_by,
        "reason": m.reason,
        "timestamp": timestamp(m.timestamp),
    }
