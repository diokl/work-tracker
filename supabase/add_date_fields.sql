ALTER TABLE tasks ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS end_date DATE;

-- Backfill: set start_date = date for existing tasks
UPDATE tasks SET start_date = date WHERE start_date IS NULL;
