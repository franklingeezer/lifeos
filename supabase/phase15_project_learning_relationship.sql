-- LifeOS — Deep Module Relationships, Part 4: Project <-> Learning
--
-- Same pattern as phase6/phase13/phase14: nullable link, ON DELETE SET
-- NULL, no RLS changes needed. Lets a course/skill you're studying be
-- tied to the project it's actually in service of (e.g. "Docker" linked
-- to the "Cyber Terminal" project you're deploying with it).

alter table learning_items add column if not exists project_id uuid references projects (id) on delete set null;

create index if not exists learning_items_project_id_idx on learning_items (project_id);