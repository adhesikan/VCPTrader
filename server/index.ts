import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { db } from "./db";
import { brokerConnections } from "@shared/schema";
import { eq, sql } from "drizzle-orm";
import { configurePushService } from "./push-service";

// Run inline migrations on startup (more reliable than separate script)
async function runStartupMigrations() {
  try {
    log("Running startup migrations...", "migrations");
    
    // Add missing columns to alert_rules table
    await db.execute(sql`
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
    
    log("Startup migrations completed successfully", "migrations");
  } catch (error) {
    log(`Startup migrations error (non-fatal): ${error}`, "migrations");
  }
}

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

async function restoreBrokerConnections() {
  try {
    const connections = await db
      .select()
      .from(brokerConnections)
      .where(eq(brokerConnections.isConnected, true));
    
    if (connections.length > 0) {
      log(`Restored ${connections.length} broker connection(s) from database`);
      
      for (const conn of connections) {
        if (conn.accessTokenExpiresAt && conn.accessTokenExpiresAt < new Date()) {
          log(`Broker connection for user ${conn.userId} has expired token - will need re-authentication`);
          await db
            .update(brokerConnections)
            .set({ isConnected: false, updatedAt: new Date() })
            .where(eq(brokerConnections.id, conn.id));
        }
      }
    } else {
      log("No active broker connections found in database");
    }
  } catch (error) {
    log(`Error restoring broker connections: ${error}`);
  }
}

(async () => {
  // Run migrations first to ensure schema is up to date
  await runStartupMigrations();
  
  configurePushService();
  await restoreBrokerConnections();
  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
    },
  );
})();
