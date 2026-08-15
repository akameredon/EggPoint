# EggPoint product code — complete for launch

## Buyer
- Browse suppliers / batches
- GPS or map pin (no long address form)
- Checkout: name, phone, crates, **Pay online** or **COD**
- Track page `/order/:token` + dual confirm pickup
- `/join?ref=` street activation + referral stored into order

## Ops / admin
- Farm verification
- **Paid / COD order geo-groups** → set pickup point → **Dispatch**
- Copy **driver links** to WhatsApp
- Legacy interest-request clusters still available

## Driver
- Magic link `/driver/:token` → mark handover

## System
- Stock reserved on COD create and on online payment verify
- Batch `SOLD_OUT` when crates hit 0
- Referral `FIRST_ORDER` event when dual confirm completes
- Flutterwave for online egg orders + featured farm billing

## Not in code (ops / host)
- Deploy, domain, `DATABASE_URL`, `FLW_*`, `APP_BASE_URL`
- `pnpm --filter @workspace/db run push`
- SMS gateway (share links manually)

See `docs/LAUNCH.md` for smoke test.
