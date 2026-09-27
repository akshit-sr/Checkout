import asyncio
import logging
from contextlib import asynccontextmanager, suppress
from http import HTTPStatus

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import sessionmaker
from starlette.exceptions import HTTPException

from . import checkout, inventory
from .alerts import daily_alerts
from .config import Settings
from .database import make_engine
from .events import ProductEvents
from .models import Base, User, now
from .security import hash_password

log = logging.getLogger(__name__)


def initialize(engine, sessions, settings):
    # Existing tables are never altered or cleared. New databases get the same schema.
    Base.metadata.create_all(engine)
    with sessions.begin() as db:
        if db.scalar(select(User.id).where(User.email == settings.admin_email)) is None:
            db.add(
                User(
                    email=settings.admin_email,
                    password=hash_password(settings.admin_password),
                    role="ADMIN",
                )
            )


def error_response(status, message):
    return JSONResponse(
        status_code=status,
        content={
            "timestamp": now().isoformat().replace("+00:00", "Z"),
            "status": status,
            "error": HTTPStatus(status).phrase,
            "message": message,
        },
    )


def create_app(
    settings=None, *, engine=None, enable_alerts=True, initialize_database=True
):
    settings = settings or Settings()
    settings.jwt_algorithm  # Fail early for a misconfigured signing key.
    engine = engine if engine is not None else make_engine(settings)
    sessions = sessionmaker(engine, expire_on_commit=False)

    @asynccontextmanager
    async def lifespan(app):
        if initialize_database:
            await asyncio.to_thread(initialize, engine, sessions, settings)
        app.state.events = ProductEvents()
        alert_task = (
            asyncio.create_task(daily_alerts(sessions, settings))
            if enable_alerts
            else None
        )
        try:
            yield
        finally:
            if alert_task:
                alert_task.cancel()
                with suppress(asyncio.CancelledError):
                    await alert_task
            engine.dispose()

    app = FastAPI(
        title="Checkout + Inventory API",
        lifespan=lifespan,
        docs_url="/swagger-ui.html",
        openapi_url="/v3/api-docs",
    )
    app.state.settings, app.state.sessions, app.state.engine = (
        settings,
        sessions,
        engine,
    )

    @app.exception_handler(HTTPException)
    async def http_error(request: Request, exc):
        return error_response(exc.status_code, str(exc.detail))

    @app.exception_handler(RequestValidationError)
    async def validation_error(request: Request, exc):
        error = exc.errors()[0]
        field = ".".join(str(part) for part in error["loc"] if part != "body")
        return error_response(
            400, f"{field}: {error['msg']}" if field else error["msg"]
        )

    @app.exception_handler(IntegrityError)
    async def integrity_error(request: Request, exc):
        return error_response(
            409, "Operation conflicts with existing or referenced data"
        )

    @app.exception_handler(Exception)
    async def server_error(request: Request, exc):
        log.error("Unhandled API error", exc_info=exc)
        return error_response(500, "Something went wrong")

    app.include_router(checkout.router)
    app.include_router(inventory.router)
    return app


app = create_app()
