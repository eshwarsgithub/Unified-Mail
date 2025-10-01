-- Unified Mail Platform - Initial Schema
-- Version: 1.0.0

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Analysts (Support Team Members)
CREATE TABLE analysts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),
  role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'analyst', 'viewer')),
  password_hash VARCHAR(255),
  is_active BOOLEAN DEFAULT true,
  last_login_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_analysts_email ON analysts(email);
CREATE INDEX idx_analysts_role ON analysts(role);

-- Mail Accounts (Provider accounts to sync from)
CREATE TABLE accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider VARCHAR(50) NOT NULL CHECK (provider IN ('gmail', 'office365', 'imap', 'protonmail', 'smtp')),
  email VARCHAR(255) NOT NULL,
  display_name VARCHAR(255),
  vault_path VARCHAR(255) NOT NULL,
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'auth_failed', 'disabled', 'syncing')),
  last_sync_at TIMESTAMP,
  last_sync_error TEXT,
  sync_cursor VARCHAR(500),
  settings JSONB DEFAULT '{}',
  created_by UUID REFERENCES analysts(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(provider, email)
);

CREATE INDEX idx_accounts_status ON accounts(status);
CREATE INDEX idx_accounts_provider ON accounts(provider);
CREATE INDEX idx_accounts_last_sync ON accounts(last_sync_at);

-- Threads (Email conversation threads)
CREATE TABLE threads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subject_normalized VARCHAR(255) NOT NULL,
  first_message_date TIMESTAMP NOT NULL,
  last_message_date TIMESTAMP NOT NULL,
  message_count INT DEFAULT 1,
  participants TEXT[],
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_threads_subject ON threads(subject_normalized);
CREATE INDEX idx_threads_last_message ON threads(last_message_date DESC);

-- Messages (Email messages)
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  message_id VARCHAR(998) NOT NULL,
  thread_id UUID REFERENCES threads(id),
  folder VARCHAR(255) DEFAULT 'INBOX',
  subject TEXT,
  from_email VARCHAR(255),
  from_name VARCHAR(255),
  to_emails TEXT[],
  cc_emails TEXT[],
  bcc_emails TEXT[],
  date TIMESTAMP,
  has_attachments BOOLEAN DEFAULT FALSE,
  is_read BOOLEAN DEFAULT FALSE,
  is_starred BOOLEAN DEFAULT FALSE,
  is_spam BOOLEAN DEFAULT FALSE,
  labels TEXT[],
  s3_key VARCHAR(500),
  body_preview TEXT,
  body_text_preview TEXT,
  spam_score REAL,
  headers JSONB,
  in_reply_to VARCHAR(998),
  references TEXT[],
  size_bytes BIGINT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(account_id, message_id)
);

CREATE INDEX idx_messages_account_date ON messages(account_id, date DESC);
CREATE INDEX idx_messages_thread ON messages(thread_id);
CREATE INDEX idx_messages_folder ON messages(folder);
CREATE INDEX idx_messages_from ON messages(from_email);
CREATE INDEX idx_messages_date ON messages(date DESC);
CREATE INDEX idx_messages_is_read ON messages(is_read);
CREATE INDEX idx_messages_labels ON messages USING gin(labels);

-- Attachments
CREATE TABLE attachments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  filename VARCHAR(255),
  content_type VARCHAR(100),
  size_bytes BIGINT,
  s3_key VARCHAR(500),
  checksum VARCHAR(64),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_attachments_message ON attachments(message_id);
CREATE INDEX idx_attachments_content_type ON attachments(content_type);

-- Account Permissions (RBAC)
CREATE TABLE account_permissions (
  analyst_id UUID REFERENCES analysts(id) ON DELETE CASCADE,
  account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
  permission VARCHAR(50) NOT NULL CHECK (permission IN ('read', 'write', 'admin')),
  granted_by UUID REFERENCES analysts(id),
  created_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (analyst_id, account_id)
);

CREATE INDEX idx_account_permissions_analyst ON account_permissions(analyst_id);
CREATE INDEX idx_account_permissions_account ON account_permissions(account_id);

-- Audit Logs
CREATE TABLE audit_logs (
  id BIGSERIAL PRIMARY KEY,
  analyst_id UUID REFERENCES analysts(id),
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(50),
  resource_id UUID,
  details JSONB,
  ip_address INET,
  user_agent TEXT,
  timestamp TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp DESC);
CREATE INDEX idx_audit_logs_analyst ON audit_logs(analyst_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id);

-- Sync Jobs (Track sync operations)
CREATE TABLE sync_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  messages_synced INT DEFAULT 0,
  error_message TEXT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_sync_jobs_account ON sync_jobs(account_id);
CREATE INDEX idx_sync_jobs_status ON sync_jobs(status);
CREATE INDEX idx_sync_jobs_created ON sync_jobs(created_at DESC);

-- Outbound Messages (Sent/Reply queue)
CREATE TABLE outbound_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  analyst_id UUID NOT NULL REFERENCES analysts(id),
  in_reply_to UUID REFERENCES messages(id),
  to_emails TEXT[] NOT NULL,
  cc_emails TEXT[],
  bcc_emails TEXT[],
  subject TEXT NOT NULL,
  body_text TEXT,
  body_html TEXT,
  attachments JSONB,
  status VARCHAR(50) DEFAULT 'queued' CHECK (status IN ('queued', 'sending', 'sent', 'failed')),
  sent_at TIMESTAMP,
  error_message TEXT,
  provider_message_id VARCHAR(998),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_outbound_messages_status ON outbound_messages(status);
CREATE INDEX idx_outbound_messages_account ON outbound_messages(account_id);
CREATE INDEX idx_outbound_messages_created ON outbound_messages(created_at DESC);

-- API Tokens (For API access)
CREATE TABLE api_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  analyst_id UUID NOT NULL REFERENCES analysts(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL,
  name VARCHAR(100),
  scopes TEXT[],
  last_used_at TIMESTAMP,
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_api_tokens_analyst ON api_tokens(analyst_id);
CREATE INDEX idx_api_tokens_expires ON api_tokens(expires_at);

-- Functions and Triggers

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_analysts_updated_at BEFORE UPDATE ON analysts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_accounts_updated_at BEFORE UPDATE ON accounts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_threads_updated_at BEFORE UPDATE ON threads
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_messages_updated_at BEFORE UPDATE ON messages
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Thread participant aggregation
CREATE OR REPLACE FUNCTION update_thread_participants()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE threads SET
        participants = (
            SELECT ARRAY_AGG(DISTINCT email)
            FROM (
                SELECT UNNEST(to_emails || cc_emails || ARRAY[from_email]) AS email
                FROM messages
                WHERE thread_id = NEW.thread_id
            ) AS all_emails
        ),
        message_count = (
            SELECT COUNT(*) FROM messages WHERE thread_id = NEW.thread_id
        ),
        last_message_date = (
            SELECT MAX(date) FROM messages WHERE thread_id = NEW.thread_id
        )
    WHERE id = NEW.thread_id;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_thread_after_message AFTER INSERT OR UPDATE ON messages
    FOR EACH ROW EXECUTE FUNCTION update_thread_participants();

-- Insert default admin user (password: admin123 - CHANGE IN PRODUCTION)
INSERT INTO analysts (email, name, role, password_hash)
VALUES (
    'admin@unified-mail.local',
    'System Administrator',
    'admin',
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5ux7eLBxQQdlu'
);

-- Create indexes for performance
CREATE INDEX idx_messages_search ON messages USING gin(to_tsvector('english', coalesce(subject, '') || ' ' || coalesce(body_text_preview, '')));
