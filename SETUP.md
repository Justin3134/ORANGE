# ORANGE Project Setup Guide

This is a monorepo containing the RecallJump application (formerly Chrono Recall).

## Project Structure

- **`chrono-recall/`** - Frontend React application (deployed at recalljump.com)
- **`chrono-recall-backend/`** - Backend API server (TypeScript/Express)
- **`recall-backend/`** - Legacy backend (Node.js)

## Quick Start

### Prerequisites
- Node.js 18+ and npm
- Git

### 1. Install Dependencies

**Backend:**
```bash
cd chrono-recall-backend
npm install
```

**Frontend:**
```bash
cd chrono-recall
npm install
```

### 2. Environment Setup

**Backend** - Create `chrono-recall-backend/.env`:
```env
PORT=4000
NODE_ENV=development
FRONTEND_URL=http://localhost:8080
BACKEND_URL=http://localhost:4000

# Optional: OAuth credentials (leave empty for local dev)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:4000/auth/gmail/callback

DISCORD_CLIENT_ID=
DISCORD_CLIENT_SECRET=
DISCORD_BOT_TOKEN=
DISCORD_REDIRECT_URI=http://localhost:4000/auth/discord/callback

SLACK_CLIENT_ID=
SLACK_CLIENT_SECRET=
SLACK_SIGNING_SECRET=
SLACK_REDIRECT_URI=http://localhost:4000/auth/slack/callback

OPENAI_API_KEY=
```

**Frontend** - Create `chrono-recall/.env` (optional for local dev):
```env
VITE_BACKEND_URL=http://localhost:4000
```

### 3. Run Development Servers

**Terminal 1 - Backend:**
```bash
cd chrono-recall-backend
npm run dev
```
Backend runs on: http://localhost:4000

**Terminal 2 - Frontend:**
```bash
cd chrono-recall
npm run dev
```
Frontend runs on: http://localhost:8080

## Production

- **Frontend:** https://recalljump.com (deployed on Vercel)
- **Backend:** Configured via environment variables in deployment platform

## Available Scripts

### Backend
- `npm run dev` - Start development server with hot reload
- `npm run build` - Build TypeScript to JavaScript
- `npm start` - Run production build
- `npm run lint` - Run ESLint

### Frontend
- `npm run dev` - Start Vite dev server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## Troubleshooting

### Port Already in Use
If port 4000 or 8080 is already in use:
- Backend: Change `PORT` in `.env`
- Frontend: Change `port` in `vite.config.ts`

### CORS Errors
Make sure `FRONTEND_URL` in backend `.env` matches your frontend URL.

### OAuth Not Working
1. Check that OAuth credentials are set in `.env`
2. Verify redirect URIs match exactly in OAuth provider settings
3. For local dev, use `http://localhost:4000/auth/[service]/callback`

## Notes

- Token files (`.tokens.json`, `.discord-tokens.json`, `.slack-tokens.json`) are created automatically and stored in the backend directory
- These files are gitignored for security
- In production, use a proper database for token storage



