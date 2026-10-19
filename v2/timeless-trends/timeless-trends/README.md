# TIMELESS TRENDS — catalogue, WhatsApp enquiries & business dashboard

Public website (browse watches, enquire on WhatsApp) + private owner dashboard (stock, orders, expenses, profit, reports).
Stack: React + Vite (frontend), Node + Express (API), SQLite file database (`data/timeless.db`).

## Why this stack
SQLite needs no database server or paid service, which suits a single-shop business and a beginner. The cost: it needs a host with a **persistent disk** (Render, Railway, Fly.io, or a small VPS) — not serverless hosts. If you outgrow it, the data layer can move to PostgreSQL.

## Run it on your computer
Requires Node.js 20+.
```
npm install
cp .env.example .env            # then edit it
npm run create-owner -- you@example.com "Your Name"   # asks for a password (min 10 chars)
npm run dev                     # website http://localhost:5173  ·  API :4000
```
Dashboard: http://localhost:5173/admin

Production-style run: `npm run build && NODE_ENV=production npm start` (one server on `PORT`, serves site + API).
Tests: `npm test` (21 tests: stock, orders, finance maths, security, WhatsApp links, image upload).

## Environment variables (`.env`)
| Name | Meaning |
|---|---|
| `WHATSAPP_NUMBER` | Digits only with country code, e.g. `919876543210`. Can also be set in Dashboard → Settings (Settings wins). Blank = buttons show "WhatsApp coming soon". |
| `PUBLIC_URL` | Your live site address, used for the "Product link" line. Localhost addresses are never put in messages. |
| `BUSINESS_TZ` | Timezone for all report dates. Default `Asia/Kolkata`. |
| `DB_FILE`, `UPLOAD_DIR` | Where the database and photos live (put on the persistent disk). |
| `NODE_ENV=production` | Makes the login cookie `Secure` — **requires HTTPS** (all hosts above provide it). |

## Deploying (e.g. Render / Railway)
1. Push the project to a private GitHub repo (`.env`, `data`, `uploads` are git-ignored).
2. Create a web service: build `npm install && npm run build`, start `npm start`.
3. Attach a persistent disk; set `DB_FILE=/disk/timeless.db`, `UPLOAD_DIR=/disk/uploads`, `NODE_ENV=production`, `WHATSAPP_NUMBER`, `PUBLIC_URL`.
4. Open the host's shell and run `npm run create-owner -- you@example.com "Name"`.
5. Add your domain in the host's settings and point DNS as it instructs.
**Backups:** the whole business is `timeless.db` plus the `uploads` folder. Copy both somewhere safe regularly (host disk snapshots, or a scheduled copy). Test a restore once. Backups are NOT automatic in this version.

## Rules the system follows
- A WhatsApp **button click** only records website activity. It never creates an order or changes stock. Enquiry stages: *button clicked → enquiry received (you confirm) → order → completed / cancelled / returned*.
- **Stock policy:** Confirmed / Processing / Ready **reserve** units (still on hand, not available to others). **Completed** (handed over) records the sale and reduces stock. **Cancelling** before completion releases the reservation. Repeating a status update never double-counts.
- **Returns:** "Good — restock" adds units back to sellable stock; "Damaged" does not (cost stays as a loss).
- Every stock change writes an immutable movement (before/after, reason, user). Corrections need a reason. Stock cannot go negative.
- **Money:** sales revenue counted when an order is completed (returns reduce the month they are recorded). COGS uses weighted-average cost at the time of sale. Gross profit = net sales − COGS. Operating profit (estimate) = gross profit − expenses. Stock purchases are inventory, not expenses. Cash = payments received − refunds − expenses − supplier payments (+ opening cash). Savings = only transfers you record. None of these are mixed. Missing prices/costs are never treated as zero — they are flagged.
- Payment status is derived from payment entries you record; it is a record, not proof of payment.
- Estimates only; not audited accounts or tax advice.

## Daily use
- **Add a watch:** Products → Add product (name, colours, price). Colours track stock separately. Leave it *Draft* until ready.
- **Photos:** Products → Edit → upload per colour. Your original is kept untouched; the site serves a resized, compressed WebP copy. (No retouching or background removal is done.)
- **New stock:** New Arrivals → pick watch & colour, quantity, purchase cost, supplier. Tick *new arrival* / *publish*.
- **Customer messages you on WhatsApp:** Enquiries → record/mark received → *Create order*. Move the order through statuses; add payments.
- **Expenses:** Expenses → category, amount. **Savings:** Savings Tracker.
- **Stock count:** Inventory → *Start stock count* → enter physical counts and reasons.
- **Monthly report:** Monthly Reports → choose month → Print, or export CSVs (products, stock movements, orders, expenses).

## Security notes
Passwords are bcrypt-hashed; sessions are random tokens (hashed in DB) in an HttpOnly, SameSite cookie; all `/api/admin` routes require a session; writes also need an `X-Requested-With` header; login is rate-limited; inputs validated with zod; public API never returns costs, exact stock, or supplier data; original photos are not publicly served; CSV export neutralises spreadsheet-formula injection.
Not included yet: password reset, multiple staff roles, 2FA, automatic backups, official WhatsApp Business API.
