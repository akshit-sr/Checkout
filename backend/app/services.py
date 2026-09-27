from decimal import Decimal

from fastapi import HTTPException
from sqlalchemy import func, select

from .models import (
    Cart,
    CartItem,
    Order,
    OrderItem,
    Product,
    StockMovement,
    Supplier,
    User,
    now,
)

TRANSITIONS = {
    "PENDING": {"PAID", "CANCELLED"},
    "PAID": {"SHIPPED", "CANCELLED"},
    "SHIPPED": {"DELIVERED"},
    "DELIVERED": set(),
    "CANCELLED": set(),
}


def find(db, model, id, *, lock=False):
    query = select(model).where(model.id == id)
    if lock:
        query = query.with_for_update(of=model).execution_options(
            populate_existing=True
        )
    obj = db.scalar(query)
    if obj is None:
        raise HTTPException(404, f"{model.__name__} not found")
    return obj


def low_stock(db, threshold):
    return db.scalars(
        select(Product).where(
            Product.stock_quantity
            <= func.coalesce(Product.low_stock_threshold, threshold)
        )
    ).all()


def save_product(db, body, id=None, *, inventory=False):
    product = find(db, Product, id, lock=True) if id is not None else Product()
    product.name, product.description = body.name, body.description
    if inventory:
        product.sku = body.sku
        product.price, product.stock_quantity = body.sellingPrice, body.quantityInStock
        product.unit_cost, product.low_stock_threshold = (
            body.unitCost,
            body.lowStockThreshold,
        )
        # Preserve Java PUT behavior: an omitted/null supplier leaves the existing link.
        if body.supplierId is not None:
            product.supplier = find(db, Supplier, body.supplierId)
    else:
        product.price, product.stock_quantity = body.price, body.stockQuantity
    db.add(product)
    db.flush()
    db.info["product_event"] = (
        "created" if id is None else "stock-changed" if inventory else "updated"
    )
    return product


def delete_product(db, id):
    db.delete(find(db, Product, id, lock=True))
    db.flush()
    db.info["product_event"] = "deleted"


def get_cart(db, user):
    # Serialize cart creation/edits/checkout per user, including an initially absent cart.
    find(db, User, user.id, lock=True)
    cart = db.scalar(select(Cart).where(Cart.user_id == user.id))
    if cart is None:
        cart = Cart(user_id=user.id)
        db.add(cart)
        db.flush()
    return cart


def customer_only(user):
    if user.role == "ADMIN":
        raise HTTPException(403, "Admin accounts cannot place orders")


def add_item(db, user, body):
    customer_only(user)
    cart = get_cart(db, user)
    product = find(db, Product, body.productId, lock=True)
    item = next((i for i in cart.items if i.product_id == product.id), None)
    quantity = (item.quantity if item else 0) + body.quantity
    if quantity > product.stock_quantity:
        raise HTTPException(400, f"Not enough stock for {product.name}")
    if item:
        item.quantity = quantity
    else:
        cart.items.append(CartItem(product=product, quantity=quantity))
    db.flush()
    return cart


def set_quantity(db, user, product_id, quantity):
    cart = get_cart(db, user)
    item = next((i for i in cart.items if i.product_id == product_id), None)
    if item is None:
        raise HTTPException(404, "Item not in cart")
    if quantity == 0:
        cart.items.remove(item)
    else:
        product = find(db, Product, product_id, lock=True)
        if quantity > product.stock_quantity:
            raise HTTPException(400, f"Not enough stock for {product.name}")
        item.quantity = quantity
    db.flush()
    return cart


def checkout(db, user):
    customer_only(user)
    cart = get_cart(db, user)
    if not cart.items:
        raise HTTPException(400, "Cart is empty")
    # Lock all affected products in ID order to avoid overselling and deadlocks.
    products = {
        p.id: p
        for p in db.scalars(
            select(Product)
            .where(Product.id.in_([i.product_id for i in cart.items]))
            .order_by(Product.id)
            .with_for_update(of=Product)
            .execution_options(populate_existing=True)
        )
    }
    order = Order(user=user, status="PAID", total_amount=Decimal(0))
    db.add(order)
    for item in cart.items:
        product = products[item.product_id]
        if item.quantity > product.stock_quantity:
            raise HTTPException(400, f"Not enough stock for {product.name}")
        product.stock_quantity -= item.quantity
        order.items.append(
            OrderItem(
                product=product,
                quantity=item.quantity,
                unit_price_at_purchase=product.price,
            )
        )
        order.total_amount += product.price * item.quantity
    db.flush()
    for item in order.items:
        db.add(
            StockMovement(
                product=item.product,
                type="STOCK_OUT",
                quantity_changed=-item.quantity,
                resulting_quantity=item.product.stock_quantity,
                performed_by="checkout-service",
                reason=f"Order #{order.id} checkout",
            )
        )
    cart.items.clear()
    db.flush()
    db.info["product_event"] = "stock-changed"
    return order


def update_status(db, id, status):
    order = find(db, Order, id, lock=True)
    if status not in TRANSITIONS.get(order.status, set()):
        raise HTTPException(
            400, f"Cannot transition order from {order.status} to {status}"
        )
    # Cancellation does not restore stock in the original backend.
    order.status, order.updated_at = status, now()
    db.flush()
    return order


def record_movement(db, body):
    product = find(db, Product, body.productId, lock=True)
    delta = -body.quantity if body.type == "STOCK_OUT" else body.quantity
    resulting = product.stock_quantity + delta
    if resulting < 0:
        raise HTTPException(
            400, f"Movement would result in negative stock for {product.name}"
        )
    if resulting > 2147483647:
        raise HTTPException(400, "Stock quantity exceeds the supported maximum")
    product.stock_quantity = resulting
    movement = StockMovement(
        product=product,
        type=body.type,
        quantity_changed=delta,
        resulting_quantity=resulting,
        performed_by=body.performedBy,
        reason=body.reason,
    )
    db.add(movement)
    db.flush()
    db.info["product_event"] = "stock-changed"
    return movement
