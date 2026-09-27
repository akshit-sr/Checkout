import os
from dataclasses import dataclass, field

from sqlalchemy.engine import URL, make_url


@dataclass
class Settings:
    db_url: str = field(
        default_factory=lambda: os.getenv(
            "DB_URL", "postgresql://localhost:5432/checkout_db"
        )
    )
    db_username: str = field(
        default_factory=lambda: os.getenv("DB_USERNAME", "postgres")
    )
    db_password: str = field(default_factory=lambda: os.getenv("DB_PASSWORD", "root"))
    jwt_secret: str = field(
        default_factory=lambda: os.getenv(
            "APP_JWT_SECRET",
            "YIjWMUh/8Kof5ZLnKTWY0pQHWFG4IcMaYfAoILZ7iwcpqYDjdIx8umjlCiWF+fDn3E7s6MxgvnyH8vdYlI0EkA==",
        )
    )
    jwt_expiration_ms: int = field(
        default_factory=lambda: int(os.getenv("APP_JWT_EXPIRATION_MS", "86400000"))
    )
    admin_email: str = field(
        default_factory=lambda: os.getenv("ADMIN_EMAIL", "admin@gmail.com")
    )
    admin_password: str = field(
        default_factory=lambda: os.getenv("ADMIN_PASSWORD", "123456789")
    )
    low_stock_threshold: int = field(
        default_factory=lambda: int(os.getenv("LOW_STOCK_THRESHOLD", "10"))
    )
    alert_recipient: str = field(
        default_factory=lambda: os.getenv("ALERT_RECIPIENT", "manager@example.com")
    )
    mail_host: str = field(
        default_factory=lambda: os.getenv("MAIL_HOST", "smtp.gmail.com")
    )
    mail_port: int = field(default_factory=lambda: int(os.getenv("MAIL_PORT", "587")))
    mail_username: str = field(
        default_factory=lambda: os.getenv("MAIL_USERNAME", "your-email@gmail.com")
    )
    mail_password: str = field(
        default_factory=lambda: os.getenv("MAIL_PASSWORD", "your-app-password")
    )

    @property
    def database_url(self) -> URL:
        url = make_url(self.db_url.removeprefix("jdbc:"))
        if url.get_backend_name() == "postgresql":
            url = url.set(
                drivername="postgresql+psycopg",
                username=url.username or self.db_username,
                password=url.password if url.password is not None else self.db_password,
            )
        return url

    @property
    def jwt_algorithm(self) -> str:
        # JJWT chooses an HMAC algorithm from the UTF-8 key length, NOT base64 decoding.
        length = len(self.jwt_secret.encode())
        if length < 32:
            raise ValueError("APP_JWT_SECRET must contain at least 32 UTF-8 bytes")
        return "HS512" if length >= 64 else "HS384" if length >= 48 else "HS256"
