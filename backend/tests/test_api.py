from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from decimal import Decimal
from unittest.mock import patch

import bcrypt
import jwt
import pytest
from sqlalchemy import func, select

from app.models import Order, OrderItem, Product, StockMovement, User, now


def test_auth_and_legacy_credentials(client, admin, customer):
    assert client.get("/api/products").status_code == 200
    assert client.get("/api/cart").status_code == 401
    assert client.get("/api/orders/all", headers=customer).status_code == 403
    assert client.get("/api/inventory/suppliers", headers=customer).status_code == 403
    assert client.post("/api/orders/checkout", headers=admin).status_code == 403
    assert (
        client.post(
            "/api/auth/register",
            json={"email": "customer@example.com", "password": "password123"},
        ).status_code
        == 409
    )
    assert (
        client.post(
            "/api/auth/login",
            json={"email": "customer@example.com", "password": "wrong"},
        ).status_code
        == 401
    )
    with client.app.state.sessions.begin() as db:
        db.add(
            User(
                email="legacy@example.com",
                role="CUSTOMER",
                password=bcrypt.hashpw(
                    b"legacy123", bcrypt.gensalt(rounds=10, prefix=b"2a")
                ).decode(),
            )
        )
    login = client.post(
        "/api/auth/login", json={"email": "legacy@example.com", "password": "legacy123"}
    )
    assert login.status_code == 200
    settings = client.app.state.settings
    # Same claims, UTF-8 key and algorithm as JJWT's signWith(key()).
    token = jwt.encode(
        {
            "sub": "legacy@example.com",
            "role": "CUSTOMER",
            "iat": now(),
            "exp": now() + timedelta(hours=1),
        },
        settings.jwt_secret,
        algorithm="HS512",
    )
    assert (
        client.get(
            "/api/cart", headers={"Authorization": f"Bearer {token}"}
        ).status_code
        == 200
    )
    for token in [
        "invalid",
        jwt.encode(
            {"sub": "legacy@example.com", "exp": now() - timedelta(seconds=1)},
            settings.jwt_secret,
            algorithm="HS512",
        ),
    ]:
        assert (
            client.get(
                "/api/cart", headers={"Authorization": f"Bearer {token}"}
            ).status_code
            == 401
        )


def test_product_supplier_contract(client, admin, customer, product):
    id = product["id"]
    supplier = client.post(
        "/api/inventory/suppliers",
        headers=admin,
        json={"name": "Supplier", "contactEmail": "sales@example.com", "phone": "123"},
    )
    assert supplier.status_code == 200
    body = {
        "name": "Changed",
        "sku": "WID-001",
        "sellingPrice": 15.25,
        "quantityInStock": 8,
        "supplierId": supplier.json()["id"],
        "unitCost": 4,
    }
    updated = client.put(f"/api/inventory/products/{id}", headers=admin, json=body)
    assert updated.status_code == 200, updated.text
    assert updated.json()["supplierName"] == "Supplier"
    assert updated.json()["lowStock"] is True
    assert (
        client.get("/api/inventory/products/low-stock", headers=admin).json()[0]["id"]
        == id
    )
    storefront = client.get(f"/api/products/{id}").json()
    assert storefront == {
        "id": id,
        "name": "Changed",
        "description": None,
        "price": 15.25,
        "stockQuantity": 8,
        "sku": "WID-001",
    }
    assert isinstance(storefront["price"], (int, float))
    assert client.get("/api/inventory/suppliers", headers=admin).json() == [
        supplier.json()
    ]
    assert (
        client.post(
            "/api/products",
            headers=customer,
            json={"name": "No", "price": 1, "stockQuantity": 1},
        ).status_code
        == 403
    )
    duplicate_sku = client.post("/api/inventory/products", headers=admin, json=body)
    assert duplicate_sku.status_code == 200
    assert (
        client.delete(
            f"/api/inventory/products/{duplicate_sku.json()['id']}", headers=admin
        ).status_code
        == 204
    )
    assert client.delete(f"/api/products/{id}", headers=admin).status_code == 204
    assert client.get(f"/api/products/{id}").status_code == 404
    created = client.post(
        "/api/products",
        headers=admin,
        json={"name": "Basic", "price": 1, "stockQuantity": 5},
    )
    assert created.status_code == 200
    assert (
        client.put(
            f"/api/products/{created.json()['id']}",
            headers=admin,
            json={"name": "Basic 2", "price": 2, "stockQuantity": 6},
        ).json()["price"]
        == 2
    )


def test_cart_checkout_and_history(client, admin, customer, product):
    id = product["id"]
    assert (
        client.post(
            "/api/cart/items", headers=admin, json={"productId": id, "quantity": 1}
        ).status_code
        == 403
    )
    add = client.post(
        "/api/cart/items", headers=customer, json={"productId": id, "quantity": 2}
    )
    assert add.status_code == 200, add.text
    assert add.json()["items"][0] == {
        "productId": id,
        "productName": "Widget",
        "quantity": 2,
        "unitPrice": 12.5,
        "lineTotal": 25.0,
    }
    assert (
        client.post(
            "/api/cart/items", headers=customer, json={"productId": id, "quantity": 19}
        ).status_code
        == 400
    )
    assert (
        client.put(
            f"/api/cart/items/{id}", headers=customer, json={"quantity": 3}
        ).json()["total"]
        == 37.5
    )
    assert (
        client.put(
            f"/api/cart/items/{id}", headers=customer, json={"quantity": 21}
        ).status_code
        == 400
    )
    response = client.post("/api/orders/checkout", headers=customer)
    assert response.status_code == 200, response.text
    order = response.json()
    assert order["status"] == "PAID" and order["totalAmount"] == 37.5
    assert order["customerEmail"] == "customer@example.com"
    assert order["createdAt"].endswith("Z")
    assert client.get("/api/cart", headers=customer).json()["items"] == []
    assert client.get(f"/api/products/{id}").json()["stockQuantity"] == 17
    movement = client.get(
        f"/api/inventory/stock-movements/product/{id}", headers=admin
    ).json()[0]
    assert movement["quantityChanged"] == -3 and movement["resultingQuantity"] == 17
    assert (
        movement["performedBy"] == "checkout-service"
        and movement["reason"] == f"Order #{order['id']} checkout"
    )
    assert client.get("/api/orders", headers=customer).json() == [order]
    assert client.get("/api/orders/all", headers=admin).json() == [order]
    assert client.post("/api/orders/checkout", headers=customer).status_code == 400
    client.put(
        f"/api/products/{id}",
        headers=admin,
        json={"name": "Widget", "price": 99, "stockQuantity": 17},
    )
    assert (
        client.get("/api/orders", headers=customer).json()[0]["items"][0][
            "unitPriceAtPurchase"
        ]
        == 12.5
    )
    assert client.delete(f"/api/products/{id}", headers=admin).status_code == 409
    assert client.get(f"/api/products/{id}").status_code == 200
    # Cart quantity zero removes a line; DELETE is idempotent.
    client.post(
        "/api/cart/items", headers=customer, json={"productId": id, "quantity": 1}
    )
    assert (
        client.put(
            f"/api/cart/items/{id}", headers=customer, json={"quantity": 0}
        ).json()["items"]
        == []
    )
    assert (
        client.delete(f"/api/cart/items/{id}", headers=customer).json()["items"] == []
    )
    assert (
        client.put(
            f"/api/cart/items/{id}", headers=customer, json={"quantity": 1}
        ).status_code
        == 404
    )


def test_checkout_rolls_back_everything(client, admin, customer, product):
    second = client.post(
        "/api/products",
        headers=admin,
        json={"name": "Second", "price": 4, "stockQuantity": 1},
    ).json()
    for id in [product["id"], second["id"]]:
        assert (
            client.post(
                "/api/cart/items",
                headers=customer,
                json={"productId": id, "quantity": 1},
            ).status_code
            == 200
        )
    client.put(
        f"/api/products/{second['id']}",
        headers=admin,
        json={"name": "Second", "price": 4, "stockQuantity": 0},
    )
    with patch.object(client.app.state.events, "broadcast") as broadcast:
        assert client.post("/api/orders/checkout", headers=customer).status_code == 400
        broadcast.assert_not_called()
    assert client.get(f"/api/products/{product['id']}").json()["stockQuantity"] == 20
    assert len(client.get("/api/cart", headers=customer).json()["items"]) == 2
    with client.app.state.sessions() as db:
        for model in [Order, OrderItem, StockMovement]:
            assert db.scalar(select(func.count()).select_from(model)) == 0


@pytest.mark.parametrize(
    ("kind", "quantity", "delta", "status"),
    [
        ("STOCK_IN", 15, 15, 200),
        ("STOCK_OUT", 5, -5, 200),
        ("STOCK_OUT", 999, 0, 400),
        ("ADJUSTMENT", -3, -3, 200),
        ("STOCK_OUT", -1, 0, 400),
        ("STOCK_IN", -1, 0, 400),
    ],
)
def test_stock_movements(client, admin, product, kind, quantity, delta, status):
    with patch.object(client.app.state.events, "broadcast") as broadcast:
        response = client.post(
            "/api/inventory/stock-movements",
            headers=admin,
            json={
                "productId": product["id"],
                "type": kind,
                "quantity": quantity,
                "performedBy": "manager",
                "reason": "Count",
            },
        )
        assert response.status_code == status, response.text
        if status == 200:
            assert response.json()["quantityChanged"] == delta
            assert response.json()["resultingQuantity"] == 20 + delta
            broadcast.assert_called_once_with("stock-changed")
        else:
            broadcast.assert_not_called()
    assert (
        client.get(f"/api/products/{product['id']}").json()["stockQuantity"]
        == 20 + delta
    )


@pytest.mark.parametrize(
    ("old", "new", "status"),
    [
        ("PENDING", "PAID", 200),
        ("PENDING", "SHIPPED", 400),
        ("PENDING", "CANCELLED", 200),
        ("PAID", "SHIPPED", 200),
        ("PAID", "CANCELLED", 200),
        ("SHIPPED", "DELIVERED", 200),
        ("SHIPPED", "CANCELLED", 400),
        ("DELIVERED", "CANCELLED", 400),
        ("CANCELLED", "PAID", 400),
        ("PAID", "PAID", 400),
    ],
)
def test_order_state_machine(client, admin, customer, old, new, status):
    with client.app.state.sessions.begin() as db:
        user = db.scalar(select(User).where(User.email == "customer@example.com"))
        order = Order(user=user, status=old, total_amount=Decimal("100"))
        db.add(order)
        db.flush()
        id = order.id
    response = client.put(
        f"/api/orders/{id}/status", headers=admin, json={"status": new}
    )
    assert response.status_code == status, response.text
    with client.app.state.sessions() as db:
        assert db.get(Order, id).status == (new if status == 200 else old)
    assert (
        client.put(
            "/api/orders/999999/status", headers=admin, json={"status": "PAID"}
        ).status_code
        == 404
    )


def test_validation_and_openapi(client, admin):
    for body in [
        {"name": "  ", "price": 1, "stockQuantity": 1},
        {"name": "A", "stockQuantity": 1},
        {"name": "A", "price": -1, "stockQuantity": 1},
    ]:
        response = client.post("/api/products", headers=admin, json=body)
        assert response.status_code == 400
        assert set(response.json()) == {"timestamp", "status", "error", "message"}
    assert (
        client.post(
            "/api/auth/register", json={"email": "invalid", "password": "short"}
        ).status_code
        == 400
    )
    assert (
        client.post(
            "/api/auth/register",
            json={"email": "new@example.com", "password": "x" * 73},
        ).status_code
        == 400
    )
    assert client.get("/swagger-ui.html").status_code == 200
    spec = client.get("/v3/api-docs").json()
    expected = {
        "/api/auth/register": {"post"},
        "/api/auth/login": {"post"},
        "/api/products": {"get", "post"},
        "/api/products/stream": {"get"},
        "/api/products/{id}": {"get", "put", "delete"},
        "/api/cart": {"get"},
        "/api/cart/items": {"post"},
        "/api/cart/items/{product_id}": {"put", "delete"},
        "/api/orders": {"get"},
        "/api/orders/all": {"get"},
        "/api/orders/checkout": {"post"},
        "/api/orders/{id}/status": {"put"},
        "/api/inventory/products": {"get", "post"},
        "/api/inventory/products/low-stock": {"get"},
        "/api/inventory/products/{id}": {"get", "put", "delete"},
        "/api/inventory/suppliers": {"get", "post"},
        "/api/inventory/stock-movements": {"post"},
        "/api/inventory/stock-movements/product/{product_id}": {"get"},
    }
    assert {path: set(methods) for path, methods in spec["paths"].items()} == expected


def test_order_ownership(client, admin, customer, product):
    client.post(
        "/api/cart/items",
        headers=customer,
        json={"productId": product["id"], "quantity": 1},
    )
    order = client.post("/api/orders/checkout", headers=customer).json()
    other = client.post(
        "/api/auth/register",
        json={"email": "other@example.com", "password": "password123"},
    ).json()
    headers = {"Authorization": "Bearer " + other["token"]}
    assert client.get("/api/orders", headers=headers).json() == []
    assert (
        client.put(
            f"/api/orders/{order['id']}/status",
            headers=headers,
            json={"status": "CANCELLED"},
        ).status_code
        == 403
    )
    assert client.get("/api/cart", headers=headers).json()["items"] == []


def test_simultaneous_checkouts_do_not_oversell(client, admin, customer, product):
    if client.app.state.engine.dialect.name != "postgresql":
        return  # Row-lock semantics belong to the PostgreSQL run of this fixture.
    id = product["id"]
    client.put(
        f"/api/products/{id}",
        headers=admin,
        json={"name": "Last unit", "price": 10, "stockQuantity": 1},
    )
    other = client.post(
        "/api/auth/register",
        json={"email": "other@example.com", "password": "password123"},
    ).json()
    headers = [customer, {"Authorization": "Bearer " + other["token"]}]
    for auth in headers:
        assert (
            client.post(
                "/api/cart/items", headers=auth, json={"productId": id, "quantity": 1}
            ).status_code
            == 200
        )
    with ThreadPoolExecutor(max_workers=2) as pool:
        statuses = list(
            pool.map(
                lambda auth: (
                    client.post("/api/orders/checkout", headers=auth).status_code
                ),
                headers,
            )
        )
    assert sorted(statuses) == [200, 400]
    with client.app.state.sessions() as db:
        assert db.get(Product, id).stock_quantity == 0
        assert db.scalar(select(func.count()).select_from(Order)) == 1
        assert db.scalar(select(func.count()).select_from(StockMovement)) == 1
