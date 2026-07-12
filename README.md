# LifeOS — Phase 1

Personal operating system. Single-user, no auth yet.

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. `.env.local` is already filled in with your Supabase project:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://pidrcwjpcnxsiuvjszdt.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_7QU2KulbpzcnuX6DM4EX1A_6vOShc0_
   ```
   `.env.local` is gitignored — never commit it.

3. Run the schema:
   - Open your Supabase project → **SQL Editor** → **New query**.
   - Paste the contents of `supabase/schema.sql` and run it.
   - This creates `tasks`, `habits`, `habit_logs`, `projects`, `notes`, `finance_transactions`, and seeds a few starter tasks.

4. Start the dev server:
   ```bash
   npm run dev
   ```
   Open http://localhost:3000

## What's real vs. mocked right now

- **Tasks widget** — fully live: reads/writes the `tasks` table in Supabase. Check a task, it persists.
- Habits, finance, GitHub activity, recent notes, calendar — still mock data. Their tables already exist in the schema (or will), so wiring them up is just swapping the mock arrays for Supabase queries, same pattern as `Dashboard.tsx` uses for tasks.
- Auth — not implemented. Every table is wide open via RLS "allow all" policies. Fine for personal/local use with the publishable key, but before deploying anywhere public, add Supabase Auth and tighten each policy to `auth.uid() = user_id`.

## Structure

```
app/
  layout.tsx       — fonts, root html/body
  page.tsx         — renders Dashboard
  globals.css      — theme tokens (CSS vars, dark/light)
components/
  dashboard/
    Dashboard.tsx  — sidebar + topbar + widget grid, tasks wired to Supabase
lib/
  supabase/
    client.ts      — browser client
    server.ts      — server client (ready for when auth lands)
supabase/
  schema.sql       — run this once in the Supabase SQL editor
```

## Next up (Phase 2 per the PRD)

Tasks module (full CRUD, Kanban, subtasks), Projects module, Calendar.
