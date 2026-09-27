from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy import select

from . import schemas, services, views
from .database import Db
from .models import Product, StockMovement, Supplier
from .security import admin_user

router = APIRouter(prefix="/api/inventory", dependencies=[Depends(admin_user)])


@router.get("/products")
def products(request: Request, db: Db):
    return [
        views.inventory_view(p, request.app.state.settings.low_stock_threshold)
        for p in db.scalars(select(Product))
    ]


@router.get("/products/low-stock")
def low_stock(request: Request, db: Db):
    threshold = request.app.state.settings.low_stock_threshold
    return [
        views.inventory_view(p, threshold) for p in services.low_stock(db, threshold)
    ]


@router.get("/products/{id}")
def product(id: int, request: Request, db: Db):
    return views.inventory_view(
        services.find(db, Product, id), request.app.state.settings.low_stock_threshold
    )


@router.post("/products")
def create_product(body: schemas.InventoryProductRequest, request: Request, db: Db):
    return views.inventory_view(
        services.save_product(db, body, inventory=True),
        request.app.state.settings.low_stock_threshold,
    )


@router.put("/products/{id}")
def update_product(
    id: int, body: schemas.InventoryProductRequest, request: Request, db: Db
):
    return views.inventory_view(
        services.save_product(db, body, id, inventory=True),
        request.app.state.settings.low_stock_threshold,
    )


@router.delete("/products/{id}", status_code=204)
def delete_product(id: int, db: Db):
    services.delete_product(db, id)
    return Response(status_code=204)


@router.get("/suppliers")
def suppliers(db: Db):
    return [views.supplier_view(s) for s in db.scalars(select(Supplier))]


@router.post("/suppliers")
def create_supplier(body: schemas.SupplierRequest, db: Db):
    supplier = Supplier(
        name=body.name, contact_email=body.contactEmail, phone=body.phone
    )
    db.add(supplier)
    db.flush()
    return views.supplier_view(supplier)


@router.post("/stock-movements")
def record_movement(body: schemas.StockMovementRequest, db: Db):
    return views.movement_view(services.record_movement(db, body))


@router.get("/stock-movements/product/{product_id}")
def history(product_id: int, db: Db):
    return [
        views.movement_view(m)
        for m in db.scalars(
            select(StockMovement)
            .where(StockMovement.product_id == product_id)
            .order_by(StockMovement.timestamp.desc())
        )
    ]
