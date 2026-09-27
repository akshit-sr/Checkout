from fastapi import APIRouter, HTTPException, Request, Response
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from . import schemas, services, views
from .database import Db
from .models import Order, Product, User
from .security import (
    AdminUser,
    CurrentUser,
    auth_response,
    hash_password,
    verify_password,
)

router = APIRouter(prefix="/api")


@router.post("/auth/register")
def register(body: schemas.RegisterRequest, request: Request, db: Db):
    if db.scalar(select(User.id).where(User.email == body.email)) is not None:
        raise HTTPException(409, "Email already registered")
    user = User(
        email=body.email, password=hash_password(body.password), role="CUSTOMER"
    )
    db.add(user)
    try:
        db.flush()
    except IntegrityError:
        raise HTTPException(409, "Email already registered") from None
    return auth_response(user, request.app.state.settings)


@router.post("/auth/login")
def login(body: schemas.LoginRequest, request: Request, db: Db):
    user = db.scalar(select(User).where(User.email == body.email))
    if user is None or not verify_password(body.password, user.password):
        raise HTTPException(401, "Invalid email or password")
    return auth_response(user, request.app.state.settings)


@router.get("/products/stream")
async def stream(request: Request):
    return StreamingResponse(
        request.app.state.events.stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.get("/products")
def products(db: Db):
    return [views.product_view(p) for p in db.scalars(select(Product))]


@router.get("/products/{id}")
def product(id: int, db: Db):
    return views.product_view(services.find(db, Product, id))


@router.post("/products")
def create_product(body: schemas.ProductRequest, db: Db, admin: AdminUser):
    return views.product_view(services.save_product(db, body))


@router.put("/products/{id}")
def update_product(id: int, body: schemas.ProductRequest, db: Db, admin: AdminUser):
    return views.product_view(services.save_product(db, body, id))


@router.delete("/products/{id}", status_code=204)
def delete_product(id: int, db: Db, admin: AdminUser):
    services.delete_product(db, id)
    return Response(status_code=204)


@router.get("/cart")
def cart(db: Db, user: CurrentUser):
    return views.cart_view(services.get_cart(db, user))


@router.post("/cart/items")
def add_item(body: schemas.AddItemRequest, db: Db, user: CurrentUser):
    return views.cart_view(services.add_item(db, user, body))


@router.put("/cart/items/{product_id}")
def set_quantity(
    product_id: int, body: schemas.SetQuantityRequest, db: Db, user: CurrentUser
):
    return views.cart_view(services.set_quantity(db, user, product_id, body.quantity))


@router.delete("/cart/items/{product_id}")
def remove_item(product_id: int, db: Db, user: CurrentUser):
    cart = services.get_cart(db, user)
    cart.items[:] = [i for i in cart.items if i.product_id != product_id]
    db.flush()
    return views.cart_view(cart)


@router.post("/orders/checkout")
def checkout(db: Db, user: CurrentUser):
    return views.order_view(services.checkout(db, user))


@router.get("/orders")
def orders(db: Db, user: CurrentUser):
    return [
        views.order_view(o)
        for o in db.scalars(
            select(Order).where(Order.user_id == user.id).order_by(Order.id.desc())
        )
    ]


@router.get("/orders/all")
def all_orders(db: Db, admin: AdminUser):
    return [
        views.order_view(o) for o in db.scalars(select(Order).order_by(Order.id.desc()))
    ]


@router.put("/orders/{id}/status")
def update_status(id: int, body: schemas.UpdateStatusRequest, db: Db, admin: AdminUser):
    return views.order_view(services.update_status(db, id, body.status))
