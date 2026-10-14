<div align="center">

# 🧠 LifeOS

### Your Personal Operating System

*A single-user, AI-assisted productivity app that connects tasks, projects, notes, journals, habits, finance, learning, media, and ideas into one workspace instead of a pile of disconnected tools.*

---

![Next.js](https://img.shields.io/badge/Next.js-14-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-green)
![SWR](https://img.shields.io/badge/Data%20layer-SWR-orange)
![Version](https://img.shields.io/badge/Version-0.3.0-informational)
![Status](https://img.shields.io/badge/Status-Active%20Development-success)

</div>

---

# ✨ Vision

LifeOS isn't another to-do app.

It's a personal, single-user operating system that combines productivity, journaling, habits, finance, learning, and AI into one connected workspace — built for one person, running on infrastructure that person actually controls.

Every module works on its own. The goal is for them to increasingly understand each other too, so the system reflects real life instead of a dozen isolated spreadsheets.

---

# 🔐 Security

LifeOS is single-user by design — no public sign-up. Every table is locked down with Postgres Row-Level Security scoped to `auth.uid()`, so even the public API key can't touch another account's data (not that there's meant to be one).

- Real Supabase Auth login, with session-refresh middleware protecting every page and API route except `/login`, `/forgot-password`, and `/auth/callback`
- Full forgot-password flow (email reset link → callback → set new password)
- **Per-user, Postgres-backed rate limiting** on every AI route (15 requests / 10 minutes per user, shared across all AI routes). Backed by an atomic upsert RPC rather than in-memory state, so it holds up across Vercel's serverless instances
- Server-only secrets (`SUPABASE_SERVICE_ROLE_KEY`, `VAPID_PRIVATE_KEY`, `CRON_SECRET`, `GROQ_API_KEY`) are never exposed to the client; the cron endpoint is protected by a bearer secret instead of a user session

---

# 🚀 Features

## Dashboard
Daily priorities, AI Morning Brief, habit progress, active projects, this week's calendar, finance snapshot, and recent notes — all live data, no mock content. Also includes:
- **Inbox quick-capture bar** — jot something down without deciding what it is yet
- **Missed blocks card** — appears only when a calendar block set aside for a task went by with the task unfinished, with a proposed new slot for each; move it, move all, or remove it (see [Plan My Day & Rollover](#-plan-my-day--rollover)). Renders nothing otherwise
- **Personal Activity** — a section for external signals: recent GitHub activity and what you're listening to on Last.fm (see [Personal Activity](#-personal-activity))

## Projects
Project management with status, priority, deadlines, and progress. Linked tasks, notes, calendar events, and learning items show up on the project itself, with a live "X of Y done" count alongside the manual progress slider — informational, never overriding your own control. Every project also carries a rule-based **health badge** (Healthy / Slowing / At Risk / Blocked), computed live with no AI call.

## Tasks
Kanban board (swipeable on mobile) and list view, priorities, due dates, subtasks, full-text search, and optional project linking. Plus:
- **Time estimates** — an optional `estimated_minutes` on any task, which is what makes it schedulable
- **Smart scheduling** — propose a calendar slot for a task and accept it in one click (see [Task → Calendar Scheduling](#-task--calendar-smart-scheduling)). A task that already has a block offers **Move it** (or **Reschedule it** if the block was missed) instead of quietly adding a second one; **Add another session** is a deliberate, separate choice, and every Accept says plainly whether it moved or added a block
- **Recurring tasks** — daily / weekly / monthly repeats (see [Recurring Tasks](#-recurring-tasks)); generated occurrences carry a small repeat icon
- Command Palette (`Ctrl/Cmd+K`) can create a task instantly from anywhere with `task: ___`

## Calendar
Monthly view, event management, color coding, and optional time-blocked events (all-day by default — events can have a real start and end time). Every task's due date automatically shows up as a badge on the Calendar page; edit the task, not the badge, to change it. Events created by accepting a scheduling proposal keep a reference back to the task they're blocking time for. Events within a day always appear in time order, all-day first.

## Notes
Markdown notes with folders, tags, pinning, and full-text search. Mobile gets a proper master-detail layout (list → tap → editor, with a back button) instead of squeezing both panes together. Quick-create from the Command Palette with `note: ___`.

## Journal
Daily entries — Mood, Energy, Stress (custom gradient-track scale, not emoji), Wins, Failures, Lessons, Tomorrow's Goals, Gratitude.

## Habits
Daily check-in tracking, streaks, longest streak, 30-day success rate, color-coded.

## Finance
Income, expenses, savings, investments, monthly breakdown, category charts, and a separate Debts & Loans panel (who owes who, settle tracking). Currency symbol is a real Settings-driven value used consistently everywhere, not hard-coded.

## Learning
Track courses, study hours, completion status, certificates.

## Media Vault
Store images, videos, and documents via Supabase Storage, with tags and captions.

## Idea Vault
Capture ideas through a real pipeline — **Spark → Developing → Validated → Archived** — with potential rating and tags. A **validated** idea can be converted into a real Project in one click, carrying its title and description over and staying linked to the original idea.

## Inbox
A universal capture layer, built on the "capture first, organize later" principle — see [Inbox](#-inbox) below.

## AI Assistant
Six focused tools, not one AI dumped into a chat box:
- **Today** *(default tab)* — **Today Brain**: one merged daily focus plan drawn from Tasks, Projects, Habits, and Journal, built on the Context Engine and aware of your real free/busy time, your own time estimates, the blocks already on your calendar, and any blocks you missed. A **Plan my day** button turns that focus plan into proposed calendar blocks (see [Plan My Day & Rollover](#-plan-my-day--rollover))
- **Morning Brief** — a short daily summary with history you can browse
- **Ask LifeOS** — natural-language search across your own data (including Calendar, Learning, and Debts & Loans), grounded in project-health, deadline, streak, and mood signals for status questions, not just text matching
- **Review** — weekly/monthly summaries of what actually happened
- **Prioritize** — suggests task priority changes you review and apply (or don't)
- **Journal Insights** — finds real patterns across entries, including habit-mood correlations *only* when there's genuinely enough data to say so honestly

## Analytics
Live charts across tasks, finance, habits, projects, and ideas — including a **habit ↔ mood correlation** card that compares average mood on days a habit was done vs. skipped, gated behind a minimum sample size so it never shows a misleading pattern from too little data.

## Command Palette
Global `Ctrl/Cmd+K` search across Tasks, Notes, Projects, Habits, Learning, Idea Vault, and Calendar events — full keyboard navigation, plus inline quick-create commands (`task:`, `note:`, `inbox:`) that create something instantly without leaving wherever you are.

## Settings
Display name, currency, GitHub and Last.fm usernames (Integrations), push-notification device management, and data export.

## Data Export
One-click JSON backup from Settings, independent of Supabase. Covers Tasks, Subtasks, Projects, Notes, Habits & logs, Finance transactions, Debts, Calendar events, Journal, Learning, Media metadata, and Ideas. AI-generated content (briefs, reviews, insights) is intentionally excluded since it's regenerable.

> Not yet included in the export: Inbox items, Reminders, recurring-task series, and the integration usernames — see the Roadmap.

---

# 🧠 AI Philosophy

> **AI should reduce busywork, not replace thinking — and it should never invent what it doesn't actually know.**

Every LifeOS feature works completely without AI. Where AI is used (Groq, `openai/gpt-oss-120b`), it's held to a strict grounding standard — Journal Insights, for example, is explicitly forbidden from attributing a mood shift to any cause that isn't literally present in the entry text or habit data for that date. No invented causal stories, no forced patterns from thin data.

Today Brain's wording is checked after the fact, not just requested up front: any clock time or duration in its headline or reasons that wasn't present in the data it was shown (a free block, a calendar block, one of your own estimates) is stripped or replaced with a plain data-backed reason. See `lib/ai/focus-grounding.ts`.

The same philosophy decides *where not to use AI*: Project Health badges, Task → Calendar scheduling, Plan My Day, and Rollover are plain rule-based code, because free/busy arithmetic and deadline math are things the app already knows exactly. A model would only add latency, cost, and a chance of being wrong.

---

# 🔗 Deep Module Relationships

LifeOS is gradually moving from "a set of connected pages" toward modules that actually understand each other:

- **Project ↔ Tasks** — link tasks to a project; see linked-task progress on the project itself
- **Project ↔ Notes, Project ↔ Calendar Events, Project ↔ Learning** — same link-and-see-back-on-the-project pattern, for whichever module a piece of work actually lives in
- **Tasks ↔ Calendar** — due dates appear as badges on the Calendar, and a task can be scheduled into a real timed event
- **Today Brain → Calendar** — the daily focus plan can be placed into your free time in one step, and missed blocks roll forward
- **Tasks ← Recurring series** — a repeating task is a series template that generates normal, independent task rows
- **Idea Vault → Project** — convert a validated idea into a real project in one click
- **Inbox → everything** — a capture can become a Task, Note, Idea, Project, Event, or Reminder, and keeps a trace of what it became
- **Journal ↔ Habits ↔ Analytics** — habit completion data feeds both the Analytics correlation chart and the AI's Journal Insights, with matching sample-size honesty between the two

---

# 🧠 LifeOS 2.0 — Context Engine (all 6 phases complete)

`lib/ai/context-engine.ts` exports `buildLifeOSContext()` — one function that assembles Tasks, Projects, Calendar, Habits, Journal, Learning, Finance, and Recent Activity into a single typed, section-selectable object, so every AI feature reads from the same data instead of hand-rolling its own queries.

- **Phase 1/1b** — Context Engine built; Morning Brief migrated onto it.
- **Phase 2** — Today Brain: one merged daily focus plan, built on the engine.
- **Phase 3** — Calendar time-of-day data: `events` store a real start/end time (optional — all-day still works exactly as before). The engine computes actual free/busy windows for today, and Today Brain can cite a real open block instead of only relative ordering.
- **Phase 4** — Project Health: rule-based Healthy/Slowing/At Risk/Blocked badge on every project, computed live, no AI call.
- **Phase 5** — Smart Inbox classification: captures get an AI-suggested type (with confidence + reason) before you convert them, always overridable, and the Inbox still works with zero AI.
- **Phase 6** — Ask LifeOS 2.0: natural-language search reasons over the same project-health / deadline / habit-streak / mood data as the rest of the AI tools, so status questions ("how's Project X doing") get a real grounded answer. Debts & Loans is part of the searchable corpus too.

## Schedule-aware context (Plan My Day, Part 3)

The Context Engine's tasks section now also carries each task's own time estimate, whether it's part of a recurring series, and its next calendar block; plus `scheduled_today` (blocks still to come today), `missed_blocks` (blocks whose time passed with the task still open, last 7 days), and a workload comparison — the sum of your own estimates for overdue and due-today tasks versus the free minutes left today. Tasks with no estimate contribute nothing to that total and are counted separately, so it's never padded with a guess. Optional fields appear only when they apply, so plain tasks serialize exactly as before.

## AI reasoning across modules

The AI tools don't just read their own module in isolation — they can see how Projects connect to Tasks, Notes, Calendar Events, and Learning, and use that when it's actually relevant.

- **Morning Brief & Review** — pull a compact "project context" (linked open/overdue tasks, notes, upcoming events, learning progress) for each active project, and combine it into one bullet only when genuinely noteworthy.
- **Prioritize** — a task with no due date of its own can still be ranked higher because the *project* it's linked to has a deadline within 14 days; the reason given explains exactly why.
- **Ask LifeOS** — tags every result with its linked project, so "stuff about Cyber Terminal" surfaces the task, note, event, and learning item together.
- **Journal Insights was deliberately left alone.** It has no `project_id` and already holds itself to a stricter grounding rule than the rest of the AI tools — extending it would either break that rule or need a real redesign, and a well-reasoned feature staying as-is beats forcing symmetry for its own sake.

---

# 🗓 Task → Calendar Smart Scheduling

Give a task a time estimate, hit schedule, and LifeOS proposes the earliest slot that actually fits.

- **Rule-based, not AI** — `lib/scheduler.ts` is pure interval arithmetic over your timed calendar events within the same work window the Context Engine uses. The same task and calendar state always propose the same slot.
- **Proposes, never writes** — `/api/schedule-task` only returns a candidate (or a plain-language reason there isn't one: no estimate yet, or no opening in the search range). Accepting it creates a normal Calendar event through the existing calendar hook, tagged with `events.task_id`.
- **Deadline-aware** — searches up to the task's due date; for tasks with no due date (or one already past) it searches the next 14 days.
- **Present-aware** — today's search starts from *now*, not from the start of the work day, so it never proposes a slot that's already behind you.
- All-day events are ignored, matching the Context Engine's rule that they never consume a time block. Deleting a task unlinks its event instead of deleting calendar history.

---

# 🧭 Plan My Day & Rollover

Today Brain decides *what* matters today and in what order; the scheduler decides *when*. Neither needs a second AI call.

**Plan my day** (Today tab)
- Takes Today Brain's focus tasks, in its order, and places each into the earliest free window left today, starting from now. Each placed block plus a 10-minute buffer counts as busy for the tasks after it, so nothing overlaps, and start times snap to the next 5 minutes.
- Proposes only — you check the blocks you want and add them to the calendar in one click.
- Honest about what it can't place: a task with no estimate is skipped with a one-tap chip row (15 / 30 / 60 / 90 min) to fix it, a task that already has a block is left alone (so re-planning is safe), and a task that doesn't fit today is reported as such — never silently pushed to another day.
- A capacity line compares the work to place against your real free time ("Needs 3h · 2h 40m free from now").

**Rollover** (Dashboard)
- A *missed block* is a timed event linked to an unfinished task whose end time has passed (earlier today, or within the last 7 days). Blocks still in progress, blocks for completed tasks, all-day events, and unlinked events are never touched.
- Each missed block gets a proposed new slot of the same length, searched from now — or from tomorrow after 8 PM, so it never proposes a late-night work block. **Move** updates the existing event (one block per task, no ghost left behind); **Remove** deletes just the block (two clicks; the task is untouched). Anything that doesn't fit gets a plain reason and Remove only.

Both run on `/api/plan-day` and `/api/rollover`: read-only, no AI call, no rate-limit cost. The slot search lives in `lib/scheduler.ts` and `lib/rollover.ts`.

---

# 🔁 Recurring Tasks

A proper series model rather than a flag on a single row.

- **`task_series`** is the template ("every Mon/Wed/Fri", "the 1st of every month", "every 2 weeks"); each occurrence is a normal row in `tasks` linked via `series_id`. Complete, edit, or delete one occurrence without touching the rest.
- **Daily, weekly (pick days of the week), and monthly (day of month)** with an "every N" interval and an optional end date.
- **First occurrence appears instantly** when you create the series; every later one is generated by the notification cron (below), using the same `resolveNextGeneration()` function so the two paths can't drift apart.
- **No backlog floods** — if generation lapses (downtime, a long pause), the gap collapses into a single catch-up task for the most recent due date rather than dozens of missed ones.
- Months too short for the target day (e.g. the 31st in February) are skipped, not rolled over.
- **Stopping a series** halts future generation but never deletes anything already created.
- Generation runs independently of push notifications — you don't need to enable push to get your recurring tasks.

---

# 🎧 Personal Activity

A dashboard section for external signals. Both cards are optional, read-only, and fail gracefully into a "connect" prompt when unconfigured.

**GitHub Activity** — recent pushes, pull requests, issues, releases, and new repos from your public GitHub events. Server-side via `/api/github/activity` (cached for 2 minutes, refreshed in the UI every 5), and aware of the LifeOS repo itself so it can be highlighted. Set your username under **Settings → Integrations**. A `GITHUB_TOKEN` is optional and only raises GitHub's rate limits.

**Last.fm Now Playing** — what's playing right now, or the last track you scrobbled, with album art. Refreshes every 30 seconds. Needs a free Last.fm API key and your Last.fm username in Settings. Last.fm sits on top of whatever you actually play music with (Spotify, YouTube Music, local files — anything with a scrobbler).

> **Why Last.fm and not the Spotify API?** Spotify's Developer Mode now requires the app owner to hold an active Premium subscription, which is a hard wall on a free account. Last.fm gives the same "what am I listening to" signal with just a username and a free key — no OAuth, no refresh tokens.

---

# 📱 Mobile

Every page works properly at phone width — not just "doesn't break," but actually designed for it: a slide-in nav drawer replaces the desktop rail, Tasks' kanban becomes swipeable with tappable column tabs, Notes/Journal use a real mobile master-detail pattern, and every modal/drawer fits within a narrow screen without overflowing.

---

# 🔔 PWA & Push Notifications

LifeOS installs like a real app — on Android via Chrome's install prompt, on iOS via Safari's "Add to Home Screen" (Apple requires the app to actually be installed before it'll grant push permission, so on iOS notifications only work once it's on your home screen).

- **Offline app shell** — a hand-rolled service worker (not `next-pwa`, kept consistent with the rest of the codebase's "own the code" approach) caches the static shell and shows a proper offline page instead of a browser error when you lose connection. Your actual data is deliberately never cached this way — Supabase reads/writes always go live, so you never see stale personal data offline.
- **Web Push** — reminders and overdue-task alerts reach you even when LifeOS is closed, via VAPID-signed push and a `push_subscriptions` table (RLS-scoped like everything else). Each browser/device gets its own subscription, manageable from Settings.
- **One cron, three jobs** — `/api/cron/notifications` generates due recurring tasks, creates reminder/overdue notifications, and delivers pending pushes. Vercel's free Hobby plan only allows once-daily cron jobs, so the real every-5-minutes trigger runs via a free GitHub Actions workflow (`.github/workflows/push-cron.yml`), with Vercel's own cron in `vercel.json` kept as a once-a-day fallback.

> **Heads-up:** GitHub automatically disables scheduled workflows in public repositories after 60 days without repository activity. If recurring tasks or push alerts ever go quiet, check the Actions tab and re-enable the workflow.

---

# 📥 Inbox

A universal capture layer, built on the "capture first, organize later" principle: nothing typed into it needs a category up front.

- **Capture anywhere** — a bar on the Dashboard, the `inbox:` prefix in the Command Palette, or the global **Ctrl/Cmd+Shift+I** shortcut, which opens the palette pre-filled and ready to type.
- **Process, don't presort** — each capture sits unprocessed until you decide what it actually is. A processing drawer converts it into a real Task, Note, Idea, Project, Event, or Reminder, asking only for the one field that type genuinely needs (a due date for a task, a date for an event) — everything else takes a sane default, editable later from the real page.
- **Traceable history** — a converted item keeps a `→ Task` / `→ Note` tag pointing at what it became, and moves to Processed rather than disappearing.
- **AI category suggestions** — on Process, an AI-suggested type (with confidence + reason) pre-selects itself; always overridable, and the Inbox still works with zero AI if the call fails.

---

# 🏗 Architecture

```
LifeOS
├── Dashboard         (Inbox capture, Personal Activity: GitHub + Last.fm)
├── Inbox             → Tasks, Notes, Idea Vault, Projects, Calendar, Reminders
├── Projects          ←→ Tasks, Notes, Calendar, Learning
├── Tasks             → Calendar (smart scheduling), ← Recurring series
├── Calendar
├── Notes
├── Journal           ←→ Habits ←→ Analytics
├── Habits
├── Finance
│   └── Debts & Loans
├── Learning
├── Media Vault
├── Idea Vault        → Projects
├── Analytics
├── Settings          (Integrations, push devices, export)
└── AI Assistant
    ├── Today (Today Brain)
    ├── Morning Brief
    ├── Ask LifeOS
    ├── Review
    ├── Prioritize
    └── Journal Insights
```

Notable code layout:

```
app/api/            AI routes, schedule-task, plan-day, rollover, github/activity,
                    lastfm/now-playing, push/subscribe, cron/notifications
lib/ai/             context-engine, focus-grounding, project-graph, habit-streak
lib/                scheduler, rollover, recurrence, project-health, date (Asia/Dhaka-aware helpers),
                    ai-rate-limit, push/, supabase/ (client, server, middleware, service)
hooks/              one SWR hook per resource (useTasks, useFinance, useTaskSeries, ...)
components/         one folder per module, plus shell/ (Sidebar, Command Palette, notifications)
supabase/           numbered SQL migrations
public/sw.js        hand-rolled service worker
```

---

# 🛠 Tech Stack

**Frontend** — Next.js 14 (App Router), TypeScript, React 18. Styling is mostly inline styles driven by CSS custom properties (theme tokens for dark/light), not a component library — deliberately, for full control over the look.

**Data layer** — [SWR](https://swr.vercel.app/) with one dedicated hook per resource (`useTasks`, `useFinance`, `useHabits`, etc.), typed data, optimistic updates with rollback on failure, and shared caching so navigating between pages doesn't refetch from scratch.

**Backend** — Supabase (Postgres + Auth + Storage), Row-Level Security on every table. Server-only operations (cron, push delivery) use a service-role client.

**AI** — Groq (`openai/gpt-oss-120b`) via direct API calls from Next.js Route Handlers, with per-user, Postgres-backed rate limiting.

**Notifications** — `web-push` (VAPID), hand-rolled service worker, GitHub Actions as the scheduler.

**Charts** — Recharts. **Icons** — Lucide.

**Dates** — all "today" and calendar math is computed in `Asia/Dhaka` via `Intl.DateTimeFormat`, never `toISOString()`, so it behaves identically in the browser and on UTC-based serverless hosts.

---

# ▶️ Getting Started

```bash
git clone https://github.com/franklingeezer/lifeos.git
cd lifeos
npm install
cp .env.example .env.local   # then fill in the values below
npm run dev
```

## Environment variables

| Variable | Required | Used for |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | ✅ | Supabase public (anon/publishable) key |
| `GROQ_API_KEY` | ✅ for AI | All AI features (the rest of the app works without it) |
| `SUPABASE_SERVICE_ROLE_KEY` | For cron / push | Server-only; recurring-task generation and push delivery |
| `CRON_SECRET` | For cron / push | Bearer secret protecting `/api/cron/notifications` |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | For push | Web Push signing — generate with `npx web-push generate-vapid-keys` |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | For push | Same public key, exposed to the browser |
| `LASTFM_API_KEY` | For Last.fm card | Free key from last.fm/api |
| `GITHUB_TOKEN` | Optional | Raises GitHub API rate limits for the activity card |

Push notifications only work on a real HTTPS deployment.

## Database setup

Run the files in `supabase/` in the order below. (Don't rely on alphabetical sorting — `phase10` sorts before `phase2`. There is no `phase11`.)

1. `schema.sql`
2. `phase2_tasks.sql`, `phase2b_projects.sql`, `phase2c_calendar.sql`
3. `phase3_journal.sql`, `phase3b_habits.sql`
4. `phase4_learning.sql`, `phase4c_media.sql`, `phase4d_idea_vault.sql`, `phase4e_ai_assistant.sql`, `phase4f_reviews.sql`, `phase4g_journal_insights.sql`, `phase4h_settings.sql`
5. **Create your one Supabase Auth user** (Authentication → Users → Add user — there's no public sign-up), then edit `phase5_auth_lockdown.sql` to set `target_user` to that user's id, and run it
6. `phase6` → `phase10` (relationships, notifications, push subscriptions, push delivery)
7. `phase12_inbox.sql` → `phase19_smart_scheduling.sql`
8. `phase20_github_integration.sql`, `phase21_recurring_tasks.sql`, `phase22_lastfm_integration.sql`

## Scheduled jobs

Add two repository secrets for the GitHub Actions workflow: `LIFEOS_URL` (your deployed URL, no trailing slash) and `CRON_SECRET` (the same value as in your environment). The workflow in `.github/workflows/push-cron.yml` then pings the cron route every ~5 minutes; you can also trigger it manually from the Actions tab.

---

# 📈 Roadmap

## Completed
Dashboard · Projects · Tasks · Calendar · Notes · Journal · Habits · Finance · Debts & Loans · Learning · Media Vault · Idea Vault · Analytics · Settings · full Auth/RLS lockdown · forgot-password flow · SWR data-layer migration (all core modules) · Command Palette with quick-create actions · AI Assistant · full mobile responsiveness pass · currency symbol wired app-wide · data export · Project ↔ Tasks / Notes / Calendar Events / Learning · Idea Vault → Project · Journal ↔ Habits ↔ Analytics · deployed to Vercel · installable PWA with offline app-shell caching · Web Push notifications (VAPID + service worker, delivered via a free GitHub Actions cron) · per-user Settings · Inbox with universal capture, processing drawer, and AI-suggested categories · AI reasoning across the connected module graph · migration off Groq's deprecated `llama-3.3-70b-versatile` to `openai/gpt-oss-120b` · per-user, Postgres-backed AI rate limiting · redesigned login page · middleware fix so `sw.js` and the manifest are reachable when logged out · **LifeOS 2.0** (Context Engine, Today Brain, Project Health badges, calendar time-of-day with real free/busy, Smart Inbox, Ask LifeOS 2.0) · **Task → Calendar Smart Scheduling** (time estimates, rule-based slot finder, propose/accept flow, task-linked events) · **Recurring Tasks** (series templates, daily/weekly/monthly with intervals, instant first occurrence, cron-generated follow-ups, backlog collapsing) · **Personal Activity** (GitHub Activity card and Last.fm Now Playing card, configured from Settings → Integrations) · **Plan My Day** (Today Brain's focus plan placed into real free time, with inline estimate chips and a capacity line) · **Rollover** (Dashboard card for missed blocks: move, move all, or remove) · **Schedule-aware Today Brain** (estimates, blocks, missed blocks, and workload in the Context Engine, plus a post-generation grounding check on invented times and durations) · **Duplicate-block guard** on the Tasks page (move an existing block instead of adding a second) · time-ordered events within a day on the Calendar

## In Progress
Nothing active right now

## Planned
- Series management for recurring tasks (pause, resume, edit, and a view of existing series) — today a series can only be created or stopped
- Show the linked task on its calendar event, and tidy a task's blocks when the task is completed or deleted
- Let "Move it" ignore the block's own current slot when searching for a new one (today its own slot counts as busy)
- Make the notification cron's recurring-task generation fail-safe (don't advance a series if its task insert fails)
- Complete the data export (Inbox, Reminders, task series, integration usernames)
- Unit tests for the pure-logic modules (`recurrence.ts`, `scheduler.ts`, `rollover.ts`, `focus-grounding.ts`)
- A real self-serve sign-up flow and a per-account AI-usage strategy, if this ever grows beyond a handful of users

---

# 🎯 Long-Term Vision

The end goal isn't more modules — it's modules that understand each other, so LifeOS can eventually answer something like *"what should I focus on today?"* by actually reasoning over deadlines, project state, habits, scheduled time, and recent journal context together, instead of showing isolated charts per module. Plan My Day and the schedule-aware Today Brain are the first real steps there.

---

# 🤝 Contributing

This is a personal, single-user project — but suggestions and feedback are always welcome via issues.

---

# 📄 License

MIT License

---

<div align="center">

**Built with Next.js, Supabase, TypeScript, and Claude.**

</div>