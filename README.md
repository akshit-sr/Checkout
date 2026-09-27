# Checkout + Inventory Platform

A customer storefront and an admin inventory dashboard backed by one **Python / FastAPI API**, one **React / Vite frontend**, and a shared **PostgreSQL database**.

Admins manage the same products customers browse. Catalog and stock changes reach the storefront through Server-Sent Events (SSE). Checkout records orders and stock movements in one database transaction.

## Getting started

Prerequisites:

- **uv** for Python dependency management (it can install the required Python 3.12+).
- **Node.js and npm** compatible with Vite 5 (Node 18+ per the project's toolchain).
- **PostgreSQL** running on `localhost:5432`.

The commands below use PowerShell. Start each terminal at the repository root.

### 1. Database

If `checkout_db` already exists, reuse it. Create it only on a fresh setup:

```powershell
psql -h localhost -U postgres -c "CREATE DATABASE checkout_db;"
```

The backend defaults to database user `postgres` and password `root`. If your credentials differ, set them in the backend terminal before starting:

```powershell
$env:DB_USERNAME = "postgres"
$env:DB_PASSWORD = "your-postgres-password"
```

Startup creates missing tables and seeds the admin account if its email does not exist. It does not clear existing data or reset existing passwords.

### 2. Backend: terminal one

```powershell
cd backend
uv sync --locked
uv run uvicorn app.main:app --port 8080
```

- API: <http://localhost:8080/api/products>
- Swagger UI: <http://localhost:8080/swagger-ui.html>
- OpenAPI schema: <http://localhost:8080/v3/api-docs>

Keep **one worker**: SSE broadcasts and the daily email scheduler run in-process.

### 3. Frontend: terminal two

```powershell
cd frontend
npm ci --include=dev
npm run dev
```

Open **http://localhost:5173**. The frontend proxies `/api` requests to port **8080**, so keep the backend running.

`npm` avoids PowerShell's `npm.ps1` execution-policy issue. On macOS/Linux, use `npm` instead.

### Sign in

The default seeded admin is:

- Email: `admin@gmail.com`
- Password: `123456789`

Admins land on `/admin/inventory`. Register a customer account to browse, add products to a cart, and check out. When adding an inventory product, supply its name, SKU, selling price, and stock quantity.

`ADMIN_EMAIL` and `ADMIN_PASSWORD` configure initial seeding; changing them does not reset an existing account's password. Use your own credentials and JWT secret outside local development.

## Features and behavior

- JWT login and registration with BCrypt passwords and `CUSTOMER` / `ADMIN` roles.
- Public product catalog with SSE updates after committed catalog or stock changes.
- Stock-aware cart quantities and atomic checkout, with PostgreSQL row locks to prevent concurrent overselling.
- Checkout creates a **PAID** order, captures purchase prices, records `STOCK_OUT` movements, and empties the cart. There is no payment gateway integration.
- Order transitions: `PENDING -> PAID/CANCELLED`, `PAID -> SHIPPED/CANCELLED`, and `SHIPPED -> DELIVERED`. Cancellation does not restore stock.
- Admin product CRUD, supplier listing/creation, stock movements, and low-stock detection.
- Inventory dashboard with sales and inventory summaries.
- Low-stock email alerts at **08:00 server-local time**, once SMTP is configured.
- Consistent JSON errors containing `timestamp`, `status`, `error`, and `message`.

## Architecture and project layout

| Component | Responsibility |
| --- | --- |
| `backend/app/main.py` | FastAPI app, startup/shutdown, and error handlers |
| `backend/app/checkout.py` | Authentication, storefront, cart, and order routes |
| `backend/app/inventory.py` | Admin product, supplier, and stock-movement routes |
| `backend/app/services.py` | Business rules and transactional stock/order operations |
| `backend/app/models.py` / `database.py` | Shared SQLAlchemy models and request transactions |
| `backend/app/schemas.py` / `views.py` | Input validation and camelCase API responses |
| `backend/app/security.py` | BCrypt, JWT, and role checks |
| `backend/app/events.py` / `alerts.py` | Product SSE broadcasts and scheduled email |
| `backend/app/config.py` | Environment-based configuration |
| `backend/tests/` | API, transaction, authentication, and background-service tests |
| `frontend/src/` | React storefront and shared login |
| `frontend/src/inventory/` | Admin inventory interface |

The storefront and inventory API share the `products` table. Purchases update stock and its audit trail in the same transaction; notifications are broadcast only after commit.

**Stack:** Python 3.12+, FastAPI, Uvicorn, SQLAlchemy 2, psycopg, PostgreSQL, PyJWT, BCrypt, pytest, Ruff, React 18, Vite 5, and React Router.

## Configuration

Settings come from environment variables; `.env` files are not loaded automatically. Set variables in the terminal that starts the backend.

| Variable | Default / purpose |
| --- | --- |
| `DB_URL` | `postgresql://localhost:5432/checkout_db` |
| `DB_USERNAME` / `DB_PASSWORD` | `postgres` / `root` |
| `APP_JWT_SECRET` | Development fallback; override for deployment |
| `APP_JWT_EXPIRATION_MS` | `86400000` (24 hours) |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Initial admin seed credentials above |
| `LOW_STOCK_THRESHOLD` | `10`; products can override this threshold |
| `ALERT_RECIPIENT` | `manager@example.com` |
| `MAIL_HOST` / `MAIL_PORT` | `smtp.gmail.com` / `587` |
| `MAIL_USERNAME` / `MAIL_PASSWORD` | Configure SMTP credentials; defaults are placeholders |

Mail uses authentication and STARTTLS. Delivery failures are logged without stopping the API.

### Reusing the existing database

The Python backend preserves the previous database mappings and BCrypt password compatibility. No export/import is needed for a compatible schema. From `backend/`, check it without modifying data:

```powershell
uv run python -m app.check_database
```

Existing sessions require the same `APP_JWT_SECRET`. Startup creates missing tables only; it does not automatically alter older schemas. See [backend/README.md](backend/README.md) for compatibility details and fresh-database setup.

## Key API endpoints

| Method | Endpoint | Access | Purpose |
| --- | --- | --- | --- |
| POST | `/api/auth/register`, `/api/auth/login` | Public | Register or sign in |
| GET | `/api/products`, `/api/products/{id}` | Public | Browse products |
| GET | `/api/products/stream` | Public | Product-change SSE stream |
| GET | `/api/cart` | Authenticated | Read cart |
| POST | `/api/cart/items` | Customer | Add a product |
| PUT / DELETE | `/api/cart/items/{product_id}` | Authenticated | Set quantity or remove item |
| POST | `/api/orders/checkout` | Customer | Place order |
| GET | `/api/orders` | Authenticated | Own orders |
| GET | `/api/orders/all` | Admin | All customer orders |
| PUT | `/api/orders/{id}/status` | Admin | Advance order status |
| GET / POST | `/api/inventory/products` | Admin | List or create products |
| GET / PUT / DELETE | `/api/inventory/products/{id}` | Admin | Read, update, or delete a product |
| GET | `/api/inventory/products/low-stock` | Admin | Low-stock products |
| GET / POST | `/api/inventory/suppliers` | Admin | List or create suppliers |
| POST | `/api/inventory/stock-movements` | Admin | Record stock change |
| GET | `/api/inventory/stock-movements/product/{product_id}` | Admin | Product audit history |

Swagger UI includes all routes, including admin catalog writes under `/api/products`.

## Tests and checks

From `backend/`:

```powershell
uv run pytest -q
uv run ruff check app tests
uv run ruff format --check app tests
```

The default suite uses disposable SQLite databases. To also test PostgreSQL transactions, constraints, and simultaneous checkout:

```powershell
$env:TEST_POSTGRES_URL = "postgresql+psycopg://postgres:root@localhost:5432/postgres"
uv run pytest -q
```

Use credentials for a role allowed to create schemas. PostgreSQL tests create and remove isolated `checkout_test_*` schemas; they do not use the application's tables. Email tests mock SMTP and send no real messages.

From `frontend/`, verify the production build:

```powershell
npm run build
```

## Troubleshooting

- **`'vite' is not recognized`:** dependencies are missing or dev dependencies were omitted. From `frontend/`, run `npm ci --include=dev`, then `npm run dev`. A global Vite installation is unnecessary.
- **`EPERM` involving `esbuild.exe` during installation:** stop the frontend dev server if it is running, then retry the install. If it persists, check file permissions or whether another process is holding the executable.
- **Frontend API requests fail:** confirm PostgreSQL is running and FastAPI is listening on port `8080`.
- **Database connection fails:** check `DB_URL`, `DB_USERNAME`, and `DB_PASSWORD`; create the database only if it does not already exist.
