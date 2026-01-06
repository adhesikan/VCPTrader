-- Add encrypted credential columns to broker_connections table
-- This script is idempotent - safe to run multiple times

DO $$
BEGIN
    -- Add encrypted_credentials column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'broker_connections' AND column_name = 'encrypted_credentials'
    ) THEN
        ALTER TABLE broker_connections ADD COLUMN encrypted_credentials TEXT;
    END IF;

    -- Add credentials_iv column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'broker_connections' AND column_name = 'credentials_iv'
    ) THEN
        ALTER TABLE broker_connections ADD COLUMN credentials_iv TEXT;
    END IF;

    -- Add credentials_auth_tag column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'broker_connections' AND column_name = 'credentials_auth_tag'
    ) THEN
        ALTER TABLE broker_connections ADD COLUMN credentials_auth_tag TEXT;
    END IF;

    -- Add access_token_expires_at column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'broker_connections' AND column_name = 'access_token_expires_at'
    ) THEN
        ALTER TABLE broker_connections ADD COLUMN access_token_expires_at TIMESTAMP;
    END IF;

    -- Add created_at column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'broker_connections' AND column_name = 'created_at'
    ) THEN
        ALTER TABLE broker_connections ADD COLUMN created_at TIMESTAMP DEFAULT NOW();
    END IF;

    -- Add updated_at column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'broker_connections' AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE broker_connections ADD COLUMN updated_at TIMESTAMP DEFAULT NOW();
    END IF;
END $$;
