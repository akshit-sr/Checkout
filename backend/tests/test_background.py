import asyncio
from datetime import datetime
from unittest.mock import patch

from app.alerts import seconds_until_alert, send_low_stock_alert
from app.config import Settings
from app.events import ProductEvents
from app.main import initialize


def test_jdbc_url_and_jwt_compatibility():
    settings = Settings(
        db_url="jdbc:postgresql://localhost:5432/checkout_db", db_password="a@b:c"
    )
    assert settings.database_url.drivername == "postgresql+psycopg"
    assert settings.database_url.password == "a@b:c"
    assert settings.jwt_algorithm == "HS512"
    assert Settings(jwt_secret="x" * 32).jwt_algorithm == "HS256"
    assert Settings(jwt_secret="x" * 48).jwt_algorithm == "HS384"


def test_event_broadcast_and_cleanup():
    async def check():
        events = ProductEvents()
        first, second = events.stream(), events.stream()
        assert await anext(first) == "event: connected\ndata: ok\n\n"
        await anext(second)
        events.broadcast("stock-changed")
        assert await anext(first) == "event: products-changed\ndata: stock-changed\n\n"
        assert await anext(second) == "event: products-changed\ndata: stock-changed\n\n"
        await first.aclose()
        await second.aclose()
        assert not events.subscribers

    asyncio.run(check())


def test_alert_schedule():
    assert seconds_until_alert(datetime(2026, 9, 27, 7, 59)) == 60
    assert seconds_until_alert(datetime(2026, 9, 27, 8)) == 86400


def test_mail_and_idempotent_startup(client, admin, product):
    client.put(
        f"/api/products/{product['id']}",
        headers=admin,
        json={"name": "Widget", "price": 12.5, "stockQuantity": 2},
    )
    with patch("app.alerts.smtplib.SMTP") as smtp:
        send_low_stock_alert(client.app.state.sessions, client.app.state.settings)
        message = smtp.return_value.__enter__.return_value.send_message.call_args.args[
            0
        ]
        assert message["Subject"] == "Low Stock Alert: 1 product(s) need reordering"
        assert (
            "Widget" in message.get_content()
            and "2 units remaining" in message.get_content()
        )
    initialize(
        client.app.state.engine, client.app.state.sessions, client.app.state.settings
    )
    assert client.get(f"/api/products/{product['id']}").json()["stockQuantity"] == 2
    assert (
        client.post(
            "/api/auth/login",
            json={"email": "admin@gmail.com", "password": "123456789"},
        ).status_code
        == 200
    )
