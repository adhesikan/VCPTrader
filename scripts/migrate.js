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
