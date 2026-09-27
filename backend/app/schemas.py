from decimal import Decimal
from typing import Annotated, Literal

from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator

Name = Annotated[str, Field(min_length=1, max_length=255, pattern=r"\S")]
Text = Annotated[str, Field(max_length=255)]
Quantity = Annotated[int, Field(strict=True, ge=0, le=2147483647)]
Price = Annotated[Decimal, Field(gt=0, max_digits=38, decimal_places=2)]
OrderStatus = Literal["PENDING", "PAID", "SHIPPED", "DELIVERED", "CANCELLED"]


class LoginRequest(BaseModel):
    email: str
    password: str = Field(min_length=1, pattern=r"\S")

    @field_validator("email")
    @classmethod
    def valid_email(cls, value):
        # Validate without normalizing: existing Java accounts match email case exactly.
        from pydantic import TypeAdapter

        TypeAdapter(EmailStr).validate_python(value)
        if len(value) > 255:
            raise ValueError("Email is too long")
        return value


class RegisterRequest(LoginRequest):
    password: str = Field(min_length=8, pattern=r"\S")

    @field_validator("password")
    @classmethod
    def bcrypt_limit(cls, value):
        if len(value.encode()) > 72:
            raise ValueError("Password must be at most 72 UTF-8 bytes")
        return value


class ProductRequest(BaseModel):
    name: Name
    description: str | None = Field(default=None, max_length=2000)
    price: Price
    stockQuantity: Quantity


class InventoryProductRequest(BaseModel):
    name: Name
    sku: Name
    description: str | None = Field(default=None, max_length=2000)
    sellingPrice: Price
    quantityInStock: Quantity
    lowStockThreshold: int | None = None
    unitCost: Price | None = None
    supplierId: int | None = None


class SupplierRequest(BaseModel):
    name: Name
    contactEmail: EmailStr | Literal[""] | None = None
    phone: Text | None = None


class AddItemRequest(BaseModel):
    productId: int
    quantity: Quantity = Field(ge=1)


class SetQuantityRequest(BaseModel):
    quantity: Quantity


class UpdateStatusRequest(BaseModel):
    status: OrderStatus


class StockMovementRequest(BaseModel):
    productId: int
    type: Literal["STOCK_IN", "STOCK_OUT", "ADJUSTMENT"]
    quantity: int = Field(strict=True, ge=-2147483648, le=2147483647)
    performedBy: Text | None = None
    reason: Text | None = None

    @model_validator(mode="after")
    def valid_direction(self):
        if self.type != "ADJUSTMENT" and self.quantity <= 0:
            raise ValueError("STOCK_IN and STOCK_OUT quantity must be positive")
        return self
