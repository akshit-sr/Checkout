# Checkout + Inventory Platform

A full-stack e-commerce platform: a customer **storefront** and an admin **inventory back
office**, running as **one Spring Boot backend** and **one React front-end** against a single
PostgreSQL database. The admin manages the catalog and stock in the inventory dashboard; changes
flow to the storefront in real time, and customer purchases flow back into the inventory audit trail
— all in-process.

> **Two commands to run it:** `mvn spring-boot:run` (backend) and `npm run dev` (frontend).

## Architecture

One process, one database, two experiences:

| Area | Role | URL |
|------|------|-----|
| **Storefront** | Catalog, cart, checkout, orders (customers) | React route `/` |
| **Inventory back office** | Products, suppliers, stock movements, low-stock alerts (admins) | React route `/admin/inventory` |
| **Backend** | Spring Boot REST API for both | `http://localhost:8080` |
| **Database** | Storefront + inventory tables | `checkout_db` (Postgres) |

```
Admin signs in ─▶ redirected in-app to /admin/inventory
Inventory: add/edit product or record a stock movement
   └─▶ same shared product row updates ─▶ SSE ─▶ storefront updates live
Customer checks out
   └─▶ stock decremented + logged as a STOCK_OUT movement (audit trail)
```

### How it fits together
- **One login, role-based** — the backend issues a JWT; the same session drives both the storefront
  and the admin dashboard. Admins land on `/admin/inventory`; the inventory API is `ADMIN`-only.
- **One shared product** — the storefront and the inventory back office read and write the **same
  `Product`** table. The customer-facing fields (name, price, stock, description) live alongside the
  warehouse fields (unit cost, supplier, reorder threshold). No sync, no duplication — editing a
  product in the inventory tab *is* editing the storefront product.
- **Live updates** — every product create/edit and every stock movement broadcasts a **Server-Sent
  Event**, so shoppers already browsing see updated stock, prices, and new products without reloading.
- **Sales audit trail** — each checkout decrements stock and logs a `STOCK_OUT` movement, so the
  stock-movement history reflects sales as well as admin restocks and adjustments.

## Features

**Storefront**
- Registration/login with **JWT authentication** and roles (`CUSTOMER` / `ADMIN`)
- Product catalog with **live updates over Server-Sent Events**
- Cart with per-item quantity controls and stock-aware validation
- Checkout that converts a cart into an order and decrements stock atomically
- Order status **state machine**: `PENDING → PAID → SHIPPED → DELIVERED` (or `CANCELLED`)
- Admins fulfil/advance orders from the same Orders view (newest first)

**Inventory back office** (`/admin/inventory`)
- **Dashboard** with live sales stats (revenue, orders, units sold, awaiting shipment) and inventory
  stats (products, units, value, low stock, suppliers) plus a low-stock alert table
- Product & supplier management (CRUD) — the single place to add/edit products
- **Stock-movement audit log** — every change (IN/OUT/ADJUSTMENT) records who, why, and the result
- **Low-stock detection** with a scheduled daily email alert
- Admin-only, sharing the storefront session

Both: global exception handling with consistent JSON errors, unit tests (JUnit 5 + Mockito), and
Swagger/OpenAPI docs at `/swagger-ui.html`.

## Tech Stack
Java 17 · Spring Boot 3 · Spring Security · Spring Data JPA · Hibernate · PostgreSQL · JWT (jjwt) ·
Server-Sent Events · Spring Mail · Maven · JUnit/Mockito · React 18 · Vite · React Router

## Getting started

**Prerequisites:** Java 17+, Node 18+, PostgreSQL on `localhost:5432`.

```bash
# 1. Create the database (Postgres does not auto-create it)
psql -U postgres -c "CREATE DATABASE checkout_db;"

# 2. Backend  (:8080)  — from the project root
mvn spring-boot:run

# 3. Frontend (:5173)
cd frontend && npm install && npm run dev
```

Open **http://localhost:5173**. Sign in as the seeded admin (`admin@gmail.com` / `123456789`) to be
taken to the inventory dashboard, or register a customer account to shop. Add a product in the
dashboard (name, selling price, stock — SKU optional) and it appears on the storefront live.

### Configuration
Settings are read from environment variables with local-dev fallbacks (see
`src/main/resources/application.properties`): database (`DB_URL`/`DB_USERNAME`/`DB_PASSWORD`), JWT
(`APP_JWT_SECRET`), seeded admin (`ADMIN_EMAIL`/`ADMIN_PASSWORD`), low-stock alert mail (`MAIL_*`,
`ALERT_RECIPIENT`). For any real deployment, set a fresh `APP_JWT_SECRET` and real DB/mail credentials.

## Key endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/register` · `/api/auth/login` | Public | Register / login, returns JWT |
| GET | `/api/products` | Public | List storefront products |
| GET | `/api/products/stream` | Public | Live catalog updates (SSE) |
| POST | `/api/cart/items` | Customer | Add item to cart |
| POST | `/api/orders/checkout` | Customer | Convert cart → order |
| PUT | `/api/orders/{id}/status` | Admin | Advance order status |
| GET/POST/PUT/DELETE | `/api/inventory/products` · `/api/inventory/suppliers` | Admin | Manage catalog & suppliers |
| POST | `/api/inventory/stock-movements` | Admin | Record a stock change |
| GET | `/api/inventory/stock-movements/product/{id}` | Admin | Full audit history |

## Running tests
```bash
mvn test
```
Covers the order state machine and the stock-movement logic incl. negative-stock rejection, using
Mockito to isolate the service layer.

## Possible next steps
- Add pagination and filtering to the product listings
- Add integration tests with Testcontainers for PostgreSQL
- Provide a `docker-compose` setup (app + Postgres) for one-command startup
- Integrate a payment provider (Stripe/PayPal) at the checkout step
