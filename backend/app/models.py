from datetime import UTC, datetime
from decimal import Decimal

from sqlalchemy import BigInteger, DateTime, ForeignKey, Integer, Numeric, String
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


def now():
    return datetime.now(UTC)


class Base(DeclarativeBase):
    pass


# PostgreSQL BIGINT identities match Hibernate; SQLite INTEGER supports isolated tests.
Id = BigInteger().with_variant(Integer, "sqlite")
Money = Numeric(38, 2)


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(Id, primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True)
    password: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(255), default="CUSTOMER")


class Supplier(Base):
    __tablename__ = "suppliers"
    id: Mapped[int] = mapped_column(Id, primary_key=True)
    name: Mapped[str] = mapped_column(String(255))
    contact_email: Mapped[str | None] = mapped_column(String(255))
    phone: Mapped[str | None] = mapped_column(String(255))


class Product(Base):
    __tablename__ = "products"
    id: Mapped[int] = mapped_column(Id, primary_key=True)
    name: Mapped[str] = mapped_column(String(255))
    sku: Mapped[str | None] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(String(2000))
    price: Mapped[Decimal] = mapped_column(Money)
    stock_quantity: Mapped[int] = mapped_column(Integer)
    unit_cost: Mapped[Decimal | None] = mapped_column(Money)
    low_stock_threshold: Mapped[int | None] = mapped_column(Integer)
    supplier_id: Mapped[int | None] = mapped_column(ForeignKey("suppliers.id"))
    supplier: Mapped[Supplier | None] = relationship(lazy="selectin")


class Cart(Base):
    __tablename__ = "carts"
    id: Mapped[int] = mapped_column(Id, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), unique=True)
    items: Mapped[list["CartItem"]] = relationship(
        cascade="all, delete-orphan", lazy="selectin"
    )


class CartItem(Base):
    __tablename__ = "cart_items"
    id: Mapped[int] = mapped_column(Id, primary_key=True)
    cart_id: Mapped[int] = mapped_column(ForeignKey("carts.id"))
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"))
    quantity: Mapped[int] = mapped_column(Integer)
    product: Mapped[Product] = relationship(lazy="selectin")


class Order(Base):
    __tablename__ = "orders"
    id: Mapped[int] = mapped_column(Id, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    total_amount: Mapped[Decimal] = mapped_column(Money)
    status: Mapped[str] = mapped_column(String(255), default="PENDING")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), default=now
    )
    user: Mapped[User] = relationship(lazy="selectin")
    items: Mapped[list["OrderItem"]] = relationship(
        cascade="all, delete-orphan", lazy="selectin"
    )


class OrderItem(Base):
    __tablename__ = "order_items"
    id: Mapped[int] = mapped_column(Id, primary_key=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("orders.id"))
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"))
    quantity: Mapped[int] = mapped_column(Integer)
    unit_price_at_purchase: Mapped[Decimal] = mapped_column(Money)
    product: Mapped[Product] = relationship(lazy="selectin")


class StockMovement(Base):
    __tablename__ = "stock_movements"
    id: Mapped[int] = mapped_column(Id, primary_key=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"))
    type: Mapped[str] = mapped_column(String(255))
    quantity_changed: Mapped[int] = mapped_column(Integer)
    resulting_quantity: Mapped[int] = mapped_column(Integer)
    performed_by: Mapped[str | None] = mapped_column(String(255))
    reason: Mapped[str | None] = mapped_column(String(255))
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    product: Mapped[Product] = relationship(lazy="selectin")
