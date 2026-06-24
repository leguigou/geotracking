-- Migration: add note and has_changes columns to scan_results
-- Corresponds to backend model changes (ScanResult.note, ScanResult.has_changes)

ALTER TABLE scan_results
  ADD COLUMN IF NOT EXISTS note TEXT,
  ADD COLUMN IF NOT EXISTS has_changes BOOLEAN NOT NULL DEFAULT FALSE;
