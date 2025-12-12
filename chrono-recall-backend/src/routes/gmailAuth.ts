import { Request, Response } from 'express';
import { google } from 'googleapis';
import { config } from '../config/env';
import * as fs from 'fs';
import * as path from 'path';

// File-based token store for persistence across server restarts
const TOKEN_FILE = path.join(__dirname, '../../.tokens.json');

// Load tokens from file on startup
function loadTokens(): Map<string, any> {
  try {
    if (fs.existsSync(TOKEN_FILE)) {
      const data = fs.readFileSync(TOKEN_FILE, 'utf-8');
      const parsed = JSON.parse(data);
      console.log(`📂 Loaded ${Object.keys(parsed).length} token(s) from storage`);
      return new Map(Object.entries(parsed));
    }
  } catch (err) {
    console.error('Error loading tokens:', err);
  }
  return new Map();
}

// Save tokens to file
function saveTokens(store: Map<string, any>) {
  try {
    const data = Object.fromEntries(store);
    fs.writeFileSync(TOKEN_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Error saving tokens:', err);
  }
}

// Initialize token store from file
const tokenStore: Map<string, any> = loadTokens();

/**
 * Create OAuth2 client with configuration
 */
function createOAuth2Client() {
  return new google.auth.OAuth2(
    config.google.clientId,
    config.google.clientSecret,
    config.google.redirectUri
  );
}

/**
 * Gmail OAuth scopes
 */
const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
];

/**
 * Initiate Gmail OAuth flow
 * GET /auth/gmail?userId=<userId>
 */
export const initiateGmailAuth = (req: Request, res: Response) => {
  const { userId } = req.query;

  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  // Check if Google credentials are configured
  if (!config.google.clientId || !config.google.clientSecret) {
    return res.status(500).json({
      error: 'Google OAuth not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables.',
      hint: 'Visit https://console.cloud.google.com to create OAuth credentials'
    });
  }

  const oauth2Client = createOAuth2Client();

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    state: userId as string, // Pass userId in state to retrieve after callback
    prompt: 'consent', // Force consent screen to get refresh token
  });

  console.log(`Redirecting user ${userId} to Gmail OAuth...`);
  res.redirect(authUrl);
};

/**
 * Handle Gmail OAuth callback
 * GET /auth/gmail/callback?code=<code>&state=<userId>
 */
export const handleGmailCallback = async (req: Request, res: Response) => {
  const { code, state: userId, error } = req.query;

  if (error) {
    console.error('OAuth error:', error);
    return res.redirect(`${config.frontendUrl}/dashboard?gmail_error=${error}`);
  }

  if (!code || !userId) {
    return res.redirect(`${config.frontendUrl}/dashboard?gmail_error=missing_params`);
  }

  try {
    const oauth2Client = createOAuth2Client();

    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code as string);

    // Store tokens for the user
    tokenStore.set(userId as string, {
      ...tokens,
      connectedAt: new Date().toISOString()
    });
    saveTokens(tokenStore); // Persist to file

    console.log(`Gmail connected for user ${userId}`);

    // Redirect back to frontend with success
    res.redirect(`${config.frontendUrl}/dashboard?gmail_connected=true`);
  } catch (err: any) {
    console.error('OAuth token exchange error:', err);
    res.redirect(`${config.frontendUrl}/dashboard?gmail_error=token_exchange_failed`);
  }
};

/**
 * Check if user has Gmail connected
 * GET /auth/gmail/status?userId=<userId>
 */
export const getGmailStatus = (req: Request, res: Response) => {
  const { userId } = req.query;

  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  const tokens = tokenStore.get(userId as string);

  res.json({
    connected: !!tokens,
    connectedAt: tokens?.connectedAt || null
  });
};

/**
 * Get OAuth2 client with stored tokens for a user
 */
export function getAuthenticatedClient(userId: string) {
  const tokens = tokenStore.get(userId);
  if (!tokens) {
    return null;
  }

  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials(tokens);
  return oauth2Client;
}

/**
 * Sync Gmail messages for authenticated user
 * POST /api/sync-gmail
 */
export const syncGmailMessages = async (req: Request, res: Response) => {
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  const oauth2Client = getAuthenticatedClient(userId);

  if (!oauth2Client) {
    return res.status(401).json({
      error: 'Gmail not authenticated. Please connect your Gmail account first.',
      needsAuth: true
    });
  }

  try {
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    // Fetch recent messages
    const response = await gmail.users.messages.list({
      userId: 'me',
      maxResults: 50,
      q: 'newer_than:30d' // Last 30 days
    });

    const messages = response.data.messages || [];
    const syncedMessages = [];

    // Fetch full message details for each
    for (const msg of messages.slice(0, 20)) { // Limit to 20 for now
      try {
        const fullMessage = await gmail.users.messages.get({
          userId: 'me',
          id: msg.id!,
          format: 'metadata',
          metadataHeaders: ['From', 'To', 'Subject', 'Date']
        });

        const headers = fullMessage.data.payload?.headers || [];
        const getHeader = (name: string) =>
          headers.find(h => h.name?.toLowerCase() === name.toLowerCase())?.value || '';

        syncedMessages.push({
          id: msg.id,
          threadId: msg.threadId,
          subject: getHeader('Subject'),
          from: getHeader('From'),
          to: getHeader('To'),
          date: getHeader('Date'),
          snippet: fullMessage.data.snippet
        });
      } catch (err) {
        console.error(`Error fetching message ${msg.id}:`, err);
      }
    }

    res.json({
      synced: syncedMessages.length,
      messages: syncedMessages,
      message: `Successfully synced ${syncedMessages.length} Gmail messages`
    });
  } catch (err: any) {
    console.error('Gmail sync error:', err);

    if (err.code === 401 || err.message?.includes('invalid_grant')) {
      tokenStore.delete(userId);
      saveTokens(tokenStore); // Persist deletion
      return res.status(401).json({
        error: 'Gmail authentication expired. Please reconnect.',
        needsAuth: true
      });
    }

    res.status(500).json({ error: 'Failed to sync Gmail messages' });
  }
};

/**
 * Disconnect Gmail
 * POST /auth/gmail/disconnect
 */
export const disconnectGmail = (req: Request, res: Response) => {
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  tokenStore.delete(userId);
  saveTokens(tokenStore); // Persist deletion

  res.json({ success: true, message: 'Gmail disconnected' });
};

/**
 * Check if a user has Gmail connected (for internal use)
 */
export function isGmailConnected(userId: string): boolean {
  return tokenStore.has(userId);
}
