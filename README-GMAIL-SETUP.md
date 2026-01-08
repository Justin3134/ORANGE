# Gmail OAuth Setup for RecallJump

## Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select existing)
3. Enable the Gmail API:
   - Go to "APIs & Services" > "Library"
   - Search for "Gmail API"
   - Click "Enable"

## Step 2: Create OAuth Credentials

1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "OAuth 2.0 Client IDs"
3. Configure OAuth consent screen (if prompted):
   - User Type: External
   - App name: "RecallJump" (or your choice)
   - User support email: your email
   - Developer contact: your email
   - Save and Continue (skip other steps for now)
4. Create OAuth Client ID:
   - Application type: "Web application"
   - Name: "RecallJump Web"
   - Authorized redirect URIs: `http://localhost:4000/auth/gmail/callback` (for local dev) and `https://api.recalljump.com/auth/gmail/callback` (for production)
   - Click "Create"

## Step 3: Get Your Credentials

1. After creating, you'll see:
   - **Client ID**: Copy this
   - **Client Secret**: Copy this

## Step 4: Update Your .env File

In `/Users/justinkim/ORANGE/recall-backend/.env`:

```env
GMAIL_CLIENT_ID=your_client_id_here
GMAIL_CLIENT_SECRET=your_client_secret_here
GMAIL_REDIRECT_URI=http://localhost:4000/auth/gmail/callback
```

## Step 5: Test Gmail OAuth

1. Start your backend: `cd recall-backend && npm start`
2. Start your frontend: `cd ../chrono-recall && npm run dev`
3. Go to http://localhost:8080
4. Click "Connect" next to Gmail
5. You'll be redirected to Google OAuth
6. Grant permissions
7. You'll be redirected back with Gmail connected!
8. Click "Sync Gmail" to import your recent emails

## Troubleshooting

- **"invalid_client"**: Check your Client ID and Secret
- **"redirect_uri_mismatch"**: Make sure the redirect URI matches exactly: `http://localhost:4000/auth/gmail/callback`
- **"access_denied"**: Make sure Gmail API is enabled
- **Emails not syncing**: Check console for errors, make sure you have recent emails

## Security Notes

- Never commit your `.env` file to Git
- In production, use environment variables or a secure secrets manager
- The current setup stores tokens in memory (they'll be lost on server restart)
- For production, store tokens securely in a database

## What's Next

Once Gmail OAuth works, you can add similar OAuth flows for:
- Instagram (Meta for Developers)
- Slack (Slack Apps)
- Discord (Discord Developer Portal)
- Facebook (Meta for Developers)

Each will follow a similar pattern: get API credentials → add OAuth routes → add sync functions.
