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

    // Add encrypted credential columns
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
