-- Trip Planner — Supabase Schema
-- Run this in the Supabase SQL editor for your project.

-- ─────────────────────────────────────────────
-- TABLES
-- ─────────────────────────────────────────────

-- Master item library (one row per item per user)
CREATE TABLE IF NOT EXISTS public.master_items (
  user_id      UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  id           TEXT    NOT NULL,
  name         TEXT    NOT NULL,
  cat_id       TEXT    NOT NULL,
  tab          TEXT    NOT NULL CHECK (tab IN ('pack','todo')),
  subcat_label TEXT,
  PRIMARY KEY (user_id, id)
);

-- Master category library (one row per category per user)
CREATE TABLE IF NOT EXISTS public.master_cats (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  id      TEXT NOT NULL,
  icon    TEXT NOT NULL,
  title   TEXT NOT NULL,
  tab     TEXT NOT NULL CHECK (tab IN ('pack','todo')),
  PRIMARY KEY (user_id, id)
);

-- Trips (one row per trip per user)
CREATE TABLE IF NOT EXISTS public.trips (
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  id         TEXT        NOT NULL,
  name       TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, id)
);

-- Per-trip state (active items, checked items, day-of flags)
CREATE TABLE IF NOT EXISTS public.trip_state (
  user_id             UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trip_id             TEXT        NOT NULL,
  pack_active         TEXT[],                     -- NULL means "use trip defaults"
  todo_active         TEXT[],
  pack_checked        JSONB       NOT NULL DEFAULT '{}',
  todo_checked        JSONB       NOT NULL DEFAULT '{}',
  pack_dayof          TEXT[]      NOT NULL DEFAULT '{}',
  todo_dayof          TEXT[]      NOT NULL DEFAULT '{}',
  pack_dayof_removed  TEXT[]      NOT NULL DEFAULT '{}',
  todo_dayof_removed  TEXT[]      NOT NULL DEFAULT '{}',
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, trip_id)
);

-- User metadata (last viewed trip, permanently deleted items, change/edit logs)
CREATE TABLE IF NOT EXISTS public.user_meta (
  user_id              UUID  PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  last_trip            TEXT,
  permanently_deleted  JSONB NOT NULL DEFAULT '[]',
  change_log           JSONB NOT NULL DEFAULT '[]',
  edit_log             JSONB NOT NULL DEFAULT '[]'
);

-- ─────────────────────────────────────────────
-- ROW-LEVEL SECURITY
-- Users can only read/write their own data.
-- ─────────────────────────────────────────────

ALTER TABLE public.master_items    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.master_cats     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trips           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_state      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_meta       ENABLE ROW LEVEL SECURITY;

-- master_items
CREATE POLICY "Users manage own master_items"
  ON public.master_items FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- master_cats
CREATE POLICY "Users manage own master_cats"
  ON public.master_cats FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- trips
CREATE POLICY "Users manage own trips"
  ON public.trips FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- trip_state
CREATE POLICY "Users manage own trip_state"
  ON public.trip_state FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- user_meta
CREATE POLICY "Users manage own user_meta"
  ON public.user_meta FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ─────────────────────────────────────────────
-- INDEXES (optional, for performance)
-- ─────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS master_items_user_idx ON public.master_items (user_id);
CREATE INDEX IF NOT EXISTS master_cats_user_idx  ON public.master_cats  (user_id);
CREATE INDEX IF NOT EXISTS trips_user_idx        ON public.trips        (user_id);
CREATE INDEX IF NOT EXISTS trip_state_user_idx   ON public.trip_state   (user_id);
