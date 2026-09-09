<div align="center">

# 🧠 LifeOS

### Your Personal Operating System

A single-user, AI-assisted productivity system that connects tasks, projects, notes, habits, finance, learning, journaling, ideas, and time into one workspace.

![Next.js](https://img.shields.io/badge/Next.js-14-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-green)
![Status](https://img.shields.io/badge/Status-Active%20Development-success)

</div>

---

## ✨ Overview

LifeOS is a personal operating system built around one idea:

> **Your productivity data should understand how it connects.**

Instead of keeping tasks, projects, notes, calendar events, habits, finances, learning, journaling, and ideas in separate tools, LifeOS brings them together into one connected workspace.

LifeOS uses these relationships to provide better organization, planning, insights, and AI-assisted decision making.

---

## 🚀 Core Features

- 📊 **Dashboard** — Daily priorities, AI Morning Brief, habits, projects, calendar, finance, and recent activity
- ✅ **Tasks** — Kanban/list views, priorities, deadlines, subtasks, search, and project linking
- 📁 **Projects** — Progress, deadlines, health, tasks, notes, calendar events, and learning relationships
- 📅 **Calendar** — All-day and timed events with start/end times
- 📝 **Notes** — Markdown, folders, tags, pinning, search, and project linking
- 📓 **Journal** — Mood, energy, stress, wins, lessons, goals, and gratitude
- 🔁 **Habits** — Daily tracking, streaks, and success statistics
- 💰 **Finance** — Income, expenses, savings, investments, debts, and analytics
- 📚 **Learning** — Courses, study hours, completion, certificates, and project relationships
- 💡 **Idea Vault** — Capture, develop, validate, archive, and convert ideas into projects
- 📥 **Inbox** — Capture first, organize later
- 🖼️ **Media Vault** — Images, videos, and documents with tags and captions
- 📈 **Analytics** — Productivity, finance, habits, projects, and idea insights
- 🤖 **AI Assistant** — Morning Brief, Today Brain, Ask LifeOS, Review, Prioritize, Journal Insights, and Smart Inbox
- ⌘ **Command Palette** — Global search and quick actions
- 🔔 **Web Push** — Task reminders and overdue notifications
- 📱 **PWA** — Installable application with offline app shell
- 💾 **Data Export** — Export personal LifeOS data as JSON

---
## 🧩 Features

### 📊 Dashboard

The central overview of LifeOS.

- Daily priorities
- AI Morning Brief
- Habit progress
- Active projects
- Weekly calendar
- Finance snapshot
- Recent notes

---

### ✅ Tasks

Manage everyday work with a flexible task system.

- Kanban and list views
- Priorities
- Due dates
- Subtasks
- Search
- Project linking
- Mobile-friendly interactions
- Quick creation through Command Palette

---

### 📁 Projects

Keep larger goals organized and connected.

- Status and priority
- Deadlines
- Progress tracking
- Project health
- Linked tasks
- Linked notes
- Linked calendar events
- Linked learning items

---

### 📅 Calendar

Manage both date-based and time-based events.

- Monthly calendar
- All-day events
- Start and end times
- Color-coded events
- Task due-date indicators
- Project-linked events

---

### 📝 Notes

A flexible space for structured and unstructured information.

- Markdown support
- Folders
- Tags
- Pinning
- Full-text search
- Project linking

---

### 📓 Journal

Capture daily reflections and personal context.

- Mood
- Energy
- Stress
- Wins
- Failures
- Lessons
- Tomorrow's goals
- Gratitude

---

### 🔁 Habits

Track consistency over time.

- Daily check-ins
- Current streaks
- Longest streak
- 30-day success rate

---

### 💰 Finance

Keep personal financial information organized.

- Income
- Expenses
- Savings
- Investments
- Monthly summaries
- Category breakdowns
- Debts & loans
- Currency settings

---

### 📚 Learning

Track learning progress alongside the rest of your life.

- Courses
- Study hours
- Completion tracking
- Certificates
- Project relationships

---

### 💡 Idea Vault

Move ideas from initial thoughts toward execution.

**Spark → Developing → Validated → Archived**

Validated ideas can be converted into projects.

---

### 📥 Inbox

The universal capture layer of LifeOS.

> **Capture first → Organize later**

Quickly capture a thought without deciding what it should become.

Inbox items can be converted into:

- Tasks
- Notes
- Ideas
- Projects
- Calendar events
- Reminders

Conversions remain connected to the original Inbox item for traceability.

---

### 🖼️ Media Vault

Organize personal media inside LifeOS.

- Images
- Videos
- Documents
- Tags
- Captions

---

### 📈 Analytics

Understand patterns across your LifeOS data.

- Task statistics
- Finance analytics
- Habit trends
- Project analytics
- Idea analytics
- Habit ↔ mood correlation

---
## 🤖 AI Assistant

LifeOS uses AI to help interpret connected personal data and turn it into useful actions.

### 🧠 AI Features

- **Morning Brief** — Summarizes what matters today
- **Today Brain** — Builds a focused daily plan using tasks, projects, habits, deadlines, and calendar availability
- **Ask LifeOS** — Ask questions about your own LifeOS data
- **Prioritize** — Suggests task priorities using deadlines and project context
- **Review** — Generates reflections from recent activity
- **Journal Insights** — Identifies grounded patterns from journal and habit data
- **Smart Inbox** — Suggests what an Inbox capture could become

AI suggestions are validated against available LifeOS data and do not replace user confirmation for actions such as Inbox conversion.

---

## 🔗 Connected System

LifeOS connects its modules so information can flow between them.

- **Projects** → Tasks, Notes, Calendar Events, Learning
- **Tasks** → Calendar
- **Ideas** → Projects
- **Inbox** → Tasks, Notes, Ideas, Projects, Calendar Events, Reminders
- **Journal** → Habits → Analytics

These relationships also provide context for AI features.

---

## 🧠 Context Engine

The Context Engine provides a shared view of LifeOS data for AI features.

It can combine:

- Tasks
- Projects
- Calendar
- Habits
- Journal
- Learning
- Finance
- Recent activity

This allows AI features to reason across connected parts of LifeOS instead of treating each module separately.

---

## 🩺 Project Health

Projects are evaluated using real project signals such as:

- Progress
- Activity
- Deadlines
- Tasks

Health states:

- 🟢 Healthy
- 🟡 Slowing
- 🟠 At Risk
- 🔴 Blocked

Project Health is deterministic and does not depend on AI.

 ## 🔐 Security

LifeOS is currently designed as a single-user system.

- Supabase Authentication
- Row-Level Security (RLS)
- User-owned database records
- Protected API routes
- Server-side AI requests
- Per-user AI rate limiting
- Forgot-password flow
- Secure session handling

---

## 🛠️ Tech Stack

### Frontend
- Next.js 14
- React 18
- TypeScript
- Tailwind CSS

### Backend & Database
- Supabase
- PostgreSQL
- Supabase Auth
- Supabase Storage
- Row-Level Security

### Data & State
- SWR
- Zustand
- Zod

### AI
- Groq
- `openai/gpt-oss-120b`

### UI & Visualization
- Lucide
- Recharts

### Deployment
- Vercel
- GitHub Actions

---

## 🏗️ Project Structure

- `app/` — Pages, layouts, and API routes
- `components/` — Reusable UI components
- `hooks/` — Client-side data and application hooks
- `lib/` — Shared utilities, AI, Supabase, and business logic
- `public/` — PWA and static assets
- `supabase/` — Database schema and migrations
- `.github/` — GitHub Actions workflows

## ⚙️ Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/franklingeezer/lifeos.git
cd lifeos
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

```bash
cp .env.example .env.local
```

Add the required Supabase, Groq, and Web Push variables to `.env.local`.

### 4. Set up Supabase

Run the required SQL files from the `supabase/` directory in your Supabase project.

Make sure the latest migrations are applied before using features that depend on them.

### 5. Start the development server

```bash
npm run dev
```

Open `http://localhost:3000` in your browser.

### 6. Check the production build

```bash
npm run lint
npm run build
```
---

## 📌 Roadmap

### Next
- Task → Calendar smart scheduling
- More time-aware daily planning
- Context-aware notifications
- Inbox AI improvements
- Stronger automated testing

### Future
- Long-term productivity memory
- More proactive suggestions
- Advanced scheduling
- Deeper cross-module automation

---

## 🎯 Vision

LifeOS aims to become a personal system where your tasks, projects, time, habits, knowledge, and ideas work together instead of living in separate tools.

> **Capture quickly → organize intentionally → connect everything → act on what matters.**

---

## 🤝 Contributing

LifeOS is currently a personal single-user project.

Feedback, ideas, and suggestions are welcome through GitHub Issues.

---

## 📄 License

MIT License

---

<div align="center">

**Built with Next.js, Supabase, TypeScript, and Groq.**

</div>

