"""Read-only compatibility check: python -m app.check_database."""

from sqlalchemy import func, inspect, select, text
from sqlalchemy.orm import Session

from .config import Settings
from .database import make_engine
from .models import Base, User


def main():
    engine = make_engine(Settings())
    try:
        with engine.connect() as connection, connection.begin():
            if engine.dialect.name == "postgresql":
                connection.execute(text("SET TRANSACTION READ ONLY"))
            inspector = inspect(connection)
            for table in Base.metadata.sorted_tables:
                if not inspector.has_table(table.name):
                    raise SystemExit(
                        f"Missing table: {table.name}. Use a fresh database or reconcile the old schema first."
                    )
                columns = {c["name"]: c for c in inspector.get_columns(table.name)}
                for expected in table.columns:
                    actual = columns.get(expected.name)
                    if (
                        actual is None
                        or actual["type"]._type_affinity
                        is not expected.type._type_affinity
                    ):
                        raise SystemExit(
                            f"Incompatible column: {table.name}.{expected.name}"
                        )
                count = connection.scalar(select(func.count()).select_from(table))
                print(f"{table.name}: {count} rows; mapped columns compatible")
            with Session(bind=connection) as db:
                # Load one row per model to verify ORM decoding and relationships too.
                for mapper in Base.registry.mappers:
                    db.scalars(select(mapper.class_).limit(1)).first()
                unsupported = db.scalar(
                    select(func.count())
                    .select_from(User)
                    .where(
                        ~User.password.startswith("$2a$")
                        & ~User.password.startswith("$2b$")
                        & ~User.password.startswith("$2y$")
                    )
                )
                if unsupported:
                    raise SystemExit(
                        f"{unsupported} account(s) have non-BCrypt hashes; review before switching."
                    )
            print("Compatible. No schema, account, or business data was changed.")
    finally:
        engine.dispose()


if __name__ == "__main__":
    main()
