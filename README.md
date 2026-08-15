# Uzunguni City Park - Admin and Waiter Build

This build connects the approved premium interface to the Supabase schema already created for the project.

## Included

- Staff login as the default route
- Role routing for ADMIN and WAITER
- Admin overview of all 40 tables
- Admin-created waiter accounts with temporary passwords
- Downloadable table QR codes
- Waiter dashboard restricted by database RLS to sessions initiated by that waiter
- Table initiation, controlled-menu order entry, bill totals and payment history
- Customer-only live bill at `/pay/demo-table-01` through `/pay/demo-table-40`
- Clearly labelled admin payment simulation for the board demo

## Install and run

Keep your existing `.env.local` in the project root, then run:

```powershell
npm.cmd install
npm.cmd run dev
```

Open `http://localhost:3000`. The root route now opens staff login.

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
7. Log back in as ADMIN and use **Simulate confirmation** in the table workspace when demonstrating a verified payment.

The payment button never collects real money in this build. Production paid state must come only from a verified payment-provider callback.
