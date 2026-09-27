# Python backend

FastAPI replacement for the Spring Boot checkout and inventory backend. The React
frontend is unchanged. All 26 existing API operations retain their paths, HTTP
methods and camelCase JSON fields, including numeric prices, JWT authentication,
admin authorization, and the public product SSE stream. Run on port **8080** so
the existing Vite proxy continues to work.

## Run

Requires PostgreSQL and Python 3.12+ (or `uv`, which can install Python).
From the repository root, in PowerShell:

```powershell
cd backend
uv sync --locked
uv run uvicorn app.main:app --host 127.0.0.1 --port 8080
```

Without uv, using an installed Python:

```powershell
cd backend
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install .
.\.venv\Scripts\python.exe -m uvicorn app.main:app --port 8080
```

The frontend still runs in a separate terminal using its existing instructions.
API documentation: <http://localhost:8080/swagger-ui.html>.
OpenAPI schema: <http://localhost:8080/v3/api-docs>.

Run **one worker**: catalog broadcasts and the daily scheduler are in-process,
as in the original Java application. Multiple workers would require a shared
event channel and a single scheduler instance.

## Existing database: no transfer required

The SQLAlchemy models use the existing Hibernate table/column names, BIGINT IDs,
numeric(38,2) money fields, timestamps, and foreign keys. Existing carts, orders,
products, suppliers, stock movements and BCrypt password hashes can be reused.
JWT signing preserves JJWT's UTF-8 secret and algorithm selection, so unexpired
tokens remain usable with the same `APP_JWT_SECRET`.

1. Stop the Java backend before switching.
2. Keep your normal PostgreSQL backup before the first write with a new backend.
3. Set the same database/JWT environment variables, if you changed the defaults.
4. Run the read-only compatibility check, then start FastAPI:

```powershell
uv run python -m app.check_database
uv run uvicorn app.main:app --port 8080
```

Startup creates **missing tables only**, and seeds the admin only if that email
does not exist. It never drops tables, clears data, changes existing passwords,
or alters existing columns. It is not a migration engine for older, incompatible
schemas; the compatibility check should pass before reusing a database.

To use an empty database instead, create a separate one (do not drop the old one):

```powershell
psql -h localhost -U postgres -c "CREATE DATABASE checkout_python;"
$env:DB_URL = "postgresql://localhost:5432/checkout_python"
uv run uvicorn app.main:app --port 8080
```

## Configuration

Environment variables are read directly; `.env` files are not loaded automatically.
The existing local-development defaults are retained.

| Variable | Default |
| --- | --- |
| `DB_URL` | `postgresql://localhost:5432/checkout_db` |
| `DB_USERNAME` / `DB_PASSWORD` | `postgres` / `root` |
| `APP_JWT_SECRET` | Same development secret as the Java backend |
| `APP_JWT_EXPIRATION_MS` | `86400000` |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | `admin@gmail.com` / `123456789` |
| `LOW_STOCK_THRESHOLD` | `10` |
| `ALERT_RECIPIENT` | `manager@example.com` |
| `MAIL_HOST` / `MAIL_PORT` | `smtp.gmail.com` / `587` |
| `MAIL_USERNAME` / `MAIL_PASSWORD` | Development placeholders; configure for email delivery |

`DB_URL` accepts the old `jdbc:postgresql://...` form as well as PostgreSQL URLs.
Embedded URL credentials take precedence over `DB_USERNAME` / `DB_PASSWORD`.
Use your own credentials and JWT secret outside local development.

Low-stock alerts run at **08:00 server-local time**, using SMTP authentication
and STARTTLS. Mail failures are logged and do not stop the API. Tests mock SMTP;
they do not send email.

## Preserved behavior and validation

- Checkout starts orders as `PAID`, decrements stock, records `STOCK_OUT` audit
  entries, and empties the cart atomically. It does not call a payment gateway.
- Legal transitions remain `PENDING -> PAID/CANCELLED`, `PAID -> SHIPPED/CANCELLED`,
  and `SHIPPED -> DELIVERED`. Cancellation does not restore stock, matching Java.
- Stock and order changes use PostgreSQL row locks; failed transactions roll back
  and do not broadcast catalog events.
- Supplier endpoints remain list/create only; no new product features were added.
- Duplicate SKUs remain allowed. Inventory PUT with a null/omitted supplier keeps
  its current supplier, matching Java.
- Errors retain `timestamp`, `status`, `error`, `message`. Invalid bodies return
  400; conflicting deletes return 409 instead of exposing a database error.
- Required numeric fields reject nulls. Money accepts up to two decimal places,
  matching database precision. Stock IN/OUT amounts must be positive; ADJUSTMENT
  accepts signed deltas. New passwords are capped at BCrypt's 72-byte limit.

## Verify

```powershell
uv run pytest -q
uv run ruff check app tests
uv run ruff format --check app tests
```

The default test suite uses disposable SQLite databases. To also exercise real
PostgreSQL transactions, foreign keys, identity generation and concurrent checkout:

```powershell
$env:TEST_POSTGRES_URL = "postgresql+psycopg://postgres:root@localhost:5432/postgres"
uv run pytest -q
```

The PostgreSQL tests create a randomly named `checkout_test_*` schema in the
specified database and remove that schema after each test. They never use the
application's existing tables. The test role needs permission to create schemas.
