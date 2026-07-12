-- LifeOS — Phase 3 (Habit Tracker)
-- habits and habit_logs tables + their grants already exist from Phase 1/2b.
-- Just adding a color column so each habit can be visually distinct.
alter table habits add column if not exists color text not null default '#5EA8A0';