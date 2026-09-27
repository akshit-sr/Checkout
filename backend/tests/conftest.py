import os
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.schema import CreateSchema, DropSchema

from app.config import Settings
from app.database import make_engine
from app.main import create_app


@pytest.fixture(
    params=["sqlite"] + (["postgresql"] if os.getenv("TEST_POSTGRES_URL") else [])
)
def client(request, tmp_path):
    settings = Settings(db_url=f"sqlite:///{tmp_path / 'test.db'}")
    schema = None
    admin_engine = None
    if request.param == "postgresql":
        schema = "checkout_test_" + uuid4().hex
        admin_engine = create_engine(os.environ["TEST_POSTGRES_URL"])
        with admin_engine.begin() as connection:
            connection.execute(CreateSchema(schema))
        engine = create_engine(
            os.environ["TEST_POSTGRES_URL"],
            connect_args={"options": f"-csearch_path={schema}"},
        )
    else:
        engine = make_engine(settings)
    app = create_app(settings, engine=engine, enable_alerts=False)
    try:
        with TestClient(app) as test_client:
            yield test_client
    finally:
        engine.dispose()
        if schema:
            with admin_engine.begin() as connection:
                connection.execute(DropSchema(schema, cascade=True))
            admin_engine.dispose()


@pytest.fixture
def admin(client):
    response = client.post(
        "/api/auth/login", json={"email": "admin@gmail.com", "password": "123456789"}
    )
    assert response.status_code == 200, response.text
    return {"Authorization": "Bearer " + response.json()["token"]}


@pytest.fixture
def customer(client):
    response = client.post(
        "/api/auth/register",
        json={"email": "customer@example.com", "password": "password123"},
    )
    assert response.status_code == 200, response.text
    return {"Authorization": "Bearer " + response.json()["token"]}


@pytest.fixture
def product(client, admin):
    response = client.post(
        "/api/inventory/products",
        headers=admin,
        json={
            "name": "Widget",
            "sku": "WID-001",
            "sellingPrice": 12.50,
            "quantityInStock": 20,
            "unitCost": 5,
            "lowStockThreshold": 10,
        },
    )
    assert response.status_code == 200, response.text
    return response.json()
