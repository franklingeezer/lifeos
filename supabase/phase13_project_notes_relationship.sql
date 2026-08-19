-- LifeOS — Deep Module Relationships, Part 2: Project <-> Notes
--
-- Same pattern as phase6 (Project <-> Tasks): a nullable link, ON DELETE
-- SET NULL so deleting a project unlinks its notes rather than deleting
-- them, no RLS changes needed since notes are already user_id-scoped and
-- the project picker only ever lists the signed-in user's own projects.

alter table notes add column if not exists project_id uuid references projects (id) on delete set null;

create index if not exists notes_project_id_idx on notes (project_id);