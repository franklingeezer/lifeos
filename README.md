# LifeOS

A personal operating system for everyday life — tasks, projects, calendar, notes, journal, habits, finance, learning, and an AI assistant that reads your actual data, all behind one login.

Built for one person, by one person. No teams, no workspaces, no sign-up flow — a single-user system, developed in phases, with the database migrations to prove it.

```
Next.js 14 · TypeScript · Supabase · PostgreSQL · Tailwind CSS · Groq (Llama 3.3 70B)
```

---

## Why

Most productivity setups are five separate apps that don't talk to each other — a task manager, a notes app, a journal, a budget spreadsheet, a habit tracker. LifeOS puts all of it behind one login, one database, and one design system, so the pieces can eventually inform each other instead of living in isolation.

The AI layer isn't a chatbot bolted on top. Each AI route queries Supabase directly for real data — open tasks, habit logs, journal entries — builds a structured summary, and sends *that* to Groq, not a freeform prompt. The model never invents information it wasn't given.

## Modules

**Dashboard** — today's priorities, active projects, habit streaks, finance summary, and the AI morning brief, pulled together on load via a single `useDashboardData` hook.

**Tasks** — Kanban and list views over the same data, drag-to-reorder via a `position` column, subtasks, priority (`low` / `med` / `high`), due dates. Feeds the AI prioritizer.

**Projects** — status (active / completed / archived), progress, deadlines, GitHub or external references. Cross-links to tasks and calendar are on the roadmap but not wired up yet.

**Calendar** — month view combining manually-created events with task due dates and project deadlines in one place.

**Notes** — tags, pinning, search. Indexed by Natural Search alongside everything else.

**Journal** — one entry per day (`entry_date` is unique), capturing mood, energy, stress, wins, failures, lessons, tomorrow's goals, and gratitude. Feeds Journal Insights and the Weekly Review.

**Habits** — daily check-ins, streak calculation (current + longest), completion rate, and a per-habit color for the history view.

**Finance** — income, expenses, savings, investments, and debts, categorized and chartable.

**Learning** — courses and skills with category, progress, and study hours.

**Media Vault** — a private Supabase Storage bucket for images, video, and documents, accessed only via signed URLs — never public.

**Idea Vault** — a lightweight pipeline: `Spark → Developing → Validated → Archived`, with rating, tags, and category per idea.

**Analytics** — Recharts views over task completion, habit performance, mood/energy/stress trends, finance, and the idea pipeline.

## AI Assistant

Five server-side routes under `app/api/`, all calling Groq's `llama-3.3-70b-versatile` directly (not through a client SDK), all sharing one in-memory rate limiter capped at **15 requests per 10-minute window across all five routes combined**.

- **Morning Brief** (`/api/morning-brief`) — pulls overdue tasks, tasks due today/tomorrow, habit streaks, stale projects (no update in 3+ days), and deadlines in the next 7 days into a JSON summary, then asks the model for 3–6 terse bullets. Cached per calendar day in `ai_briefs`; regenerable on demand.
- **Natural Search** (`/api/natural-search`) — plain-language queries over tasks, notes, projects, and journal entries instead of exact-keyword search.
- **Task Prioritization** (`/api/prioritize-tasks`) — ranks open tasks using full context (priority, due date, project), not just a date sort.
- **Journal Insights** (`/api/journal-insights`) — looks for recurring themes across a 30-day, 90-day, or all-time window of entries.
- **Weekly Review** (`/api/review`) — one route, two modes (`weekly` / `monthly`), rolling up tasks, habits, journal, and finance into a single written summary.

All five are careful about timezone: "today" is computed with `Intl.DateTimeFormat` pinned to `Asia/Dhaka`, not `Date.toISOString()`, which would silently drift a day off between midnight and 6am local time.

## Database

Ten-plus tables, built up through phased, additive SQL migrations rather than one monolithic schema — `supabase/schema.sql` for the Phase 1 base, then `phase2_*` through `phase5_*` layered on top in order. Every table is nullable-`user_id` and RLS-permissive at first (single-developer, pre-auth phase), then locked down in `phase5_auth_lockdown.sql` once a real Supabase Auth user exists — policies scoped to `auth.uid() = user_id`, ownership enforced at the database level rather than trusted to the client.

```
tasks, habits, habit_logs, projects, events, journal_entries,
learning_items, idea_vault_items, ai_briefs, ai_reviews,
ai_journal_insights, app_settings, storage.objects (media bucket)
```

## Stack

**Frontend** — Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS (CSS-variable-driven theme, dark by default with a light mode), Lucide icons
**Backend** — Supabase (Postgres, Auth, Storage), Row Level Security
**State / data** — Zustand for client state, SWR for data fetching, React Hook Form + Zod for forms
**Charts** — Recharts
**AI** — Groq API, `llama-3.3-70b-versatile`, called only from server routes — the key never reaches the browser

## Getting started

```bash
git clone https://github.com/franklingeezer/lifeos.git
cd lifeos
npm install
```

Create `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
GROQ_API_KEY=your_groq_api_key
```

In the Supabase SQL editor, run the migrations in order:

```
schema.sql → phase2_tasks.sql → phase2b_projects.sql → phase2c_calendar.sql
→ phase3_journal.sql → phase3b_habits.sql → phase4_learning.sql
→ phase4c_media.sql → phase4d_idea_vault.sql → phase4e_ai_assistant.sql
→ phase4f_reviews.sql → phase4g_journal_insights.sql → phase4h_settings.sql
→ phase5_auth_lockdown.sql
```

`phase5_auth_lockdown.sql` expects a Supabase Auth user to already exist (Authentication → Users → Add user) — LifeOS has no public sign-up page by design.

```bash
npm run dev
```

Open `localhost:3000`.

## Structure

```
app/            routes — one folder per module, plus app/api for the 5 AI routes
components/     UI, organized to mirror app/ 1:1 by module
hooks/          data hooks (useTasks, useHabits, useFinance, ...) — own all Supabase calls
lib/            supabase clients (browser/server/middleware), date.ts, ai-rate-limit.ts
supabase/       schema.sql + phased migrations, run in order
middleware.ts   refreshes the Supabase session on every request, including API routes
```

Each module keeps the same shape: a route in `app/`, its components in `components/<module>`, and a hook in `hooks/` that's the only thing allowed to talk to Supabase for that module. AI routes skip the client SDK entirely and call Groq's REST API directly.

## Status

Core modules, auth, and all five AI features are live and in daily use. RLS lockdown shipped in `phase5_auth_lockdown.sql` after an earlier phase ran with intentionally permissive policies during single-developer testing.

Open:
- Cross-module context for AI (e.g. journal-aware task prioritization, project ↔ task ↔ calendar linking)
- Global search across all modules
- Gamification / streak rewards
- Full auth edge-case and security testing pass

## License

MIT
