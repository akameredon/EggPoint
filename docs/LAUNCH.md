# EggPoint Launch Checklist (August 2026)

## Product flow (live path)

1. Buyer opens farm batch → **Request Group Delivery**
2. GPS or map pin (no long address form)
3. Name · phone · crates · **Pay online** or **Pay on delivery (COD)**
4. Online → Flutterwave → return to `/order/:buyerToken`
5. Admin sees geo-clusters (`GET /api/admin/order-groups`) → dispatch with pickup point/window
6. Driver opens `/driver/:driverToken` → **Handed to buyer**
7. Buyer opens track link → **I have picked up my eggs**
8. Order **COMPLETED** only when **both** confirm

## Environment (production)

```bash
DATABASE_URL=           # Postgres
FLW_SECRET_KEY=         # Flutterwave secret (egg orders + featured)
FLW_PUBLIC_KEY=         # optional client
APP_BASE_URL=https://your-domain.com   # magic links + payment redirect
# or REPLIT_DOMAINS=your-domain.com
SESSION_SECRET=
```

## Deploy steps

```bash
pnpm install
pnpm --filter @workspace/db run push   # applies orders + GPS columns
# build + start api + eggpoint per your host (Replit / VPS / Railway)
```

Smoke test on one real Imo route:

1. Create ACTIVE batch with real crate price
2. Place COD order with GPS pin
3. Admin dispatch group
4. Open driver link → confirm handover
5. Open buyer link → confirm pickup
6. Status must be `COMPLETED`
7. Repeat with ONLINE payment (small amount) if FLW keys live

## API surface (orders)

| Method | Path | Who |
|--------|------|-----|
| POST | `/api/orders` | Public checkout |
| POST | `/api/orders/verify-payment` | After FLW |
| GET | `/api/orders/by-token/:buyerToken` | Buyer track |
| POST | `/api/orders/by-token/:buyerToken/confirm-pickup` | Buyer |
| GET | `/api/orders/driver/:driverToken` | Driver |
| POST | `/api/orders/driver/:driverToken/confirm-handover` | Driver |
| GET | `/api/admin/orders` | Admin |
| GET | `/api/admin/order-groups` | Admin |
| POST | `/api/admin/order-groups/dispatch` | Admin |

## Still optional (not blocking soft launch)

- SMS/WhatsApp auto-send of track + driver links
- Admin UI screen for order-groups (API works; can use curl/Postman day 1)
- Referral payout on first completed order
- Stock decrement on PAID/COD
- Formal refunds flow

## Honest readiness

**Launch-ready for:** real buyers, GPS clustering, online or COD pay, dual confirmation, minimal staff (driver + buyer magic links).

**You must still:** host the app, set env keys, run DB push, do one full smoke test before public traffic.
