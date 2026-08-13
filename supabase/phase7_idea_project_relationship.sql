-- LifeOS — Deep Module Relationships, Part 2: Idea Vault -> Project
--
-- Adds a nullable link from an idea to the project it was converted into.
-- Deliberately does NOT touch the existing status pipeline (spark /
-- developing / validated / archived) — "archived" already means "shelved,
-- not pursuing this" elsewhere in the app, so reusing it to also mean
-- "graduated into a project" would blur two very different outcomes into
-- one status. converted_project_id captures that distinction cleanly
-- without any schema/UI churn on the status field.
--
-- ON DELETE SET NULL: deleting the resulting project shouldn't delete or
-- corrupt the original idea record — it just un-links, same reasoning as
-- the Task <-> Project relationship.

alter table idea_vault_items add column if not exists converted_project_id uuid references projects (id) on delete set null;

create index if not exists idea_vault_items_converted_project_id_idx on idea_vault_items (converted_project_id);