# VCP Trader - Design Guidelines

## Design Approach
**System**: Material Design adapted for financial/trading applications
**References**: TradingView, Bloomberg Terminal, Interactive Brokers
**Principles**: Data clarity, scan speed, professional trading aesthetics, information density without clutter

## Typography System

**Font Stack**: 
- Primary: 'Inter' or 'Roboto' (via Google Fonts)
- Monospace: 'Roboto Mono' for prices, percentages, and data tables

**Hierarchy**:
- App Title/Headers: text-2xl to text-3xl, font-semibold
- Section Headers: text-lg to text-xl, font-medium
- Data Labels: text-sm, font-medium, uppercase tracking-wide
- Primary Data (prices/alerts): text-base to text-lg, font-mono
- Secondary Info: text-sm, font-normal
- Table Data: text-sm, font-mono

## Layout System

**Spacing Units**: Use Tailwind units of 1, 2, 4, 6, 8, 12, 16 (e.g., p-4, gap-6, space-y-8)
- Tight spacing (1-2): Within data cells, inline elements
- Standard spacing (4-6): Between related components
- Section spacing (8-16): Between major sections

**Grid Structure**:
- Desktop: Multi-panel dashboard layout (sidebar + main content + right panel for alerts/watchlists)
- Tablet: 2-column collapse (sidebar toggles, main content full width)
- Mobile: Single column stack, bottom navigation

## Core Components

### Dashboard Layout
- **Left Sidebar** (w-64 fixed): Navigation, broker status indicator, quick filters
- **Main Content Area** (flex-1): Scanner results table, chart views, backtest results
- **Right Panel** (w-80 fixed, collapsible): Live alerts feed, active watchlists, market stats
- Mobile: Bottom tab navigation (Scan, Charts, Alerts, Settings)

### Scanner Results Table
- Dense data table with sticky header
- Columns: Symbol, Price, Volume, RVOL, Stage, Resistance, Stop, Pattern Score
- Row height: compact (h-12) for maximum screen density
- Sortable columns with sort indicators
- Alternating row treatment for readability
- Expandable rows showing mini-chart preview

### Chart Components
- TradingView Lightweight Charts integration
- Chart container: min-h-96 on desktop, min-h-64 on mobile
- Control panel above chart: timeframe selector, indicator toggles, drawing tools
- Annotation layer showing: EMA-21, resistance levels (dashed), stop levels (solid)
- Chart occupies 60-70% of viewport height when in focus

### Alert Cards
- Compact card design (p-4) with clear hierarchy
- Alert type badge (top-left): "BREAKOUT" / "STOP HIT" / "APPROACHING"
- Symbol + Price (text-lg, font-mono, font-bold)
- Timestamp (text-xs, opacity-60)
- Action buttons (dismiss, view chart) in card footer
- Stack vertically in right panel, latest first

### Broker Connection Panel
- Large card layout (max-w-2xl) centered on connection page
- Broker logos displayed as selection tiles (grid-cols-2 md:grid-cols-3)
- Connection status indicator: Connected (with green dot), Disconnected (red dot), Connecting (animated)
- Data feed source selector: Radio buttons for broker/polygon/alpaca
- OAuth flow: Clear step indicators (1. Select → 2. Authorize → 3. Confirm)

### Settings & Configuration
- Tabbed interface: Scanner Filters, Alert Rules, Broker Setup, Push Notifications
- Form layouts: Two-column on desktop (label left, input right), single-column mobile
- Input groups with clear labels and helper text below
- Range sliders for price/volume filters with current value display

## Navigation

**Primary Nav** (Left Sidebar):
- Logo/App name at top (p-6)
- Nav items with icons + labels: Dashboard, Scanner, Charts, Alerts, Watchlists, Backtests, Settings
- Broker status widget at bottom (connection indicator, data source)

**Mobile Bottom Nav**:
- 4-5 primary items with icon + label
- Active state with indicator line or filled icon

## Data Visualization Standards

**Price Displays**: Always font-mono, align-right in tables
**Percentage Changes**: Show + or - prefix, consistent decimal places (2 digits)
**Volume Indicators**: Format with K/M suffixes (e.g., 2.4M)
**Status Badges**: Small pills (px-2 py-1, text-xs) with distinct states
- FORMING, READY, BREAKOUT each with unique visual treatment
**Charts**: Full-bleed within containers, minimal chrome, data-first

## Responsive Breakpoints

- Mobile: < 768px - Single column, stacked layout, bottom nav
- Tablet: 768px - 1024px - Two-column, collapsible sidebar
- Desktop: > 1024px - Full three-panel layout
- Wide: > 1440px - Expand main content, maintain panel widths

## Forms & Inputs

- Input fields: Consistent height (h-10 to h-12), rounded corners (rounded-md)
- Focus states: Clear outline treatment
- Labels: Above inputs (mb-2), font-medium, text-sm
- Helper text: Below inputs (mt-1), text-xs
- Grouped inputs: Use consistent gap (gap-4)
- Submit buttons: Prominent placement, clear action labels

## Images

**No hero image for this application.** This is a data-driven trading tool where immediate functionality and information access take priority over marketing imagery.

Images used sparingly:
- Broker logos in connection interface
- Empty state illustrations (when no scans/alerts exist)
- Tutorial/onboarding screens (optional first-time walkthrough)

## Accessibility

- Maintain WCAG AA contrast ratios throughout
- Focus indicators on all interactive elements
- Screen reader labels for data tables and chart elements
- Keyboard navigation support for scanner table navigation
- ARIA labels for alert notifications

## Animation

**Minimal animations only**:
- Real-time alert pulse (subtle) when new alert appears
- Data table row hover (instant)
- Panel slide transitions (200ms) when collapsing/expanding
- Loading spinners for data fetch operations
**No scroll animations, parallax, or decorative motion**