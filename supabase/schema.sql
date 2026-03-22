-- Work Tracker PostgreSQL Schema for Supabase
-- Migration from Electron SQLite to multi-user web app

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ==================== CORE TABLES ====================

-- Profiles table (linked to Supabase auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  position TEXT,
  department TEXT,
  part TEXT,
  eval_year INTEGER,
  avatar_color TEXT DEFAULT '#818CF8',
  role TEXT DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  is_approved BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Projects table
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  kpi_id UUID,
  workflow JSONB,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tasks table
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT,
  date DATE NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'waiting_next')),
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  kpi_id UUID,
  next_action TEXT,
  source TEXT DEFAULT 'manual',
  tags JSONB DEFAULT '[]'::jsonb,
  ai_summary TEXT,
  is_private BOOLEAN DEFAULT false,
  assigned_users UUID[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- KPI Definitions table
CREATE TABLE IF NOT EXISTS kpi_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  kpi_no INTEGER NOT NULL,
  name TEXT NOT NULL,
  weight INTEGER NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('numeric', 'schedule', 'score', 'count')),
  target_value TEXT,
  grade_criteria JSONB,
  formula_description TEXT,
  deadline DATE,
  sub_items JSONB,
  eval_year INTEGER,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, kpi_no, eval_year)
);

-- KPI Values table
CREATE TABLE IF NOT EXISTS kpi_values (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  kpi_def_id UUID REFERENCES kpi_definitions(id) ON DELETE CASCADE,
  value REAL,
  task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
  input_date DATE DEFAULT CURRENT_DATE,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ==================== MULTI-USER TABLES ====================

-- Approval Requests table
CREATE TABLE IF NOT EXISTS approval_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  department TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  data JSONB,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Shared Tasks junction table
CREATE TABLE IF NOT EXISTS shared_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  shared_with UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  shared_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(task_id, shared_with)
);

-- Settings table
CREATE TABLE IF NOT EXISTS settings (
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value TEXT,
  updated_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY(user_id, key)
);

-- ==================== ROW LEVEL SECURITY ====================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE kpi_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE kpi_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- ==================== PROFILES POLICIES ====================

-- SELECT: everyone can see approved users
CREATE POLICY "profiles_select_approved" ON profiles
  FOR SELECT USING (is_approved = true);

-- SELECT: users can see their own profile regardless of approval status
CREATE POLICY "profiles_select_own" ON profiles
  FOR SELECT USING (auth.uid() = id);

-- UPDATE: users can update their own profile
CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- INSERT: service_role only (handled by trigger on auth.users)
CREATE POLICY "profiles_insert_service_role" ON profiles
  FOR INSERT WITH CHECK (false);

-- ==================== PROJECTS POLICIES ====================

-- SELECT: owner can see own projects
CREATE POLICY "projects_select_own" ON projects
  FOR SELECT USING (auth.uid() = user_id);

-- INSERT: authenticated users can create projects
CREATE POLICY "projects_insert_own" ON projects
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- UPDATE: owner can update own projects
CREATE POLICY "projects_update_own" ON projects
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- DELETE: owner can delete own projects
CREATE POLICY "projects_delete_own" ON projects
  FOR DELETE USING (auth.uid() = user_id);

-- ==================== TASKS POLICIES ====================

-- SELECT: owner can see own tasks
-- OR task is not private AND user is in assigned_users
-- OR task is shared via shared_tasks
CREATE POLICY "tasks_select_own" ON tasks
  FOR SELECT USING (
    auth.uid() = user_id
    OR (
      is_private = false
      AND auth.uid() = ANY(assigned_users)
    )
    OR EXISTS (
      SELECT 1 FROM shared_tasks
      WHERE shared_tasks.task_id = tasks.id
      AND shared_tasks.shared_with = auth.uid()
    )
  );

-- INSERT: authenticated users can create tasks
CREATE POLICY "tasks_insert_own" ON tasks
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- UPDATE: owner can update own tasks
CREATE POLICY "tasks_update_own" ON tasks
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- DELETE: owner can delete own tasks
CREATE POLICY "tasks_delete_own" ON tasks
  FOR DELETE USING (auth.uid() = user_id);

-- ==================== KPI DEFINITIONS POLICIES ====================

-- SELECT: owner can see own KPI definitions
CREATE POLICY "kpi_definitions_select_own" ON kpi_definitions
  FOR SELECT USING (auth.uid() = user_id);

-- INSERT: authenticated users can create KPI definitions
CREATE POLICY "kpi_definitions_insert_own" ON kpi_definitions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- UPDATE: owner can update own KPI definitions
CREATE POLICY "kpi_definitions_update_own" ON kpi_definitions
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- DELETE: owner can delete own KPI definitions
CREATE POLICY "kpi_definitions_delete_own" ON kpi_definitions
  FOR DELETE USING (auth.uid() = user_id);

-- ==================== KPI VALUES POLICIES ====================

-- SELECT: owner can see own KPI values
CREATE POLICY "kpi_values_select_own" ON kpi_values
  FOR SELECT USING (auth.uid() = user_id);

-- INSERT: authenticated users can create KPI values for themselves
CREATE POLICY "kpi_values_insert_own" ON kpi_values
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- UPDATE: owner can update own KPI values
CREATE POLICY "kpi_values_update_own" ON kpi_values
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- DELETE: owner can delete own KPI values
CREATE POLICY "kpi_values_delete_own" ON kpi_values
  FOR DELETE USING (auth.uid() = user_id);

-- ==================== APPROVAL REQUESTS POLICIES ====================

-- SELECT: admins can see all, users can see their own
CREATE POLICY "approval_requests_select_own" ON approval_requests
  FOR SELECT USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- INSERT: authenticated users can create approval requests
CREATE POLICY "approval_requests_insert_own" ON approval_requests
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- UPDATE: admins only can update approval requests
CREATE POLICY "approval_requests_update_admin" ON approval_requests
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- ==================== NOTIFICATIONS POLICIES ====================

-- SELECT: own notifications only
CREATE POLICY "notifications_select_own" ON notifications
  FOR SELECT USING (auth.uid() = user_id);

-- INSERT: system/authenticated can create notifications
CREATE POLICY "notifications_insert_own" ON notifications
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- UPDATE: own notifications only (mark read)
CREATE POLICY "notifications_update_own" ON notifications
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- DELETE: own notifications only
CREATE POLICY "notifications_delete_own" ON notifications
  FOR DELETE USING (auth.uid() = user_id);

-- ==================== SHARED TASKS POLICIES ====================

-- SELECT: task owner or shared_with user can see
CREATE POLICY "shared_tasks_select_own" ON shared_tasks
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM tasks
      WHERE tasks.id = shared_tasks.task_id
      AND tasks.user_id = auth.uid()
    )
    OR auth.uid() = shared_with
  );

-- INSERT: task owner can share
CREATE POLICY "shared_tasks_insert_owner" ON shared_tasks
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM tasks
      WHERE tasks.id = task_id
      AND tasks.user_id = auth.uid()
    )
    AND auth.uid() = shared_by
  );

-- DELETE: task owner or shared_with user can delete
CREATE POLICY "shared_tasks_delete_own" ON shared_tasks
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM tasks
      WHERE tasks.id = shared_tasks.task_id
      AND tasks.user_id = auth.uid()
    )
    OR auth.uid() = shared_with
  );

-- ==================== SETTINGS POLICIES ====================

-- SELECT: own settings only
CREATE POLICY "settings_select_own" ON settings
  FOR SELECT USING (auth.uid() = user_id);

-- INSERT: own settings only
CREATE POLICY "settings_insert_own" ON settings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- UPDATE: own settings only
CREATE POLICY "settings_update_own" ON settings
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- DELETE: own settings only
CREATE POLICY "settings_delete_own" ON settings
  FOR DELETE USING (auth.uid() = user_id);

-- ==================== TRIGGERS ====================

-- Function: handle_new_user
-- Creates a profile entry and approval request when a new user is created
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Create profile entry
  INSERT INTO profiles (id, name, email, created_at, updated_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.user_metadata->>'name', NEW.email),
    NEW.email,
    now(),
    now()
  )
  ON CONFLICT (id) DO NOTHING;

  -- Create approval request
  INSERT INTO approval_requests (user_id, email, name, created_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.user_metadata->>'name', NEW.email),
    now()
  )
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: on_auth_user_created
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Function: update_profiles_updated_at
CREATE OR REPLACE FUNCTION update_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: profiles_updated_at
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_profiles_updated_at();

-- Function: update_projects_updated_at
CREATE OR REPLACE FUNCTION update_projects_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: projects_updated_at
CREATE TRIGGER projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_projects_updated_at();

-- Function: update_tasks_updated_at
CREATE OR REPLACE FUNCTION update_tasks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: tasks_updated_at
CREATE TRIGGER tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION update_tasks_updated_at();

-- Function: update_kpi_definitions_updated_at
CREATE OR REPLACE FUNCTION update_kpi_definitions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: kpi_definitions_updated_at
CREATE TRIGGER kpi_definitions_updated_at
  BEFORE UPDATE ON kpi_definitions
  FOR EACH ROW EXECUTE FUNCTION update_kpi_definitions_updated_at();

-- ==================== INDEXES ====================

-- Tasks indexes
CREATE INDEX IF NOT EXISTS idx_tasks_user_id_date ON tasks(user_id, date);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_user_id_status ON tasks(user_id, status);

-- Notifications indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user_id_is_read ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id_created_at ON notifications(user_id, created_at DESC);

-- Approval requests indexes
CREATE INDEX IF NOT EXISTS idx_approval_requests_status ON approval_requests(status);
CREATE INDEX IF NOT EXISTS idx_approval_requests_user_id ON approval_requests(user_id);

-- Projects indexes
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);

-- KPI indexes
CREATE INDEX IF NOT EXISTS idx_kpi_definitions_user_id ON kpi_definitions(user_id);
CREATE INDEX IF NOT EXISTS idx_kpi_definitions_eval_year ON kpi_definitions(eval_year);
CREATE INDEX IF NOT EXISTS idx_kpi_values_user_id ON kpi_values(user_id);
CREATE INDEX IF NOT EXISTS idx_kpi_values_kpi_def_id ON kpi_values(kpi_def_id);

-- Shared tasks indexes
CREATE INDEX IF NOT EXISTS idx_shared_tasks_task_id ON shared_tasks(task_id);
CREATE INDEX IF NOT EXISTS idx_shared_tasks_shared_with ON shared_tasks(shared_with);

-- ==================== FULL-TEXT SEARCH ====================

-- Add tsvector column to tasks for full-text search
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Function to update search vector
CREATE OR REPLACE FUNCTION update_tasks_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := to_tsvector('english', COALESCE(NEW.title, '') || ' ' || COALESCE(NEW.content, '') || ' ' || COALESCE(NEW.ai_summary, ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for search vector
CREATE TRIGGER tasks_search_vector_update
  BEFORE INSERT OR UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION update_tasks_search_vector();

-- GIN index for full-text search
CREATE INDEX IF NOT EXISTS idx_tasks_search_vector ON tasks USING GIN(search_vector);

-- ==================== COMMENTS ====================

COMMENT ON TABLE profiles IS 'User profiles linked to Supabase auth.users';
COMMENT ON TABLE projects IS 'Projects owned by users';
COMMENT ON TABLE tasks IS 'Tasks managed by users, can be shared and assigned';
COMMENT ON TABLE kpi_definitions IS 'Key Performance Indicators definitions';
COMMENT ON TABLE kpi_values IS 'Recorded KPI values over time';
COMMENT ON TABLE approval_requests IS 'User registration approval requests';
COMMENT ON TABLE notifications IS 'User notifications';
COMMENT ON TABLE shared_tasks IS 'Junction table for task sharing between users';
COMMENT ON TABLE settings IS 'User-specific settings and preferences';
