from typing import Annotated

from fastapi import Depends, Request
from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session

from .config import Settings


def make_engine(settings: Settings):
    url = settings.database_url
    engine = create_engine(
        url,
        pool_pre_ping=True,
        connect_args={"check_same_thread": False}
        if url.get_backend_name() == "sqlite"
        else {},
    )
    if url.get_backend_name() == "sqlite":

        @event.listens_for(engine, "connect")
        def enable_foreign_keys(connection, _):
            connection.execute("PRAGMA foreign_keys=ON")

    return engine


def get_db(request: Request):
    with request.app.state.sessions() as db:
        with db.begin():
            yield db
        # Reached only after a successful commit. Failed transactions never emit events.
        if action := db.info.get("product_event"):
            request.app.state.events.broadcast(action)


Db = Annotated[Session, Depends(get_db, scope="function")]
