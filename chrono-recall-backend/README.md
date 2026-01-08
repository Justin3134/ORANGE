# RecallJump Backend

Backend API for RecallJump - AI-powered memory search across platforms.

## Features

- REST API for memory synchronization and search
- Support for multiple platforms (Gmail, Instagram, Facebook, Slack, Discord)
- Unified memory model for cross-platform content
- Simple keyword search (ready for AI enhancement)

## Quick Start

1. Install dependencies:
   ```bash
   npm install
   ```

2. Copy environment variables:
   ```bash
   cp .env.example .env
   ```

3. Start development server:
   ```bash
   npm run dev
   ```

The server will run on http://localhost:4000

## API Endpoints

- `GET /health` - Health check
- `POST /auth/dev-login` - Development login
- `GET /integrations` - List available integrations
- `POST /sync/:platform` - Sync data from a platform
- `POST /search` - Search memories

## Project Structure

```
src/
├── index.ts              # Main server entry point
├── routes/
│   ├── auth.ts          # Authentication routes
│   ├── sync.ts          # Sync routes
│   └── search.ts        # Search routes
├── integrations/
│   ├── gmail.ts         # Gmail integration
│   ├── instagram.ts     # Instagram integration
│   ├── facebook.ts      # Facebook integration
│   ├── slack.ts         # Slack integration
│   └── discord.ts       # Discord integration
├── services/
│   ├── syncService.ts   # Sync business logic
│   └── searchService.ts # Search business logic
├── models/
│   └── Item.ts          # Memory item model
└── config/
    └── env.ts           # Environment configuration
```
