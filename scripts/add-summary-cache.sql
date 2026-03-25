-- Add summary cache columns to line_users
ALTER TABLE line_users ADD COLUMN IF NOT EXISTS summary TEXT;
ALTER TABLE line_users ADD COLUMN IF NOT EXISTS summary_updated_at TIMESTAMPTZ;
