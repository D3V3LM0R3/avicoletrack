-- 021_chat_system.sql
-- Create conversations table for group chats
CREATE TABLE IF NOT EXISTS conversations (
    id BIGSERIAL PRIMARY KEY,
    enterprise_id BIGINT NOT NULL,
    farm_id BIGINT,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    conversation_type VARCHAR(30) NOT NULL,
    created_by BIGINT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT conversations_enterprise_fk
        FOREIGN KEY (enterprise_id)
        REFERENCES enterprises(id) ON DELETE CASCADE,
    
    CONSTRAINT conversations_farm_fk
        FOREIGN KEY (farm_id)
        REFERENCES farms(id) ON DELETE CASCADE,
    
    CONSTRAINT conversations_creator_fk
        FOREIGN KEY (created_by)
        REFERENCES users(id) ON DELETE SET NULL,
    
    CONSTRAINT conversations_type_check
        CHECK (conversation_type IN ('DIRECT', 'GROUP', 'FARM', 'ENTERPRISE'))
);

CREATE INDEX IF NOT EXISTS idx_conversations_enterprise
    ON conversations(enterprise_id);

CREATE INDEX IF NOT EXISTS idx_conversations_farm
    ON conversations(farm_id);

CREATE INDEX IF NOT EXISTS idx_conversations_created
    ON conversations(created_at DESC);

-- Create conversation members table
CREATE TABLE IF NOT EXISTS conversation_members (
    id BIGSERIAL PRIMARY KEY,
    conversation_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    joined_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_read_at TIMESTAMP,

    CONSTRAINT conversation_members_conversation_fk
        FOREIGN KEY (conversation_id)
        REFERENCES conversations(id) ON DELETE CASCADE,
    
    CONSTRAINT conversation_members_user_fk
        FOREIGN KEY (user_id)
        REFERENCES users(id) ON DELETE CASCADE,
    
    CONSTRAINT conversation_members_unique
        UNIQUE (conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_conversation_members_conversation
    ON conversation_members(conversation_id);

CREATE INDEX IF NOT EXISTS idx_conversation_members_user
    ON conversation_members(user_id);

-- Create messages table
CREATE TABLE IF NOT EXISTS messages (
    id BIGSERIAL PRIMARY KEY,
    conversation_id BIGINT NOT NULL,
    sender_id BIGINT NOT NULL,
    content TEXT NOT NULL,
    message_type VARCHAR(20) NOT NULL DEFAULT 'TEXT',
    read_at TIMESTAMP,
    deleted_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT messages_conversation_fk
        FOREIGN KEY (conversation_id)
        REFERENCES conversations(id) ON DELETE CASCADE,
    
    CONSTRAINT messages_sender_fk
        FOREIGN KEY (sender_id)
        REFERENCES users(id) ON DELETE SET NULL,
    
    CONSTRAINT messages_type_check
        CHECK (message_type IN ('TEXT', 'ALERT', 'NOTIFICATION', 'SYSTEM'))
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation
    ON messages(conversation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_sender
    ON messages(sender_id);

CREATE INDEX IF NOT EXISTS idx_messages_read
    ON messages(conversation_id, read_at);

CREATE INDEX IF NOT EXISTS idx_messages_created
    ON messages(created_at DESC);
