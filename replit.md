# VCP Trader

## Overview

VCP Trader is a production-grade SaaS web application for active day traders focused on identifying, tracking, and alerting on Volatility Contraction Pattern (VCP) breakouts. The platform scans the US stock market to detect VCP patterns at various stages (FORMING, READY, BREAKOUT), automatically draws resistance and stop levels, and provides real-time alerts via push notifications. It's designed as a mobile-ready Progressive Web App (PWA) with direct brokerage market data connectivity.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript, built using Vite
- **Routing**: Wouter for lightweight client-side routing
- **State Management**: TanStack React Query for server state and caching
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with custom design tokens for trading UI aesthetics
- **Charts**: TradingView lightweight-charts for price/candle visualization
- **PWA Support**: Service worker and Web Push API for mobile app experience

### Backend Architecture
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript with ES modules
- **API Design**: RESTful endpoints under `/api/*` prefix
- **Database ORM**: Drizzle ORM with PostgreSQL
- **Schema Validation**: Zod for runtime type validation, drizzle-zod for schema-to-type integration
- **Build System**: Custom esbuild script for server bundling, Vite for client

### Data Storage
- **Primary Database**: PostgreSQL (configured via `DATABASE_URL` environment variable)
- **Schema Location**: `shared/schema.ts` - contains all table definitions
- **Key Tables**: users, symbols, candles, scan_results, alerts, watchlists, broker_connections, push_subscriptions
- **Migrations**: Managed via Drizzle Kit (`drizzle-kit push`)

### Project Structure
```
├── client/           # React frontend application
│   ├── src/
│   │   ├── components/   # UI components (app-specific and shadcn/ui)
│   │   ├── pages/        # Route page components
│   │   ├── hooks/        # Custom React hooks
│   │   └── lib/          # Utilities and providers
├── server/           # Express backend
│   ├── index.ts      # Server entry point
│   ├── routes.ts     # API route definitions
│   ├── storage.ts    # Data access layer interface
│   └── vite.ts       # Vite dev server integration
├── shared/           # Shared code between client and server
│   └── schema.ts     # Database schema and Zod types
```

### Key Design Patterns
- **Storage Interface Pattern**: `IStorage` interface in `storage.ts` abstracts data access, allowing swap between in-memory and database implementations
- **Path Aliases**: `@/` maps to client/src, `@shared/` maps to shared directory
- **Type Sharing**: Schema types are shared between frontend and backend via `@shared/schema`
- **API Communication**: Client uses fetch wrapper with React Query for all API calls

## Authentication & Authorization

### Email/Password Authentication (Portable)
- **Authentication**: Email/password with bcrypt hashing (works on any platform)
- **Session Storage**: PostgreSQL-backed sessions via `connect-pg-simple`
- **User Roles**: `user` (default) and `admin` roles
- **Auth Files Location**: `server/replit_integrations/auth/`
- **Client Hook**: `client/src/hooks/use-auth.ts` for React components
- **Auth Pages**: `client/src/pages/auth.tsx` - login/register forms

### Auth API Endpoints
- `POST /api/auth/register` - Create new user account
- `POST /api/auth/login` - Authenticate and create session
- `POST /api/auth/logout` - Destroy session
- `GET /api/auth/user` - Get current authenticated user

### Role-Based Access Control
- **Public Routes**: Market stats, scan results (read), chart data, alerts (read)
- **Authenticated Routes**: Push subscription, user profile
- **Admin-Only Routes**: Scan run, alerts CRUD, watchlists CRUD, broker connections, backtest

### Deployment Requirements
- `SESSION_SECRET` environment variable required
- `DATABASE_URL` environment variable for PostgreSQL connection
- `LEGAL_VERSION` environment variable (e.g., "2026-01-01") for legal acceptance tracking
- `SUPPORT_EMAIL` environment variable for legal page contact info

### Railway Deployment
- **Configuration File**: `railway.json` contains build and deploy settings
- **Build Command**: `npm run build && npm run db:push` (runs migrations automatically)
- **Start Command**: `npm run start`
- **Database**: Automatically pushes schema changes to PostgreSQL on each deploy
- **Environment Variables Required on Railway**:
  - `DATABASE_URL` - PostgreSQL connection string
  - `SESSION_SECRET` - Random secret for session encryption
  - `LEGAL_VERSION` - Current legal policy version date
  - `SUPPORT_EMAIL` - Support contact email

## External Dependencies

### Database
- **PostgreSQL**: Primary data store, connection via `DATABASE_URL` environment variable

### Stripe Integration (TODO)
- **Status**: Pending - user will provide API keys later
- **Purpose**: Subscription-based access to trade signals
- **Required Keys**: `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`

### Brokerage Integrations (Planned)
The app is designed to connect to multiple brokerage providers for market data:
- Tradier (commission-free trading)
- Alpaca (API-first stock trading)
- Interactive Brokers (professional trading)
- Charles Schwab (full-service)
- Polygon.io (market data only)

### Push Notifications
- Web Push API with VAPID keys for real-time alert delivery

### UI Dependencies
- Radix UI primitives for accessible components
- TradingView lightweight-charts for financial charting
- Lucide React for icons

### Key NPM Packages
- `drizzle-orm` / `drizzle-kit`: Database ORM and migrations
- `@tanstack/react-query`: Server state management
- `lightweight-charts`: TradingView charting library
- `web-push`: Push notification delivery
- `node-cron`: Scheduled scanner jobs
- `zod`: Schema validation