<div align="center">

# 🧠 LifeOS

### Your Personal Operating System

*A single-user, AI-assisted productivity app that connects tasks, projects, notes, journals, habits, finance, learning, media, and ideas into one workspace instead of a pile of disconnected tools.*

---

![Next.js](https://img.shields.io/badge/Next.js-14-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-green)
![SWR](https://img.shields.io/badge/Data%20layer-SWR-orange)
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

- Real Supabase Auth login, with session-refresh middleware
- Full forgot-password flow (email reset link → callback → set new password)
- Rate limiting on every AI route (15 requests / 10 min, shared across all five) so a stray loop can't burn through the Groq quota

---

# 🚀 Features

## Dashboard
Daily priorities, AI Morning Brief, habit progress, active projects, this week's calendar, finance snapshot, and recent notes — all live data, no mock content.

## Projects
Project management with status, priority, deadlines, and progress. Linked tasks show up on the project itself, with a live "X of Y done" count alongside the manual progress slider — informational, never overriding your own control.

## Tasks
Kanban board (swipeable on mobile) and list view, priorities, due dates, subtasks, full-text search, and optional project linking. Command Palette (`Ctrl/Cmd+K`) can create a task instantly from anywhere with `task: ___`.

## Calendar
Monthly view, event management, color coding.

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

## AI Assistant
Five focused tools, not one AI dumped into a chat box:
- **Morning Brief** — a short daily summary with history you can browse
- **Ask LifeOS** — natural-language search across your own data
- **Review** — weekly/monthly summaries of what actually happened
- **Prioritize** — suggests task priority changes you review and apply (or don't)
- **Journal Insights** — finds real patterns across entries, including habit-mood correlations *only* when there's genuinely enough data to say so honestly

## Analytics
Live charts across tasks, finance, habits, projects, and ideas — including a **habit ↔ mood correlation** card that compares average mood on days a habit was done vs. skipped, gated behind a minimum sample size so it never shows a misleading pattern from too little data.

## Command Palette
Global `Ctrl/Cmd+K` search across Tasks, Notes, Projects, Habits, Learning, Idea Vault, and Calendar events — full keyboard navigation, plus inline quick-create commands (`task:`, `note:`) that create something instantly without leaving wherever you are.

## Data Export
One-click JSON backup of everything — Tasks, Projects, Notes, Habits, Finance, Debts, Calendar, Journal, Learning, Media metadata, and Ideas — independent of Supabase, from Settings.

---

# 🧠 AI Philosophy

> **AI should reduce busywork, not replace thinking — and it should never invent what it doesn't actually know.**

Every LifeOS feature works completely without AI. Where AI is used (Groq, `openai/gpt-oss-120b`), it's held to a strict grounding standard — Journal Insights, for example, is explicitly forbidden from attributing a mood shift to any cause that isn't literally present in the entry text or habit data for that date. No invented causal stories, no forced patterns from thin data.

---

# 🔗 Deep Module Relationships

LifeOS is gradually moving from "a set of connected pages" toward modules that actually understand each other:

- **Project ↔ Tasks** — link tasks to a project; see linked-task progress on the project itself
- **Project ↔ Notes, Project ↔ Calendar Events, Project ↔ Learning** — same link-and-see-back-on-the-project pattern, for whichever module a piece of work actually lives in
- **Tasks ↔ Calendar** — every task's due date automatically shows up as a badge on the Calendar page; edit the task, not the badge, to change it
- **Idea Vault → Project** — convert a validated idea into a real project in one click
- **Journal ↔ Habits ↔ Analytics** — habit completion data feeds both the Analytics correlation chart and the AI's Journal Insights, with matching sample-size honesty between the two

---

# 🧭 AI Reasoning Across Modules

The AI Assistant's tools don't just read their own module in isolation anymore — they can see how Projects connect to Tasks, Notes, Calendar Events, and Learning, and use that when it's actually relevant.

- **Morning Brief & Review** — pull a compact "project context" (linked open/overdue tasks, notes, upcoming events, learning progress) for each active project, and combine it into one bullet when genuinely noteworthy — e.g. "Cyber Terminal — 3 overdue tasks, standup Thursday" instead of two disconnected facts. Never forces a mention when a project has nothing linked worth surfacing.
- **Prioritize** — a task with no due date of its own can still get ranked higher because the *project* it's linked to has a deadline within 14 days; the reason given explains exactly why.
- **Ask LifeOS** — now searches Calendar Events and Learning items too (previously unsearchable), and tags every result with its linked project, so "stuff about Cyber Terminal" surfaces the task, note, event, and learning item together, not just the project record.
- **Journal Insights was deliberately left alone.** It has no `project_id` and already holds itself to a stricter grounding rule than the rest of the AI tools — extending it here would either break that rule or need a real redesign, and a well-reasoned feature staying as-is beats forcing symmetry across all 5 tools for its own sake.

---

# 📱 Mobile

Every page works properly at phone width — not just "doesn't break," but actually designed for it: a slide-in nav drawer replaces the desktop rail, Tasks' kanban becomes swipeable with tappable column tabs, Notes/Journal use a real mobile master-detail pattern, and every modal/drawer fits within a narrow screen without overflowing.

---

# 🔔 PWA & Push Notifications

LifeOS installs like a real app — on Android via Chrome's install prompt, on iOS via Safari's "Add to Home Screen" (Apple requires the app to actually be installed before it'll grant push permission, so on iOS notifications only work once it's on your home screen).

- **Offline app shell** — a hand-rolled service worker (not `next-pwa`, kept consistent with the rest of the codebase's "own the code" approach) caches the static shell and shows a proper offline page instead of a browser error when you lose connection. Your actual data is deliberately never cached this way — Supabase reads/writes always go live, so you never see stale personal data offline.
- **Web Push** — reminders and overdue-task alerts reach you even when LifeOS is closed, via VAPID-signed push and a `push_subscriptions` table (RLS-scoped like everything else). Each browser/device gets its own subscription, manageable from Settings.
- **Delivery** — a cron-triggered route checks for anything due and pushes it. Vercel's free Hobby plan only allows once-daily cron jobs, so the actual every-few-minutes trigger runs via a free GitHub Actions workflow instead, with Vercel's own cron kept as a once-a-day fallback.

---

# 📥 Inbox

A universal capture layer, built on the "capture first, organize later" principle: nothing typed into it needs a category up front.

- **Capture anywhere** — a bar on the Dashboard, the `inbox:` prefix in the Command Palette, or the global **Ctrl/Cmd+Shift+I** shortcut, which opens the palette pre-filled and ready to type.
- **Process, don't presort** — each capture sits unprocessed until you decide what it actually is. A processing drawer converts it into a real Task, Note, Idea, Project, Event, or Reminder, asking only for the one field that type genuinely needs (a due date for a task, a date for an event) — everything else takes a sane default, editable later from the real page.
- **Traceable history** — a converted item keeps a `→ Task` / `→ Note` tag pointing at what it became, and moves to Processed rather than disappearing.
- **AI category suggestions are deliberately not in v1** — per the feature's own design doc, Inbox needed to work completely without AI before adding it, to avoid the capture step ever depending on an API call succeeding.

# 🏗 Architecture

```
LifeOS
├── Dashboard
├── Projects        ←→ Tasks, Notes, Calendar, Learning
├── Tasks
├── Calendar
├── Notes
├── Journal          ←→ Habits ←→ Analytics
├── Habits
├── Finance
│   └── Debts & Loans
├── Learning
├── Media Vault
├── Idea Vault       → Projects
├── Inbox            → Tasks, Notes, Idea Vault, Projects, Calendar, Reminders
├── Analytics
├── Settings
└── AI Assistant
    ├── Morning Brief
    ├── Ask LifeOS
    ├── Review
    ├── Prioritize
    └── Journal Insights
```

---

# 🛠 Tech Stack

**Frontend** — Next.js 14 (App Router), TypeScript, React 18. Styling is mostly inline styles driven by CSS custom properties (theme tokens for dark/light), not a component library — deliberately, for full control over the look.

**Data layer** — [SWR](https://swr.vercel.app/) with one dedicated hook per resource (`useTasks`, `useFinance`, `useHabits`, etc.), typed data, optimistic updates with rollback on failure, and shared caching so navigating between pages doesn't refetch from scratch.

**Backend** — Supabase (Postgres + Auth + Storage), Row-Level Security on every table.

**AI** — Groq (`openai/gpt-oss-120b`) via direct API calls from Next.js Route Handlers, with server-side rate limiting.

**Charts** — Recharts. **Icons** — Lucide.

---

# ▶️ Getting Started

```bash
git clone https://github.com/franklingeezer/lifeos.git
cd lifeos
npm install
cp .env.example .env.local   # fill in your Supabase + Groq keys
npm run dev
```

For Web Push (optional — the app works fully without it), also generate a VAPID keypair with `npx web-push generate-vapid-keys` and add `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` to `.env.local`. Push notifications only work on a real HTTPS deployment, and delivery needs `CRON_SECRET` plus a scheduled trigger — see `.github/workflows/push-cron.yml`.

Run the SQL files in `supabase/` (in numeric/phase order) against your Supabase project before first use — they set up every table, RLS policy, and the auth lockdown. You'll also need to create your one Supabase Auth user manually under Authentication → Users, since there's no public sign-up.

---

# 📈 Roadmap

## Completed
Dashboard · Projects · Tasks · Calendar · Notes · Journal · Habits · Finance · Debts & Loans · Learning · Media Vault · Idea Vault · Analytics · Settings · full Auth/RLS lockdown · forgot-password flow · SWR data-layer migration (all 11 core modules) · Command Palette with quick-create actions · AI Assistant (all 5 tools) · full mobile responsiveness pass, including a fix for Calendar/Notes overflow on narrow screens · currency symbol wired app-wide · data export · Project ↔ Tasks · Idea Vault → Project · Journal ↔ Habits ↔ Analytics · deployed to Vercel · installable PWA with offline app-shell caching · Web Push notifications for due reminders and overdue tasks (VAPID + service worker, delivered via a free GitHub Actions cron since Vercel Hobby caps cron to once daily) · per-user Settings (display name/currency no longer shared across accounts) · Inbox — universal quick capture with zero required categorization, a processing drawer to convert a capture into a real Task/Note/Idea/Project/Event/Reminder, and entry points everywhere (dashboard widget, Command Palette `inbox:` prefix, Ctrl/Cmd+Shift+I shortcut) · Dashboard's task list now hides completed items by default instead of showing every task ever created · Project ↔ Notes, Project ↔ Calendar Events, Project ↔ Learning (each with a picker on both create and edit, plus a read-only "Linked —" list back on the Project page) · fixed a Notes editor input-lag bug where typing fought the debounced save · AI reasoning across the connected module graph (Morning Brief, Review, Prioritize, Ask LifeOS) · migrated off Groq's deprecated `llama-3.3-70b-versatile` to `openai/gpt-oss-120b` · AI route rate limiting rebuilt as per-user and Postgres-backed instead of a single shared in-memory bucket, so it actually works across Vercel's serverless instances and can't let one account lock out another · redesigned login page (rounded card, icon-prefixed inputs, password visibility toggle) and fixed a real hydration bug in it (a literal `"` in inline CSS getting escaped differently server vs. client — fixed via `dangerouslySetInnerHTML`) · fixed a middleware bug that was redirecting `sw.js`/`manifest.webmanifest` to `/login` for logged-out visitors, silently breaking the service worker's ability to ever install for a first-time user

## In Progress
Nothing active right now

## Planned
A deeper Tasks ↔ Calendar link, if ever needed — the current due-date badge is one-directional and read-only; scheduling a task as an actual timed block (not just an all-day badge) would be the next step up, but isn't planned by default · AI category suggestions for Inbox captures (deliberately deferred from the MVP) · a real self-serve sign-up flow and a per-account/Groq-usage strategy, if this ever grows beyond a handful of users

---

# 🎯 Long-Term Vision

The end goal isn't more modules — it's modules that understand each other, so LifeOS can eventually answer something like *"what should I focus on today?"* by actually reasoning over deadlines, project state, habits, and recent journal context together, instead of showing isolated charts per module.

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