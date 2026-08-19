-- LifeOS — Deep Module Relationships, Part 3: Project <-> Calendar Events
--
-- Same pattern as phase6/phase13: nullable link, ON DELETE SET NULL, no
-- RLS changes needed.
--
-- Worth noting this is a DIFFERENT relationship than the existing
-- project-deadline sync already on the Calendar page (that one is a
-- read-only virtual event synthesized from projects.deadline — see
-- useCalendar.ts's projectDeadlines — not a real row in `events` at all).
-- This adds a real, storable link so an actual calendar event (e.g. "Team
-- sync for LifeOS relaunch") can be tagged to a project and show up in
-- that project's linked-items list, distinct from its auto-shown deadline.

alter table events add column if not exists project_id uuid references projects (id) on delete set null;

create index if not exists events_project_id_idx on events (project_id);