-- ExamScan Database Schema
-- Simplified schema with essential tables only

-- ============================================
-- USERS TABLE
-- ============================================
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    password_hash VARCHAR(255), -- For future password support
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Constraints
    CONSTRAINT valid_username CHECK (length(username) >= 3 AND length(username) <= 50),
    CONSTRAINT valid_email CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

-- Indexes
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_active ON users(is_active);

-- ============================================
-- OTP TOKENS TABLE
-- ============================================
CREATE TABLE otps (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    otp_code VARCHAR(6) NOT NULL,
    otp_type VARCHAR(20) DEFAULT 'login' CHECK (otp_type IN ('login', 'registration', 'reset')),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    is_used BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Constraints
    CONSTRAINT valid_otp_code CHECK (length(otp_code) = 6 AND otp_code ~ '^[0-9]{6}$')
);

-- Indexes
CREATE INDEX idx_otps_email ON otps(email);
CREATE INDEX idx_otps_expires_at ON otps(expires_at);
CREATE UNIQUE INDEX idx_otps_active ON otps(email, otp_type)
WHERE is_used = false AND expires_at > CURRENT_TIMESTAMP;

-- ============================================
-- EXAMS TABLE
-- ============================================
CREATE TABLE exams (
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
    CONSTRAINT valid_question_types CHECK (jsonb_array_length(question_types) > 0)
);

-- Indexes
CREATE INDEX idx_exams_user_id ON exams(user_id);
CREATE INDEX idx_exams_status ON exams(status);
CREATE INDEX idx_exams_created_at ON exams(created_at DESC);

-- ============================================
-- ANSWERS TABLE (scanned results)
-- ============================================
CREATE TABLE answers (
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
CREATE INDEX idx_answers_exam_id ON answers(exam_id);
CREATE INDEX idx_answers_user_id ON answers(user_id);
CREATE INDEX idx_answers_scanned_at ON answers(scanned_at DESC);
CREATE INDEX idx_answers_score ON answers(score_percentage);

-- ============================================
-- USAGE STATISTICS TABLE
-- ============================================
CREATE TABLE usage_stats (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    action_type VARCHAR(50) NOT NULL, -- 'exam_created', 'scan_processed', 'login', etc.
    metadata JSONB, -- Additional data like exam_id, scan_count, etc.
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_usage_stats_user_id ON usage_stats(user_id);
CREATE INDEX idx_usage_stats_action_type ON usage_stats(action_type);
CREATE INDEX idx_usage_stats_created_at ON usage_stats(created_at DESC);

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

-- Apply update triggers
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_exams_updated_at
    BEFORE UPDATE ON exams
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- CLEANUP FUNCTIONS
-- ============================================
CREATE OR REPLACE FUNCTION cleanup_expired_otps()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM otps
    WHERE expires_at < CURRENT_TIMESTAMP
       OR (is_used = true AND created_at < CURRENT_TIMESTAMP - INTERVAL '24 hours');

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- INITIAL TEST DATA
-- ============================================
-- Test user
INSERT INTO users (username, email, first_name, last_name)
VALUES ('testuser', 'test@example.com', 'Test', 'User')
ON CONFLICT (username) DO NOTHING;

-- Test exam
INSERT INTO exams (user_id, title, description, total_questions, test_structure, answer_key)
SELECT
    u.id,
    'Sample Math Quiz',
    'Basic algebra questions',
    5,
    '[{"type": "mc", "count": 2}, {"type": "tf", "count": 2}, {"type": "mc", "count": 1}]'::jsonb,
    '{"1": "A", "2": "B", "3": "T", "4": "F", "5": "C"}'::jsonb
FROM users u
WHERE u.username = 'testuser'
ON CONFLICT DO NOTHING;

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON TABLE users IS 'ExamScan user accounts';
COMMENT ON TABLE otps IS 'One-time password tokens for authentication';
COMMENT ON TABLE exams IS 'Exam definitions with questions and answer keys';
COMMENT ON TABLE answers IS 'Scanned answer sheet results';
COMMENT ON TABLE usage_stats IS 'User activity tracking for analytics';

COMMENT ON COLUMN exams.test_structure IS 'JSON array defining test sections: [{"type": "mc|tf", "count": 10}, ...]';
COMMENT ON COLUMN exams.answer_key IS 'JSON object with question numbers as keys and answers as values: {"1": "A", "2": "T"}';
COMMENT ON COLUMN exams.student_info IS 'JSON object defining which student information fields to include: {"name": true, "last_name": true, "nickname": false, "class": true}';

-- ============================================
-- END OF SCHEMA
-- ============================================
