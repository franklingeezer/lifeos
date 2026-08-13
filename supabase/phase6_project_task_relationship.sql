-- LifeOS — Deep Module Relationships, Part 1: Project <-> Tasks
--
-- Adds a nullable link from tasks to projects. Nullable is deliberate —
-- most existing tasks (and plenty of future ones) have no project and
-- that's completely fine; this is an optional relationship, not a
-- required one.
--
-- ON DELETE SET NULL rather than CASCADE: deleting a project should
-- unlink its tasks, not silently delete them. Losing a project you
-- created by mistake shouldn't take a week of task history down with it.
--
-- No RLS changes needed — tasks are already scoped by their own user_id,
-- and the project picker in the UI only ever lists the signed-in user's
-- own projects (themselves RLS-scoped), so a task can never end up
-- linked to someone else's project in the first place.

alter table tasks add column if not exists project_id uuid references projects (id) on delete set null;

create index if not exists tasks_project_id_idx on tasks (project_id);