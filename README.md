# Checkout API

A RESTful e-commerce checkout service built with **Spring Boot**, supporting cart management,
order creation, and payment status tracking through a JWT-secured API.

## Features
- User registration/login with **JWT authentication**
- **Role-based access control** (CUSTOMER vs ADMIN)
- Product catalog (public read, admin-only write)
- Cart management (add/remove items)
- Checkout flow that converts a cart into an order, decrements stock atomically
- Order status **state machine**: `PENDING → PAID → SHIPPED → DELIVERED` (or `CANCELLED`)
- Global exception handling with consistent JSON error responses
- Unit tests with **JUnit 5 + Mockito**
- API docs via Swagger/OpenAPI at `/swagger-ui.html`

## Tech Stack
Java 17 · Spring Boot 3 · Spring Security · Spring Data JPA · Hibernate · PostgreSQL · JWT (jjwt) · Maven · JUnit/Mockito

## Project Structure
```
src/main/java/com/example/checkout/
├── controller/     REST endpoints
├── service/        Business logic
├── repository/     Spring Data JPA interfaces
├── model/          JPA entities
├── dto/            Request/response records
├── security/       JWT filter + util
├── config/         Spring Security config
└── exception/      Custom exception + global handler
```

## Setup

1. Create a PostgreSQL database (unlike MySQL, Postgres won't auto-create it, so run this first):
   ```sql
   CREATE DATABASE checkout_db;
   ```
2. Update `src/main/resources/application.properties` with your PostgreSQL username/password
   (defaults assume user `postgres` on `localhost:5432`).
3. **Important:** replace `app.jwt.secret` with a long random string before deploying anywhere real —
   never commit real secrets. For local dev, an env var is safer:
   ```bash
   export APP_JWT_SECRET=$(openssl rand -base64 32)
   ```
   and reference it in properties as `${APP_JWT_SECRET}`.
4. Run:
   ```bash
   ./mvnw spring-boot:run
   ```
5. API available at `http://localhost:8080`. Swagger UI at `http://localhost:8080/swagger-ui.html`.

## Key Endpoints

| Method | Endpoint                  | Auth        | Description                  |
|--------|----------------------------|-------------|------------------------------|
| POST   | /api/auth/register          | Public      | Register new user            |
| POST   | /api/auth/login              | Public      | Login, returns JWT           |
| GET    | /api/products                | Public      | List products                |
| POST   | /api/products                | ADMIN       | Create product               |
| GET    | /api/cart                    | Authenticated | View current cart          |
| POST   | /api/cart/items               | Authenticated | Add item to cart           |
| POST   | /api/orders/checkout          | Authenticated | Convert cart → order       |
| GET    | /api/orders                   | Authenticated | List my orders              |
| PUT    | /api/orders/{id}/status        | ADMIN       | Transition order status      |

## Running Tests
```bash
./mvnw test
```
Includes unit tests for the order status state machine (valid/invalid transitions) using Mockito
to isolate the service layer from the database.

## Notes / Next Steps
- Add refresh tokens (current JWT is stateless with a fixed expiry)
- Add pagination to `/api/products`
- Add integration tests with `@SpringBootTest` + Testcontainers for MySQL
- Add a payment provider integration (Stripe/PayPal) at the checkout step
