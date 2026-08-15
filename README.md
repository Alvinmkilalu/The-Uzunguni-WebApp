# Uzunguni City Park - Admin and Waiter Build

This build connects the approved premium interface to the Supabase schema already created for the project.

## Included

- Staff login as the default route
- Role routing for ADMIN and WAITER
- Admin overview of all 40 tables
- Admin-created waiter accounts with temporary passwords
- Phone-first waiter navigation and large touch controls
- Quantity entry and +/- controls for bulk items such as 13 beers
- Administrator menu, price and availability management
- Downloadable table QR codes
- Waiter dashboard restricted by database RLS to sessions initiated by that waiter
- Table initiation, controlled-menu order entry, bill totals and payment history
- Customer-only live bill at `/pay/demo-table-01` through `/pay/demo-table-40`
- Automatic server-confirmed TEST payments initiated from the customer phone

## Install and run

Keep your existing `.env.local` in the project root, then run:

```powershell
npm.cmd install
npm.cmd run dev
```

Open `http://localhost:3000`. The root route now opens staff login.

## Required v0.2 database update

Open `supabase/002_customer_test_payment.sql`, copy the full contents into Supabase SQL Editor and run it once. This adds the atomic customer TEST-payment function. It prevents duplicate request IDs and payment above the remaining table balance.

## First admin setup

In Supabase Authentication, create your user with email and password and enable auto-confirm. The database trigger creates a WAITER profile. In SQL Editor, promote only your own email:

```sql
update public.profiles
set role = 'ADMIN', full_name = 'Alvin Mkilalu', username = 'alvin.admin'
where email = 'REPLACE_WITH_YOUR_REAL_EMAIL';
```

Verify:

```sql
select full_name, username, email, role, is_active
from public.profiles
where email = 'REPLACE_WITH_YOUR_REAL_EMAIL';
```

Never place `SUPABASE_SERVICE_ROLE_KEY` in a client component or commit `.env.local`.

## Demo test sequence

1. Log in as ADMIN.
2. Create a waiter under Employees.
3. Sign out and log in as the waiter.
4. Initiate Table 1 and add menu items.
5. Open `/pay/demo-table-01` in another browser/private window.
6. The customer sees only Table 1's live bill.
7. On the customer page, choose a wallet, enter a Tanzanian phone number and submit the TEST payment. The server verifies and confirms it automatically; no administrator action is required.

## Public QR links

After Vercel gives the project a stable address, add this environment variable in Vercel and redeploy:

```env
NEXT_PUBLIC_APP_URL=https://YOUR-PROJECT.vercel.app
```

Then open Admin -> Table QR codes and download them again. Every QR will contain the public internet address, so customers can open the bill using mobile data or any Wi-Fi connection.

## Payments

`PAYMENT_PROVIDER_MODE=mock` provides an automatic, server-confirmed TEST transaction and never collects money. Live mode must not be enabled until Uzunguni has contracted merchant credentials, callback signing details and an approved Selcom sandbox. Production paid state must come only from a verified provider callback/status query.
