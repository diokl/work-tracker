-- Meetings/회의록 Schema Migration for Supabase PostgreSQL
-- Extends existing Work Tracker schema with meeting recording and transcription features

-- ==================== MEETINGS TABLE ====================

CREATE TABLE IF NOT EXISTS meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  duration_seconds INTEGER,
  language TEXT DEFAULT 'ko',
  participants TEXT[] DEFAULT '{}',
  raw_transcript TEXT,
  summary TEXT,
  key_points JSONB DEFAULT '[]'::jsonb,
  action_items JSONB DEFAULT '[]'::jsonb,
  translation JSONB DEFAULT '{}'::jsonb,
  audio_url TEXT,
  status TEXT DEFAULT 'recording' CHECK (status IN ('recording', 'transcribing', 'summarizing', 'completed', 'error')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add table comment
COMMENT ON TABLE meetings IS 'Meeting records with transcription, summary, and action items';
COMMENT ON COLUMN meetings.id IS 'Unique meeting identifier';
COMMENT ON COLUMN meetings.user_id IS 'Meeting creator/organizer';
COMMENT ON COLUMN meetings.title IS 'Meeting title';
COMMENT ON COLUMN meetings.date IS 'Date of the meeting';
COMMENT ON COLUMN meetings.start_time IS 'When the recording started';
COMMENT ON COLUMN meetings.end_time IS 'When the recording ended';
COMMENT ON COLUMN meetings.duration_seconds IS 'Total duration in seconds';
COMMENT ON COLUMN meetings.language IS 'Primary language of the meeting (default: Korean)';
COMMENT ON COLUMN meetings.participants IS 'Array of participant names';
COMMENT ON COLUMN meetings.raw_transcript IS 'Raw Speech-to-Text output';
COMMENT ON COLUMN meetings.summary IS 'AI-generated meeting summary';
COMMENT ON COLUMN meetings.key_points IS 'JSONB array of key discussion points';
COMMENT ON COLUMN meetings.action_items IS 'JSONB array of {assignee, task, deadline} objects';
COMMENT ON COLUMN meetings.translation IS 'JSONB map of {language: translated_text} pairs';
COMMENT ON COLUMN meetings.audio_url IS 'URL to the audio file in storage';
COMMENT ON COLUMN meetings.status IS 'Meeting processing status';

-- ==================== ROW LEVEL SECURITY ====================

ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;

-- ==================== MEETINGS POLICIES ====================

-- SELECT: owner can see own meetings
CREATE POLICY "meetings_select_own" ON meetings
  FOR SELECT USING (auth.uid() = user_id);

-- SELECT: approved users in same org can see other users' meetings
-- (This assumes meetings are shared within organization/team)
CREATE POLICY "meetings_select_shared_org" ON meetings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles creator
      WHERE creator.id = meetings.user_id
      AND creator.is_approved = true
      AND EXISTS (
        SELECT 1 FROM profiles viewer
        WHERE viewer.id = auth.uid()
        AND viewer.is_approved = true
      )
    )
  );

-- INSERT: authenticated users can create meetings
CREATE POLICY "meetings_insert_own" ON meetings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- UPDATE: owner can update own meetings
CREATE POLICY "meetings_update_own" ON meetings
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- DELETE: owner can delete own meetings
CREATE POLICY "meetings_delete_own" ON meetings
  FOR DELETE USING (auth.uid() = user_id);

-- ==================== INDEXES ====================

-- Index on user_id and date for efficient filtering
CREATE INDEX IF NOT EXISTS idx_meetings_user_id_date ON meetings(user_id, date DESC);

-- Index on status for tracking processing state
CREATE INDEX IF NOT EXISTS idx_meetings_status ON meetings(status);

-- Index on user_id alone for quick user lookups
CREATE INDEX IF NOT EXISTS idx_meetings_user_id ON meetings(user_id);

-- Index on created_at for timeline queries
CREATE INDEX IF NOT EXISTS idx_meetings_created_at ON meetings(created_at DESC);

-- ==================== FULL-TEXT SEARCH ====================

-- Add tsvector column to meetings for full-text search on transcripts and summaries
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Function to update search vector for meetings
CREATE OR REPLACE FUNCTION update_meetings_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := to_tsvector('english',
    COALESCE(NEW.title, '') || ' ' ||
    COALESCE(NEW.raw_transcript, '') || ' ' ||
    COALESCE(NEW.summary, '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for meeting search vector updates
DROP TRIGGER IF EXISTS meetings_search_vector_update ON meetings;
CREATE TRIGGER meetings_search_vector_update
  BEFORE INSERT OR UPDATE ON meetings
  FOR EACH ROW EXECUTE FUNCTION update_meetings_search_vector();

-- GIN index for full-text search on meetings
CREATE INDEX IF NOT EXISTS idx_meetings_search_vector ON meetings USING GIN(search_vector);

-- ==================== TRIGGERS ====================

-- Function to update meetings updated_at timestamp
CREATE OR REPLACE FUNCTION update_meetings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for meetings updated_at
DROP TRIGGER IF EXISTS meetings_updated_at ON meetings;
CREATE TRIGGER meetings_updated_at
  BEFORE UPDATE ON meetings
  FOR EACH ROW EXECUTE FUNCTION update_meetings_updated_at();
