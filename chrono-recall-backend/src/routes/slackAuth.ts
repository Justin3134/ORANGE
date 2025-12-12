import { Router, Request, Response } from 'express';
import { config } from '../config/env';
import fs from 'fs';
import path from 'path';

const router = Router();

// Token storage (in production, use a database)
const TOKENS_FILE = path.join(process.cwd(), '.slack-tokens.json');

interface SlackTokenData {
  accessToken: string;
  botUserId: string;
  teamId: string;
  teamName: string;
  userId: string;
  userName: string;
  connectedAt: string;
}

// Load tokens from file
function loadTokens(): Map<string, SlackTokenData> {
  try {
    if (fs.existsSync(TOKENS_FILE)) {
      const data = JSON.parse(fs.readFileSync(TOKENS_FILE, 'utf-8'));
      return new Map(Object.entries(data));
    }
  } catch (err) {
    console.error('Error loading Slack tokens:', err);
  }
  return new Map();
}

// Save tokens to file
function saveTokens(tokens: Map<string, SlackTokenData>) {
  try {
    const data = Object.fromEntries(tokens);
    fs.writeFileSync(TOKENS_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Error saving Slack tokens:', err);
  }
}

const slackTokenStore = loadTokens();

// In-memory message store for Slack messages
const slackMessageStore = new Map<string, any[]>();

/**
 * Initiates Slack OAuth flow
 * GET /auth/slack?userId=xxx
 */
export const initiateSlackOAuth = (req: Request, res: Response) => {
  const userId = req.query.userId as string || 'default';

  if (!config.slack.clientId || !config.slack.clientSecret) {
    return res.status(500).json({
      error: 'Slack OAuth not configured. Please set SLACK_CLIENT_ID and SLACK_CLIENT_SECRET environment variables.',
      hint: 'Visit https://api.slack.com/apps to create OAuth credentials'
    });
  }

  // Slack OAuth scopes for reading messages
  const scopes = [
    'channels:history',
    'channels:read',
    'groups:history',
    'groups:read',
    'im:history',
    'im:read',
    'mpim:history',
    'mpim:read',
    'team:read',
    'users:read'
  ].join(',');

  const authUrl = new URL('https://slack.com/oauth/v2/authorize');
  authUrl.searchParams.set('client_id', config.slack.clientId);
  authUrl.searchParams.set('scope', scopes);
  authUrl.searchParams.set('redirect_uri', config.slack.redirectUri);
  authUrl.searchParams.set('state', userId);

  console.log(`Redirecting user ${userId} to Slack OAuth...`);
  res.redirect(authUrl.toString());
};

/**
 * Handles Slack OAuth callback
 * GET /auth/slack/callback?code=xxx&state=userId
 */
export const handleSlackCallback = async (req: Request, res: Response) => {
  const { code, state: userId, error } = req.query;

  if (error) {
    console.error('Slack OAuth error:', error);
    return res.redirect(`${config.frontendUrl}/dashboard?slack_error=${error}`);
  }

  if (!code || !userId) {
    return res.redirect(`${config.frontendUrl}/dashboard?slack_error=missing_params`);
  }

  try {
    // Exchange code for access token
    const tokenResponse = await fetch('https://slack.com/api/oauth.v2.access', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: config.slack.clientId,
        client_secret: config.slack.clientSecret,
        code: code as string,
        redirect_uri: config.slack.redirectUri,
      }).toString(),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenData.ok) {
      console.error('Slack token exchange failed:', tokenData);
      throw new Error(tokenData.error || 'Failed to exchange code for token');
    }

    // Get user info
    const userResponse = await fetch('https://slack.com/api/auth.test', {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
      },
    });

    const userInfo = await userResponse.json();

    if (!userInfo.ok) {
      throw new Error('Failed to get user info');
    }

    // Get team info
    const teamResponse = await fetch('https://slack.com/api/team.info', {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
      },
    });

    const teamInfo = await teamResponse.json();

    // Create email-like identifier for the user
    const slackEmail = `${userInfo.user}@${userInfo.team}.slack`;
    const finalUserId = slackEmail.toLowerCase().replace(/[^a-z0-9]/g, '_');

    // Store token
    slackTokenStore.set(finalUserId, {
      accessToken: tokenData.access_token,
      botUserId: tokenData.bot_user_id || userInfo.user_id,
      teamId: userInfo.team_id,
      teamName: teamInfo.team?.name || userInfo.team,
      userId: userInfo.user_id,
      userName: userInfo.user,
      connectedAt: new Date().toISOString(),
    });

    saveTokens(slackTokenStore);

    console.log(`✅ Slack connected for user ${finalUserId} (Slack: ${userInfo.user})`);
    console.log(`   Workspace: ${teamInfo.team?.name || userInfo.team}`);

    // Redirect to frontend with success
    const redirectUrl = new URL(`${config.frontendUrl}/dashboard`);
    redirectUrl.searchParams.set('slack_connected', 'true');
    redirectUrl.searchParams.set('email', slackEmail);
    redirectUrl.searchParams.set('name', userInfo.user);

    res.redirect(redirectUrl.toString());
  } catch (err: any) {
    console.error('Slack OAuth token exchange error:', err);
    res.redirect(`${config.frontendUrl}/dashboard?slack_error=token_exchange_failed`);
  }
};

/**
 * Check if Slack is connected for a user
 */
export const isSlackConnected = (userId: string): boolean => {
  return slackTokenStore.has(userId);
};

/**
 * Get Slack connection status
 * GET /auth/slack/status?userId=xxx
 */
export const getSlackStatus = async (req: Request, res: Response) => {
  const userId = req.query.userId as string;

  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  const tokenData = slackTokenStore.get(userId);

  if (!tokenData) {
    return res.json({
      connected: false,
    });
  }

  res.json({
    connected: true,
    userName: tokenData.userName,
    teamName: tokenData.teamName,
    connectedAt: tokenData.connectedAt,
  });
};

/**
 * Sync messages from Slack channels
 * POST /api/sync-slack
 */
export const syncSlackMessages = async (req: Request, res: Response) => {
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  const tokenData = slackTokenStore.get(userId);

  if (!tokenData) {
    return res.status(401).json({ error: 'Slack not connected for this user' });
  }

  try {
    // Get list of channels
    const channelsResponse = await fetch('https://slack.com/api/conversations.list?types=public_channel,private_channel,im,mpim&limit=100', {
      headers: {
        'Authorization': `Bearer ${tokenData.accessToken}`,
      },
    });

    const channelsData = await channelsResponse.json();

    if (!channelsData.ok) {
      throw new Error(channelsData.error || 'Failed to get channels');
    }

    const messages: any[] = [];
    const channels = channelsData.channels || [];

    // Fetch recent messages from each channel (limit to first 10 channels for performance)
    for (const channel of channels.slice(0, 10)) {
      try {
        const historyResponse = await fetch(
          `https://slack.com/api/conversations.history?channel=${channel.id}&limit=50`,
          {
            headers: {
              'Authorization': `Bearer ${tokenData.accessToken}`,
            },
          }
        );

        const historyData = await historyResponse.json();

        if (historyData.ok && historyData.messages) {
          for (const msg of historyData.messages) {
            if (msg.text && !msg.subtype) {
              messages.push({
                id: `slack-${msg.ts}`,
                platform: 'slack',
                channelId: channel.id,
                channelName: channel.name || 'Direct Message',
                text: msg.text,
                timestamp: new Date(parseFloat(msg.ts) * 1000).toISOString(),
                userId: msg.user,
              });
            }
          }
        }
      } catch (err) {
        console.error(`Error fetching history for channel ${channel.id}:`, err);
      }
    }

    // Store messages
    slackMessageStore.set(userId, messages);

    console.log(`📨 Synced ${messages.length} Slack messages for user ${userId}`);

    res.json({
      success: true,
      messagesCount: messages.length,
      channelsProcessed: Math.min(channels.length, 10),
    });
  } catch (err: any) {
    console.error('Error syncing Slack messages:', err);
    res.status(500).json({ error: 'Failed to sync Slack messages' });
  }
};

/**
 * Search Slack messages (internal function)
 */
export const searchSlackMessages = (userId: string, query: string): any[] => {
  const messages = slackMessageStore.get(userId) || [];
  const queryLower = query.toLowerCase();
  const queryTerms = queryLower.split(/\s+/).filter(t => t.length > 0);

  return messages.filter(msg => {
    const text = (msg.text || '').toLowerCase();
    const channel = (msg.channelName || '').toLowerCase();

    return queryTerms.some(term =>
      text.includes(term) || channel.includes(term)
    );
  }).slice(0, 20);
};

/**
 * Disconnect Slack
 * POST /auth/slack/disconnect
 */
export const disconnectSlack = async (req: Request, res: Response) => {
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  slackTokenStore.delete(userId);
  slackMessageStore.delete(userId);
  saveTokens(slackTokenStore);

  console.log(`🔌 Slack disconnected for user ${userId}`);

  res.json({ success: true });
};

// Set up routes
router.get('/slack', initiateSlackOAuth);
router.get('/slack/callback', handleSlackCallback);
router.get('/slack/status', getSlackStatus);
router.post('/slack/disconnect', disconnectSlack);

export default router;
export { syncSlackMessages as syncSlackHandler };
