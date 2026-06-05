-- Migration 021: add description column to shares.
-- Optional free-text shown in the share-management modal (Phase 13.2b). Nullable;
-- existing and description-less shares stay empty.
ALTER TABLE shares ADD COLUMN description TEXT;
