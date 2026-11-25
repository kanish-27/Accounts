# CLAUDE.md

Payroll & accounts app for **Udumalai Cosmo Recreation Club** (bar): staff attendance, KOT bills per supplier, cash advances, salary payouts.

- **Frontend:** React 19 + Vite, installable PWA (`vite-plugin-pwa`), no router, icons from `lucide-react`.
- **Backend:** single Express file (ES modules) on **Firebase Firestore** via `firebase-admin`.

## Commands

```
npm run install:all     # install backend + frontend deps
npm run dev             # backend (nodemon, port 5000) + frontend (vite) together
npm run lint --prefix frontend
node --env-file=.env clear_db.js   # (in backend/) wipe all collections and re-seed defaults
```

Backend needs `backend/.env` with `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` (see `backend/firebaseAdmin.js`).
Frontend API base: `VITE_API_BASE_URL`, else `http://localhost:5000/api` in dev, `https://accounts-va8t.onrender.com/api` in prod (`frontend/src/App.jsx`).

There are no automated tests; `backend/test_june_kots.js` is a manual debug script.

## Layout

```
backend/server.js               ALL routes + business logic
backend/db.js                   initDb(): seeds default settings + 4 sample suppliers if empty
backend/firebaseAdmin.js        Firestore init
backend/migrate_to_firestore.js one-off SQLite (database.sqlite) -> Firestore migration
backend/clear_db.js             reset script
frontend/src/App.jsx            login gate, sidebar, tab switch (renderTabContent)
frontend/src/index.css          all styling; light theme via body.light-theme
frontend/src/components/        one component per sidebar tab
```

## Data model (Firestore)

| Collection | Doc ID | Fields |
|---|---|---|
| `suppliers` | sequential numeric strings `"1001"`, `"1002"`… (assigned in a transaction) | `name, phone, joining_date, type, status, basic_daily_wage, monthly_salary, designation` |
| `attendance` | `${supplier_id}_${date}` | `supplier_id, date, status` (Present / Half Day / Absent / Weekly Off), `shift` (`11-11` / `5-11`) |
| `kot_bills` | auto | `supplier_id, bill_number, amount, date, time, remarks` |
| `advances` | auto | `supplier_id, amount, date, remarks, status` (`pending` → `deducted`), `payout_id` |
| `salary_payouts` | auto | period, pay breakdown, `payment_date`, `worker_type` (absent for suppliers, `monthly`, `cleaner`) |
| `settings` | `admin_password`, `admin_name`, `kot_commission_limit` | `{ value }` (stored as strings) |

Conventions:
- Dates are `YYYY-MM-DD` strings compared lexically; `supplier_id` is always stored as a string (compare with `?.toString()`).
- Suppliers are **soft-deleted** (`status: 'deleted'`) so historical KOT/advance/payout records keep resolving.
- Many routes fetch whole collections and filter in JS rather than using Firestore queries.

## Worker types (all live in `suppliers`, distinguished by `type`)

- **`supplier`** (or missing type) — servers. Pay = `basic_daily_wage × (present + 0.5 × half)` + **5% commission on all KOT amounts** in the period.
- **`monthly`** — `monthly_salary / daysInMonth(start_date) × paid days`, where paid days = present + 0.5 × half + paid weekly offs. The **first 4 Weekly Offs per calendar month are paid**, the rest unpaid (`calculateWorkerAttendanceDetails` in `server.js`).
- **`cleaner`** — `basic_daily_wage × (present + 0.5 × half)`; Weekly Off counts as unpaid.

## Payroll flow (same shape for `/api/payroll`, `/api/payroll/monthly`, `/api/payroll/cleaner`)

1. `GET …/calculate?start_date&end_date` — report for active workers plus inactive ones with records in range.
2. Deducts all `pending` advances dated `<= end_date`; `net = max(0, total − advances)`.
3. `already_paid` only when existing payouts cover **every day** of the range (`isPeriodFullyPaid`).
4. `POST …/payout` writes `salary_payouts` docs and marks those advances `deducted` with `payout_id`.
5. `GET …/history` lists payouts with their linked advances.

`GET /api/dashboard/stats` computes every dashboard figure in one handler.

## Frontend conventions

- Each tab component receives `{ showToast, API_BASE, settings }`, fetches with plain `fetch` in `useEffect`, keeps state in local `useState`. No global store.
- **Adding a tab:** create the component in `components/`, add a `case` in `renderTabContent` and a sidebar `<li>` in `App.jsx`.
- Printing: set a `print*Data` state → render a print-only portal → `window.print()` on a timer; cleared on focus/afterprint.
- **KOT CSV import** (`KotBills.jsx`): detects `item_name`, `category_name`, `assign_to`, `item_total` columns; drops charge rows (`Kudil Charge`, `AC Charges`); unconditionally excludes products in `EXCLUDED_KOT_ITEMS` (Tumbler, snacks, 300/500ml water); conditionally excludes 1L water bottles (`Aquafina 1 L`, `Water 1 L`) only for the user-selected in-charge supplier(s) if charges are present (alter persons during lunch or other staff who took orders with charges will NOT have 1L water reduced); matches `assign_to` to supplier names (case/punctuation-insensitive); groups per supplier+date into bills `CSV-YYYYMMDD-<id>`, posted to `/api/kot/bulk`.

## Known issues / gotchas

- **Auth is client-side only.** No API route checks auth; password is plaintext in `settings` (default `cosmo1111`); login state is lost on refresh.
- **`kot_commission_limit` is unused** — commission is a flat 5%, hard-coded in three places in `server.js` (payroll calculate and two dashboard spots). Change all of them together.
- `/api/payroll/history` filters out only `worker_type === 'monthly'`, so **cleaner payouts also appear in supplier payroll history**.
- KOT bulk import has **no duplicate check**; re-importing a CSV duplicates bills. All imported bills get the single UI-selected import date even if the CSV spans days.
- Payout POSTs are not idempotent — repeating one records a second payout.
- Monthly daily rate: payroll uses actual days in month, dashboard MTD estimate uses `/ 30`.
- "Today" is computed with `toISOString()` (UTC) on server and client — wrong date in IST between 00:00–05:30.
- `backend/node_modules`, `backend/database.sqlite`, and `frontend/dev-dist` are committed to git.
