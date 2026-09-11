-- LifeOS Roadmap — Task → Calendar Smart Scheduling, Part 1 (schema)
--
-- Two additive, nullable columns:
--
-- tasks.estimated_minutes — how long the task is expected to take.
-- Nullable and optional, same reasoning as project_id in phase6: most
-- existing tasks (and plenty of future ones, for quick items not worth
-- scheduling) will never set this, and that's fine — the scheduler
-- (lib/scheduler.ts) simply can't propose a slot for a task with no
-- estimate, and says so rather than guessing a duration.
--
-- events.task_id — the other half of Inbox's own "converted item keeps a
-- traceable reference back to what created it" pattern (phase12), applied
-- here in reverse: when a scheduling proposal is accepted, the Calendar
-- event created from it stores which task it's blocking time for. ON
-- DELETE SET NULL, not CASCADE — deleting a task should unschedule its
-- event, not silently delete calendar history.
alter table tasks add column if not exists estimated_minutes int;
alter table events add column if not exists task_id uuid references tasks (id) on delete set null;

create index if not exists events_task_id_idx on events (task_id);