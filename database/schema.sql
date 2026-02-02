-- ExamScan Database Schema (merged: base schema + security updates)
-- This file creates a fresh database with all auth & security features.
-- 
-- IDEMPOTENT: This schema uses IF NOT EXISTS and can be safely run on existing databases.
-- It will create missing tables/columns/indexes without errors if they already exist.

-- ============================================
-- USERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    password_hash VARCHAR(255), -- Bcrypt hash
    role VARCHAR(50) DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    email_verified BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT true,
    session_revoked_at TIMESTAMP WITH TIME ZONE,
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Constraints
    CONSTRAINT valid_username CHECK (length(username) >= 3 AND length(username) <= 50),
    CONSTRAINT valid_email CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- ============================================
-- EXAMS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS exams (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    total_questions INTEGER NOT NULL CHECK (total_questions > 0 AND total_questions <= 200),
    test_structure JSONB NOT NULL, -- [{"type": "mc", "count": 10}, {"type": "tf", "count": 5}, {"type": "mc", "count": 3}]
    answer_key JSONB NOT NULL, -- {"1": "A", "2": "T", "3": "B", ...}
    student_info JSONB DEFAULT '{"name": true, "last_name": true, "nickname": false, "class": true}', -- Which student info fields to include
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Constraints
    CONSTRAINT valid_exam_title CHECK (length(trim(title)) > 0),
    CONSTRAINT valid_test_structure CHECK (jsonb_array_length(test_structure) > 0)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_exams_user_id ON exams(user_id);
CREATE INDEX IF NOT EXISTS idx_exams_status ON exams(status);
CREATE INDEX IF NOT EXISTS idx_exams_created_at ON exams(created_at DESC);

-- ============================================
-- ANSWERS TABLE (scanned results)
-- ============================================
CREATE TABLE IF NOT EXISTS answers (
    id SERIAL PRIMARY KEY,
    exam_id INTEGER REFERENCES exams(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    student_name VARCHAR(255),
    student_id VARCHAR(100),
    answers JSONB NOT NULL, -- {"1": "A", "2": "T", "3": "B", ...}
    score_percentage DECIMAL(5,2),
    correct_answers INTEGER,
    total_questions INTEGER,
    processing_time_ms INTEGER,
    scanned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Constraints
    CONSTRAINT valid_score CHECK (score_percentage >= 0 AND score_percentage <= 100),
    CONSTRAINT valid_correct_answers CHECK (correct_answers >= 0),
    CONSTRAINT valid_total_questions CHECK (total_questions > 0)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_answers_exam_id ON answers(exam_id);
CREATE INDEX IF NOT EXISTS idx_answers_user_id ON answers(user_id);
CREATE INDEX IF NOT EXISTS idx_answers_scanned_at ON answers(scanned_at DESC);
CREATE INDEX IF NOT EXISTS idx_answers_score ON answers(score_percentage);

-- ============================================
-- USAGE STATISTICS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS usage_stats (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    action_type VARCHAR(50) NOT NULL, -- 'exam_created', 'scan_processed', 'login', etc.
    metadata JSONB, -- Additional data like exam_id, scan_count, etc.
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_usage_stats_user_id ON usage_stats(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_stats_action_type ON usage_stats(action_type);
CREATE INDEX IF NOT EXISTS idx_usage_stats_created_at ON usage_stats(created_at DESC);

-- ============================================
-- TRIGGERS
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply update triggers (DROP IF EXISTS to allow re-running)
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_exams_updated_at ON exams;
CREATE TRIGGER update_exams_updated_at
    BEFORE UPDATE ON exams
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- OTP VERIFICATIONS TABLE (secure OTP storage)
-- ============================================
CREATE TABLE IF NOT EXISTS otp_verifications (
    id SERIAL PRIMARY KEY,
    identifier VARCHAR(255) NOT NULL,        -- email or user_id
    otp_hash VARCHAR(255) NOT NULL,          -- HMAC-SHA256 hash of OTP
    otp_salt VARCHAR(64) NOT NULL,           -- Salt used for hashing
    purpose VARCHAR(50) NOT NULL,            -- 'email_verification', 'login', 'password_reset'
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    attempts INTEGER DEFAULT 0 NOT NULL,
    max_attempts INTEGER DEFAULT 5 NOT NULL,
    used BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    used_at TIMESTAMP WITH TIME ZONE,

    -- Constraints
    CONSTRAINT chk_attempts CHECK (attempts <= max_attempts),
    CONSTRAINT chk_expires_at CHECK (expires_at > created_at),
    CONSTRAINT chk_used_at CHECK (used_at IS NULL OR used = TRUE)
);

-- Indexes for otp_verifications
CREATE INDEX IF NOT EXISTS idx_otp_verifications_identifier ON otp_verifications(identifier);
CREATE INDEX IF NOT EXISTS idx_otp_verifications_purpose ON otp_verifications(purpose);
CREATE INDEX IF NOT EXISTS idx_otp_verifications_expires_at ON otp_verifications(expires_at);
CREATE INDEX IF NOT EXISTS idx_otp_verifications_used ON otp_verifications(used);
CREATE INDEX IF NOT EXISTS idx_otp_verifications_identifier_purpose 
  ON otp_verifications(identifier, purpose, used, expires_at);

-- ============================================
-- USER SESSIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS user_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_token TEXT NOT NULL,           -- JWT session token
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for user_sessions
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON user_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(session_token);

-- ============================================
-- CLEANUP FUNCTIONS
-- ============================================
CREATE OR REPLACE FUNCTION cleanup_expired_otps()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM otp_verifications
    WHERE expires_at < CURRENT_TIMESTAMP
       OR (used = TRUE AND created_at < CURRENT_TIMESTAMP - INTERVAL '24 hours');

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- NO TEST DATA INCLUDED
-- ============================================
-- Production database should start empty
-- Users and exams will be created through the application

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON TABLE users IS 'ExamScan user accounts';
COMMENT ON TABLE otp_verifications IS 'Secure OTP storage with hashed codes';
COMMENT ON TABLE user_sessions IS 'User session tokens for authentication';
COMMENT ON TABLE exams IS 'Exam definitions with questions and answer keys';
COMMENT ON TABLE answers IS 'Scanned answer sheet results';
COMMENT ON TABLE usage_stats IS 'User activity tracking for analytics';

COMMENT ON COLUMN exams.test_structure IS 'JSON array defining test sections: [{\"type\": \"mc|tf\", \"count\": 10}, ...]';
COMMENT ON COLUMN exams.answer_key IS 'JSON object with question numbers as keys and answers as values: {\"1\": \"A\", \"2\": \"T\"}';
COMMENT ON COLUMN exams.student_info IS 'JSON object defining which student information fields to include: {\"name\": true, \"last_name\": true, \"nickname\": false, \"class\": true}';

-- ============================================
-- END OF SCHEMA
-- ============================================
