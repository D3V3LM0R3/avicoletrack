# AvicoleTrack Beta App Status

## Current state

AvicoleTrack is currently in beta development. The foundation is usable and includes the main operational flows for authentication, farm management, flock monitoring, reports, alerts, and analytics. The app already supports multiple roles (owner, manager, worker) and a working data model for poultry-farm operations.

At this stage, the product is not a polished production release yet, but it is no longer a simple prototype. The core business logic is in place, and the next wave of value will come from owner decision tools, communication, and engagement features.

## What already works

- User registration and login
- Role-based access for owner, manager, and worker
- Enterprise and farm structures
- Farm membership management and invitations
- Daily flock reports and KPI calculations
- Notifications and alerts
- Farm comparison analytics
- Event handling and market-price support
- Mobile app shell and role-aware navigation

## What remains most important to build

### 1. Owner capital and performance dashboard

The owner needs a dedicated bottom tab that gives a clear financial and operational picture of the business.

This should show:

- Total capital invested across all farms
- Revenue generated over time
- Benefits and margins by period
- Farm-by-farm comparison
- Best-performing farm and worst-performing farm
- Profit trends by month, quarter, or year
- Cost centers such as feed, birds, labor, and veterinary care

Best way to do it:

- Create a dedicated owner dashboard screen in the mobile app under a new bottom-tab such as "Finance" or "Capital".
- Use a backend analytics endpoint that aggregates all farms for the enterprise owner.
- Calculate values from existing daily reports, stock movements, and market prices.
- Show both summary cards and comparison charts.
- Include filters for date range, farm, and flock.
- Display a ranking table with each farm's gain/loss ratio and trend arrow.

Recommended data model:

- enterprise_id
- farm_id
- report_date
- feed_cost
- chick_cost
- medicine_cost
- labor_cost
- sales_revenue
- egg_sales
- mortality_cost
- net_profit
- capital_invested
- cumulative_profit

This should be computed from backend summaries to keep the mobile UI fast and consistent.

### 2. Chat section between owner and personnel

The app needs a communication layer for fast business coordination between the enterprise owner and operational personnel.

This should include:

- Direct chat with all members of a farm
- Group chat by enterprise or farm
- Message timestamps and read status
- Notifications when new messages arrive
- Optional attachments or photos of flock conditions

Best way to do it:

- Introduce a messages table with: id, sender_id, receiver_id, farm_id, enterprise_id, content, created_at, read_at.
- For group chat, create a conversation table and a conversation_members table.
- Store messages in PostgreSQL and expose REST endpoints under /chat or /messages.
- Keep a lightweight first version without voice or file attachments.
- Push notifications can be added after the chat core is stable.

This is a high-value feature because it reduces phone calls and strengthens operational discipline across farms.

### 3. Game section with chicken road-crossing challenge

The game is a lighter engagement layer for members and can help create habit and motivation around the app.

The first game should be simple: a chicken-crossing road mini-game where the player avoids traffic and reaches the goal.

Game requirements:

- Single-player game loop
- Tween or animation-based movement for the chicken
- Increasing difficulty over time
- Score based on distance, safe crossings, and survival time
- High-score leaderboard shared across all members of the app

Best way to do it:

- Build the first version as a simple React Native game using a canvas or animated views rather than a full 3D engine.
- Store the score in a backend table: user_id, username, score, game_type, played_at.
- Add a top-scores endpoint with filters by date range and global ranking.
- Use local caching for instant feedback and sync the score after each run.
- Keep the game light and addictive, not too complex at the beta stage.

This can later evolve into a broader gamification system with badges, streaks, and farm challenges.

## Recommended implementation order

1. Owner financial dashboard
2. Chat feature
3. Game section

This order matches the business value: the owner needs decision-making tools first, then communication, then engagement.

## Recommended product strategy

To make the beta valuable, the app should focus on the following product pillars:

- Business visibility for the owner
- Operational coordination between teams
- Motivation and retention through a small game layer
- Clear farm-level analytics and comparison

The current app already has the operational backbone. The next step is not more CRUD screens, but better business intelligence and stronger user engagement.

## Final position

The application is in a healthy beta phase in terms of architecture and core workflows. The most important missing items are not technical infrastructure but strategic product features that turn the app into a useful operational and business platform for poultry enterprises.
