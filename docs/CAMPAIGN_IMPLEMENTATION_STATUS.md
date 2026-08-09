# Campaign Product Implementation Status

Synced with `docs/CAMPAIGN_ACTIVATION_PLAN.md` (founder notes 9 Aug 2026).

| # | Product surface | Status | Location |
|---|-----------------|--------|----------|
| 1 | Referral / affiliate system | **Done (MVP)** | `lib/db/src/schema/referrals.ts`, `artifacts/api-server/src/routes/referrals.ts` |
| 2 | ₦50 rescue pricing narrative | **Done** | `artifacts/eggpoint/src/pages/home.tsx` (hero section) |
| 3 | Flyer / QR deep link `/join?ref=` | **Done** | `artifacts/eggpoint/src/pages/join.tsx`, routes `/join` + `/install` |
| 4 | Campaign ops tracking | **Docs** | `docs/REUSABLE_KIT_INVENTORY.md` — lightweight sheet-style process; full internal tool later |
| 5 | Investor / pledge tracker | **Schema ready** | `lib/db/src/schema/pledges.ts` — run `pnpm --filter @workspace/db run push` after merge |

## API (referrals)

- `GET /referrals/me` — auth required; get/create own code + counts
- `POST /referrals/track` — `{ code, eventType: INSTALL|SIGNUP|FIRST_ORDER, meta? }`
- `GET /referrals/resolve/:code` — public display name for join page

## Next engineering steps

1. Run DB push for `referral_codes`, `referral_events`, `pledges`, `pledge_payments`
2. Extend OpenAPI + orval codegen for referral endpoints
3. On register, if `ref` in query/localStorage, call `/referrals/track` with SIGNUP
4. Admin UI for pledges + campaign day log (location, approvals, installs, media links)
5. Payout rules for FIRST_ORDER credits

## Ops still human

- Police/force approval templates
- Master Director + coordinators assembly
- Noodle producer outreach
- Flyer print + QR pointing to production `/join`
