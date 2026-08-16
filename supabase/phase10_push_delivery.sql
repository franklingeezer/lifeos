-- LifeOS — Phase 10: push delivery tracking
--
-- Adds a single column: when a notification row has actually had a push
-- sent for it. Separate from `read_at`/`dismissed_at` on purpose — those
-- track whether YOU'VE seen it, this tracks whether the SERVER has
-- delivered it. A notification can be pushed and still unread for hours;
-- it should never be pushed twice.

alter table notifications add column if not exists push_sent_at timestamptz;

create index if not exists notifications_pending_push_idx
  on notifications (user_id, scheduled_at)
  where push_sent_at is null and dismissed_at is null;