# Checkout + Inventory — Personal Dev Notes

> **Private file.** Working reference for how the whole system fits together.

---

## 1. What this is

**One** full-stack app: a customer storefront + an admin inventory back office, running as a single
Spring Boot backend (`:8080`) and a single React frontend (`:5173`) against one Postgres DB
(`checkout_db`). Merged down from what used to be two separate services.

- **CUSTOMER** — browses products, cart, checkout, own orders. Storefront routes (`/`, `/cart`, `/orders`).
- **ADMIN** — cannot shop. After login is sent in-app to `/admin/inventory` (full-screen dashboard with
  its own sidebar) to manage products/suppliers/stock movements/low-stock alerts. Also uses `/admin` for
  orders/shipping + sales stats.

**Run it (2 commands):**
```bash
psql -U postgres -c "CREATE DATABASE checkout_db;"   # once
mvn spring-boot:run                                  # backend :8080
cd frontend && npm install && npm run dev            # frontend :5173
```
> No Maven wrapper committed and Maven wasn't on PATH last session, so the **backend wasn't compiled
> locally** — run `mvn compile` / `mvn test` to confirm. Frontend builds clean (`npm run build`, verified).

Login: admin `admin@gmail.com` / `123456789` (auto-seeded by `DataInitializer`, idempotent).

---

## 2. How the merge works (the resume-grade bit)

Single Spring context, single datasource. `CheckoutApiApplication` scans `com.example` (both the
`checkout` and `inventory` packages), `@EntityScan`/`@EnableJpaRepositories` widened, `@EnableScheduling`
added for the low-stock job.

- **Two product tables, linked by SKU.** Storefront `checkout.model.Product` (table `products`) is what
  customers see. Warehouse `inventory.model.InventoryProduct` (table `inventory_products`) is the source
  of truth the admin edits. Renamed from `Product` → `InventoryProduct` so the two JPA entities / Spring
  beans don't collide in one context (also renamed its repo/service/controller with an `Inventory` prefix).
- **In-process sync replaces the old REST hops:**
  - inventory create/update/stock-movement → calls `checkout.ProductService.upsertFromSync(...)` directly
    (upsert by SKU) → fires the existing SSE so the storefront updates live.
  - checkout `OrderService.checkout()` → in `afterCommit`, calls
    `inventory.StockMovementService.recordSaleBySku(...)` directly to log each sale as a `STOCK_OUT`.
  - Both directions wrapped in try/catch — best-effort, never breaks the caller.
- **Endpoints:** inventory API moved under `/api/inventory/**` (products, suppliers, stock-movements) to
  avoid clashing with the storefront's `/api/products`. Secured `ADMIN`-only in checkout `SecurityConfig`.
- **Deleted as redundant:** inventory's own `SecurityConfig`/`JwtUtil`/`JwtAuthFilter`, both REST sync
  clients (`InventorySyncClient`, `CheckoutSyncService`), both `/api/internal` controllers + DTOs, the 2nd
  `@SpringBootApplication`. One JWT stack (checkout's) now serves everything.
- **Exception handlers:** inventory advice scoped to `basePackages=com.example.inventory` +
  `@Order(HIGHEST_PRECEDENCE)`; checkout advice is the `@Order(LOWEST_PRECEDENCE)` global fallback.

---

## 3. Frontend merge

Single Vite app. Inventory admin UI copied into `frontend/src/inventory/` (`pages/`, `components/ui.jsx`,
`api/client.js`, `InventoryApp.jsx`) and mounted at `/admin/inventory/*` under the `AdminOnly` gate.
`App.jsx` renders that route full-screen (no storefront nav/container). Login sends admins to
`/admin/inventory`; nav has an in-app "Inventory" link (no more cross-origin `/sso?token=` redirect —
`config.js` deleted).

- `inventory/api/client.js` — fetch wrapper, base `/api/inventory`, reuses the checkout token
  (`getToken` from `../../api.js`), bounces to `/login` on 401/403.
- CSS: inventory `styles.css` scoped under `.inv-scope` (generated via a Node transform →
  `frontend/src/inventory/inventory.css`) so its dashboard classes (`.nav`, `.card`, `.btn`, `.badge`…)
  don't collide with the storefront stylesheet. Imported inside `InventoryApp.jsx`.

---

## 4. Config & secrets

All in `src/main/resources/application.properties` with local-dev fallbacks:

| Purpose | Env var |
|---|---|
| DB | `DB_URL` / `DB_USERNAME` / `DB_PASSWORD` (one DB now) |
| JWT secret | `APP_JWT_SECRET` |
| JWT expiry | `APP_JWT_EXPIRATION_MS` |
| Admin seed | `ADMIN_EMAIL` / `ADMIN_PASSWORD` |
| Low-stock alert | `LOW_STOCK_THRESHOLD`, `ALERT_RECIPIENT`, `MAIL_*` |

For prod: fresh `APP_JWT_SECRET`, real DB/mail creds. Committed dev fallbacks are public — treat as compromised.

---

## 5. TODO / ideas

- [ ] Run `mvn compile` / `mvn test` to confirm the backend builds (no Maven locally this session).
- [ ] Commit a Maven wrapper (`mvnw`).
- [ ] Collapse the two product tables into one entity (storefront + warehouse fields) to drop the SKU sync.
- [ ] Reconcile pre-existing checkout products (no SKU) with inventory.
- [ ] `docker-compose` (app + Postgres) for one-command setup.

---

## 6. Git
- Remote: `https://github.com/akshit-sr/Checkout.git` (branch `main`).
- The old `inventory-system/` dir is deleted; its code now lives under `src/main/java/com/example/inventory`
  and `frontend/src/inventory`.
