# LifeOS — Phase 4 (Part 1)

Personal operating system. Single-user, no auth yet.

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create `.env.local` in the project root with your own Supabase project's credentials:
   ```
   NEXT_PUBLIC_SUPABASE_URL=your-project-url
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
   ```
   Find these under Supabase → **Settings → API**. `.env.local` is gitignored — never commit it, and never paste real keys into this README or any tracked file.

3. Run the schema and migrations, in order, in the Supabase **SQL Editor**:
   - `supabase/schema.sql` — base tables: `tasks`, `habits`, `habit_logs`, `projects`, `notes`, `finance_transactions`, plus starter task seeds.
   - `supabase/phase2_tasks.sql`, `phase2b_projects.sql`, `phase2c_calendar.sql`
   - `supabase/phase3_journal.sql`, `phase3b_habits.sql`
   - `supabase/phase4_learning.sql`
   - `supabase/phase4b_debts.sql`

   **Important:** tables created via the SQL Editor need explicit grants in addition to RLS policies, or every query returns a `42501 permission denied` error. After creating any new table, run:
   ```sql
   grant select, insert, update, delete on public.<table_name> to anon, authenticated;
   ```

4. Start the dev server:
   ```bash
   npm run dev
   ```
   Open http://localhost:3000

## What's built

| Module | Status |
|---|---|
| Tasks | Live — full CRUD |
| Projects | Live — full CRUD |
| Calendar | Live — full CRUD |
| Notes | Live — full CRUD |
| Journal | Live — full CRUD |
| Habits | Live — full CRUD |
| **Finance** | **Live — transactions, month nav, summary cards, category pie chart, create/edit** |
| **Debts & Loans** | **Live — owed-to-me / I-owe tracking per person, due dates, overdue flagging, settle/delete** |
| Learning | Live — resource cards, status filters, progress, ratings |
| Idea Vault | In progress |
| Media Vault | Not started |
| AI Assistant | Not started |
| Analytics | Not started |
| Settings | Not started |

- Auth — not implemented. Every table is wide open via RLS "allow all" policies. Fine for personal/local use, but before deploying anywhere public, add Supabase Auth and tighten each policy to `auth.uid() = user_id`.
- Dashboard widgets for some modules may still show placeholder data pending a pass to wire them to the live tables — check `Dashboard.tsx` before assuming a widget is real.

## Structure

```
app/
  layout.tsx           — fonts, root html/body
  page.tsx             — renders Dashboard
  globals.css          — theme tokens (CSS vars, dark/light)
  finance/page.tsx     — Finance route
components/
  dashboard/
    Dashboard.tsx      — sidebar + topbar + widget grid
  shell/
    Sidebar.tsx        — nav, module hrefs
  finance/
    FinancePage.tsx    — transactions, summary cards, category pie chart
    DebtsPanel.tsx      — owed-to-me / I-owe tracker
  (tasks, projects, calendar, notes, journal, habits, learning — one folder each,
   same card/modal/drawer pattern as ProjectsPage.tsx)
lib/
  supabase/
    client.ts           — browser client
    server.ts            — server client (ready for when auth lands)
supabase/
  schema.sql             — base schema, run first
  phase2_tasks.sql, phase2b_projects.sql, phase2c_calendar.sql
  phase3_journal.sql, phase3b_habits.sql
  phase4_learning.sql
  phase4b_debts.sql       — finance_debts table for Debts & Loans
```

## Next up (Phase 4 Part 2)

Finish Idea Vault, then Media Vault (needs Supabase Storage, not just a table — file uploads, buckets, storage policies alongside metadata).
