-- LifeOS Roadmap — Phase 3: Calendar time-of-day data, Part 1 (schema)
--
-- `events` has only ever stored a date + an all_day flag — see
-- lib/ai/context-engine.ts's has_time_of_day_data, which has been
-- hardcoded false specifically because of this gap. Real time-block
-- awareness (for Prioritize/Today Brain's "available time" reasoning)
-- needs an actual start/end time per event.
--
-- Both columns are nullable and additive:
--   - all_day events (the only kind that has ever existed until now)
--     simply leave both null — nothing about existing rows changes.
--   - a timed event sets both. The app layer is responsible for keeping
--     all_day/start_time/end_time consistent (Part 3 handles that in the
--     UI); this migration only adds the storage, it doesn't enforce that
--     relationship at the DB level, matching how the rest of this schema
--     favors app-level validation over DB constraints (e.g. tasks.status,
--     projects.priority are plain text columns, not enums/check
--     constraints either).
alter table events add column if not exists start_time time;
alter table events add column if not exists end_time time;