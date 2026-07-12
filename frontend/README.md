# Checkout Frontend (React + Vite)

A React storefront for the `checkout-api` Spring Boot backend.

## Features
- Register / login (JWT stored in `localStorage`)
- Browse products
- Add to / remove from cart, view line totals
- Checkout → creates an order
- View your past orders with status badges

## Prerequisites
- The backend running on **http://localhost:8080**
- Node.js 18+

## Run (development)
```bash
npm install
npm run dev
```
Open http://localhost:5173

The dev server proxies all `/api/*` requests to `http://localhost:8080`
(see `vite.config.js`), so no backend CORS config is needed.

## Build (production)
```bash
npm run build      # outputs to dist/
npm run preview    # serve the built app locally
```
For production you'd either serve `dist/` behind a reverse proxy that forwards
`/api` to the backend, or add CORS config to the Spring Boot app.

## Notes
- New users register as `CUSTOMER`. Creating/editing products is `ADMIN`-only
  (enforced by the backend). Promote a user in the DB to test admin actions:
  `UPDATE users SET role = 'ADMIN' WHERE email = 'you@example.com';`
