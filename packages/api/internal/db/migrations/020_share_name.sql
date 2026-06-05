-- Migration 020: add name column to shares.
-- Nullable — existing shares and shares created without a name stay unnamed.
ALTER TABLE shares ADD COLUMN name TEXT;
