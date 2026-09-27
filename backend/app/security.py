from datetime import timedelta
from typing import Annotated

import bcrypt
import jwt
from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select

from .database import Db
from .models import User, now

bearer = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    if len(password.encode()) > 72:
        raise ValueError("Password must be at most 72 UTF-8 bytes")
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt(rounds=10)).decode()


def verify_password(password: str, stored: str) -> bool:
    try:
        # Legacy BCrypt hashes use $2a$; old implementations truncate after 72 bytes.
        return bcrypt.checkpw(password.encode()[:72], stored.encode())
    except ValueError:
        return False


def auth_response(user, settings):
    issued = now()
    token = jwt.encode(
        {
            "sub": user.email,
            "role": user.role,
            "iat": issued,
            "exp": issued + timedelta(milliseconds=settings.jwt_expiration_ms),
        },
        settings.jwt_secret,
        algorithm=settings.jwt_algorithm,
    )
    return {"token": token, "email": user.email, "role": user.role}


def current_user(
    request: Request,
    db: Db,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)],
):
    if credentials is None:
        raise HTTPException(401, "Authentication required")
    settings = request.app.state.settings
    try:
        claims = jwt.decode(
            credentials.credentials,
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm],
            options={"require": ["sub", "exp"]},
        )
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Invalid or expired token") from None
    user = db.scalar(select(User).where(User.email == claims["sub"]))
    if user is None:
        raise HTTPException(401, "User not found")
    return user


CurrentUser = Annotated[User, Depends(current_user)]


def admin_user(user: CurrentUser):
    if user.role != "ADMIN":
        raise HTTPException(403, "Admin access required")
    return user


AdminUser = Annotated[User, Depends(admin_user)]
