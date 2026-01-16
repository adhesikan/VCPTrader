import pg from 'pg';

const { Pool } = pg;

async function migrate() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  console.log('Connecting to database...');
  
  try {
    const client = await pool.connect();
    console.log('Connected. Running migrations...');

    // Add encrypted credential columns to broker_connections
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'broker_connections' AND column_name = 'encrypted_credentials'
        ) THEN
          ALTER TABLE broker_connections ADD COLUMN encrypted_credentials TEXT;
          RAISE NOTICE 'Added encrypted_credentials column';
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'broker_connections' AND column_name = 'credentials_iv'
        ) THEN
          ALTER TABLE broker_connections ADD COLUMN credentials_iv TEXT;
          RAISE NOTICE 'Added credentials_iv column';
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'broker_connections' AND column_name = 'credentials_auth_tag'
        ) THEN
          ALTER TABLE broker_connections ADD COLUMN credentials_auth_tag TEXT;
          RAISE NOTICE 'Added credentials_auth_tag column';
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'broker_connections' AND column_name = 'access_token_expires_at'
        ) THEN
          ALTER TABLE broker_connections ADD COLUMN access_token_expires_at TIMESTAMP;
          RAISE NOTICE 'Added access_token_expires_at column';
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'broker_connections' AND column_name = 'created_at'
        ) THEN
          ALTER TABLE broker_connections ADD COLUMN created_at TIMESTAMP DEFAULT NOW();
          RAISE NOTICE 'Added created_at column';
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'broker_connections' AND column_name = 'updated_at'
        ) THEN
          ALTER TABLE broker_connections ADD COLUMN updated_at TIMESTAMP DEFAULT NOW();
          RAISE NOTICE 'Added updated_at column';
        END IF;
      END $$;
    `);

    // Add user_id column to watchlists table
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'watchlists' AND column_name = 'user_id'
        ) THEN
          ALTER TABLE watchlists ADD COLUMN user_id VARCHAR;
          RAISE NOTICE 'Added user_id column to watchlists';
        END IF;
      END $$;
    `);

    // Create opportunity_defaults table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS opportunity_defaults (
        user_id VARCHAR PRIMARY KEY,
        default_mode TEXT NOT NULL DEFAULT 'single',
        default_strategy_id TEXT NOT NULL DEFAULT 'VCP',
        default_scan_scope TEXT NOT NULL DEFAULT 'watchlist',
        default_watchlist_id TEXT,
        default_symbol TEXT,
        default_market_index TEXT,
        default_filter_preset TEXT NOT NULL DEFAULT 'balanced',
        auto_run_on_load BOOLEAN DEFAULT false,
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('Created/verified opportunity_defaults table');

    // Create user_settings table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_settings (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::VARCHAR,
        user_id VARCHAR NOT NULL,
        show_tooltips VARCHAR NOT NULL DEFAULT 'true',
        push_notifications_enabled VARCHAR NOT NULL DEFAULT 'false',
        breakout_alerts_enabled VARCHAR NOT NULL DEFAULT 'true',
        stop_alerts_enabled VARCHAR NOT NULL DEFAULT 'true',
        ema_alerts_enabled VARCHAR NOT NULL DEFAULT 'true',
        approaching_alerts_enabled VARCHAR NOT NULL DEFAULT 'true',
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('Created/verified user_settings table');

    // Add tutorial tracking columns to user_settings
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'user_settings' AND column_name = 'has_seen_welcome_tutorial'
        ) THEN
          ALTER TABLE user_settings ADD COLUMN has_seen_welcome_tutorial VARCHAR NOT NULL DEFAULT 'false';
          RAISE NOTICE 'Added has_seen_welcome_tutorial column';
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'user_settings' AND column_name = 'has_seen_scanner_tutorial'
        ) THEN
          ALTER TABLE user_settings ADD COLUMN has_seen_scanner_tutorial VARCHAR NOT NULL DEFAULT 'false';
          RAISE NOTICE 'Added has_seen_scanner_tutorial column';
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'user_settings' AND column_name = 'has_seen_vcp_tutorial'
        ) THEN
          ALTER TABLE user_settings ADD COLUMN has_seen_vcp_tutorial VARCHAR NOT NULL DEFAULT 'false';
          RAISE NOTICE 'Added has_seen_vcp_tutorial column';
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'user_settings' AND column_name = 'has_seen_alerts_tutorial'
        ) THEN
          ALTER TABLE user_settings ADD COLUMN has_seen_alerts_tutorial VARCHAR NOT NULL DEFAULT 'false';
          RAISE NOTICE 'Added has_seen_alerts_tutorial column';
        END IF;
      END $$;
    `);
    console.log('Added/verified tutorial tracking columns');

    // Set all existing users to have seen tutorials (so they don't get popups after migration)
    const updateResult = await client.query(`
      UPDATE user_settings 
      SET has_seen_welcome_tutorial = 'true',
          has_seen_scanner_tutorial = 'true',
          has_seen_vcp_tutorial = 'true',
          has_seen_alerts_tutorial = 'true'
      WHERE has_seen_welcome_tutorial = 'false'
    `);
    console.log(`Marked ${updateResult.rowCount} existing users as having seen tutorials`);

    // Create automation_endpoints table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS automation_endpoints (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::VARCHAR,
        user_id VARCHAR NOT NULL,
        name TEXT NOT NULL,
        webhook_url TEXT NOT NULL,
        webhook_secret_encrypted TEXT,
        webhook_secret_iv TEXT,
        webhook_secret_auth_tag TEXT,
        is_active BOOLEAN DEFAULT true,
        last_tested_at TIMESTAMP,
        last_test_success BOOLEAN,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('Created/verified automation_endpoints table');

    // Create trades table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS trades (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::VARCHAR,
        user_id VARCHAR NOT NULL,
        symbol TEXT NOT NULL,
        strategy_id TEXT NOT NULL,
        endpoint_id VARCHAR,
        entry_execution_id VARCHAR,
        exit_execution_id VARCHAR,
        side TEXT NOT NULL DEFAULT 'LONG',
        status TEXT NOT NULL DEFAULT 'OPEN',
        entry_price REAL,
        exit_price REAL,
        quantity REAL,
        stop_loss REAL,
        target REAL,
        pnl REAL,
        pnl_percent REAL,
        setup_payload JSONB,
        entry_timestamp TIMESTAMP DEFAULT NOW(),
        exit_timestamp TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('Created/verified trades table');

    // Create execution_requests table if it doesn't exist (matches Drizzle schema)
    await client.query(`
      CREATE TABLE IF NOT EXISTS execution_requests (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::VARCHAR,
        user_id VARCHAR NOT NULL,
        symbol TEXT NOT NULL,
        strategy_id TEXT NOT NULL,
        timeframe TEXT,
        setup_payload JSONB,
        automation_profile_id VARCHAR,
        status TEXT NOT NULL DEFAULT 'CREATED',
        algo_pilotx_reference TEXT,
        redirect_url TEXT,
        error_message TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('Created/verified execution_requests table');

    // Add missing columns to execution_requests table
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'execution_requests' AND column_name = 'timeframe'
        ) THEN
          ALTER TABLE execution_requests ADD COLUMN timeframe TEXT;
          RAISE NOTICE 'Added timeframe column to execution_requests';
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'execution_requests' AND column_name = 'setup_payload'
        ) THEN
          ALTER TABLE execution_requests ADD COLUMN setup_payload JSONB;
          RAISE NOTICE 'Added setup_payload column to execution_requests';
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'execution_requests' AND column_name = 'automation_profile_id'
        ) THEN
          ALTER TABLE execution_requests ADD COLUMN automation_profile_id VARCHAR;
          RAISE NOTICE 'Added automation_profile_id column to execution_requests';
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'execution_requests' AND column_name = 'algo_pilotx_reference'
        ) THEN
          ALTER TABLE execution_requests ADD COLUMN algo_pilotx_reference TEXT;
          RAISE NOTICE 'Added algo_pilotx_reference column to execution_requests';
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'execution_requests' AND column_name = 'redirect_url'
        ) THEN
          ALTER TABLE execution_requests ADD COLUMN redirect_url TEXT;
          RAISE NOTICE 'Added redirect_url column to execution_requests';
        END IF;
      END $$;
    `);
    console.log('Verified all columns exist in execution_requests');

    // Add missing columns to alert_rules table
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'alert_rules' AND column_name = 'is_global'
        ) THEN
          ALTER TABLE alert_rules ADD COLUMN is_global BOOLEAN DEFAULT false;
          RAISE NOTICE 'Added is_global column to alert_rules';
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'alert_rules' AND column_name = 'send_push_notification'
        ) THEN
          ALTER TABLE alert_rules ADD COLUMN send_push_notification BOOLEAN DEFAULT true;
          RAISE NOTICE 'Added send_push_notification column to alert_rules';
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'alert_rules' AND column_name = 'send_webhook'
        ) THEN
          ALTER TABLE alert_rules ADD COLUMN send_webhook BOOLEAN DEFAULT false;
          RAISE NOTICE 'Added send_webhook column to alert_rules';
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'alert_rules' AND column_name = 'triggered_symbols'
        ) THEN
          ALTER TABLE alert_rules ADD COLUMN triggered_symbols TEXT[];
          RAISE NOTICE 'Added triggered_symbols column to alert_rules';
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'alert_rules' AND column_name = 'scan_interval'
        ) THEN
          ALTER TABLE alert_rules ADD COLUMN scan_interval TEXT;
          RAISE NOTICE 'Added scan_interval column to alert_rules';
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'alert_rules' AND column_name = 'strategies'
        ) THEN
          ALTER TABLE alert_rules ADD COLUMN strategies TEXT[];
          RAISE NOTICE 'Added strategies column to alert_rules';
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'alert_rules' AND column_name = 'score_threshold'
        ) THEN
          ALTER TABLE alert_rules ADD COLUMN score_threshold INTEGER;
          RAISE NOTICE 'Added score_threshold column to alert_rules';
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'alert_rules' AND column_name = 'min_strategies'
        ) THEN
          ALTER TABLE alert_rules ADD COLUMN min_strategies INTEGER;
          RAISE NOTICE 'Added min_strategies column to alert_rules';
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'alert_rules' AND column_name = 'automation_endpoint_id'
        ) THEN
          ALTER TABLE alert_rules ADD COLUMN automation_endpoint_id VARCHAR;
          RAISE NOTICE 'Added automation_endpoint_id column to alert_rules';
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'alert_rules' AND column_name = 'watchlist_id'
        ) THEN
          ALTER TABLE alert_rules ADD COLUMN watchlist_id VARCHAR;
          RAISE NOTICE 'Added watchlist_id column to alert_rules';
        END IF;
      END $$;
    `);
    console.log('Verified all columns exist in alert_rules');

    console.log('Migrations complete!');
    client.release();
  } catch (error) {
    console.error('Migration failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
