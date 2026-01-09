import { Request, Response } from 'express';
import { google } from 'googleapis';
import { config } from '../config/env';
import * as fs from 'fs';
import * as path from 'path';

// File-based token store for persistence across server restarts
const TOKEN_FILE = path.join(__dirname, '../../.tokens.json');

// Interface for Gmail account data
interface GmailAccount {
  tokens: any;
  email: string;
  name: string;
  connectedAt: string;
}

// Token store structure: Map<userId, Map<emailId, GmailAccount>>
// This allows multiple Gmail accounts per user
type TokenStore = Map<string, Map<string, GmailAccount>>;

// Load tokens from file on startup
function loadTokens(): TokenStore {
  try {
    if (fs.existsSync(TOKEN_FILE)) {
      const data = fs.readFileSync(TOKEN_FILE, 'utf-8');
      const parsed = JSON.parse(data);
      
      // Convert from old format (Map<userId, tokens>) to new format (Map<userId, Map<emailId, account>>)
      const store: TokenStore = new Map();
      
      for (const [userId, accountData] of Object.entries(parsed)) {
        // Check if it's old format (single account) or new format (multiple accounts)
        if (accountData && typeof accountData === 'object' && 'email' in accountData) {
          // Old format: single account per user
          const account = accountData as any;
          const emailId = account.email?.toLowerCase().replace(/[^a-z0-9]/g, '_') || userId;
          const userAccounts = new Map<string, GmailAccount>();
          userAccounts.set(emailId, {
            tokens: account,
            email: account.email || '',
            name: account.name || '',
            connectedAt: account.connectedAt || new Date().toISOString()
          });
          store.set(userId, userAccounts);
        } else if (accountData && typeof accountData === 'object') {
          // New format: multiple accounts per user
          const userAccounts = new Map<string, GmailAccount>();
          for (const [emailId, account] of Object.entries(accountData as any)) {
            userAccounts.set(emailId, account as GmailAccount);
          }
          store.set(userId, userAccounts);
        }
      }
      
      const totalAccounts = Array.from(store.values()).reduce((sum, accounts) => sum + accounts.size, 0);
      console.log(`📂 Loaded ${store.size} user(s) with ${totalAccounts} Gmail account(s) from storage`);
      return store;
    }
  } catch (err) {
    console.error('Error loading tokens:', err);
  }
  return new Map();
}

// Save tokens to file
function saveTokens(store: TokenStore) {
  try {
    // Convert Map to plain object for JSON serialization
    const data: any = {};
    for (const [userId, accounts] of store.entries()) {
      data[userId] = Object.fromEntries(accounts);
    }
    fs.writeFileSync(TOKEN_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Error saving tokens:', err);
  }
}

// Initialize token store from file
const tokenStore: TokenStore = loadTokens();

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
  'https://www.googleapis.com/auth/gmail.modify', // For label creation/modification
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
];

/**
 * Initiate Gmail OAuth flow
 * GET /auth/gmail?userId=<userId>&add_account=<true|false>
 */
export const initiateGmailAuth = (req: Request, res: Response) => {
  const { userId, add_account } = req.query;

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

  // Encode userId and add_account flag in state parameter (format: userId|add_account)
  const stateValue = `${userId}|${add_account === 'true' ? 'true' : 'false'}`;

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    state: stateValue, // Pass userId and add_account flag in state
    prompt: 'consent', // Force consent screen to get refresh token
  });

  console.log(`Redirecting user ${userId} to Gmail OAuth (add_account: ${add_account === 'true'})...`);
  res.redirect(authUrl);
};

/**
 * Handle Gmail OAuth callback
 * GET /auth/gmail/callback?code=<code>&state=<userId|add_account>
 */
export const handleGmailCallback = async (req: Request, res: Response) => {
  const { code, state, error } = req.query;

  if (error) {
    console.error('OAuth error:', error);
    return res.redirect(`${config.frontendUrl}/dashboard?gmail_error=${error}`);
  }

  if (!code || !state) {
    return res.redirect(`${config.frontendUrl}/dashboard?gmail_error=missing_params`);
  }

  try {
    // Parse state parameter (format: userId|add_account)
    const stateParts = (state as string).split('|');
    const finalUserId = stateParts[0];
    const addAccount = stateParts[1] === 'true';

    if (!finalUserId) {
      return res.redirect(`${config.frontendUrl}/dashboard?gmail_error=invalid_state`);
    }

    const oauth2Client = createOAuth2Client();

    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code as string);
    oauth2Client.setCredentials(tokens);

    // Fetch user info from Google
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const userInfo = await oauth2.userinfo.get();
    const userEmail = userInfo.data.email || '';
    const userName = userInfo.data.name || userInfo.data.given_name || '';

    const emailId = userEmail.toLowerCase().replace(/[^a-z0-9]/g, '_');

    // Get or create user's account map
    let userAccounts = tokenStore.get(finalUserId);
    if (!userAccounts) {
      userAccounts = new Map();
      tokenStore.set(finalUserId, userAccounts);
    }

    // Check if this email is already connected
    const existingAccount = userAccounts.get(emailId);
    if (existingAccount) {
      console.log(`🔄 Updating existing Gmail account for user ${finalUserId}: ${userEmail}`);
      // Update tokens but keep original connectedAt
      userAccounts.set(emailId, {
        tokens,
        email: userEmail,
        name: userName,
        connectedAt: existingAccount.connectedAt
      });
    } else {
      console.log(`➕ Adding new Gmail account for user ${finalUserId}: ${userEmail}`);
      // Add new account
      userAccounts.set(emailId, {
        tokens,
        email: userEmail,
        name: userName,
        connectedAt: new Date().toISOString()
      });
    }
    
    saveTokens(tokenStore); // Persist to file

    const accountCount = userAccounts.size;
    console.log(`✅ Gmail connected for user ${finalUserId} (${userEmail}). Total accounts: ${accountCount}`);

    // Redirect back to frontend with success and user info
    const redirectUrl = new URL(`${config.frontendUrl}/dashboard`);
    redirectUrl.searchParams.set('gmail_connected', 'true');
    redirectUrl.searchParams.set('gmail_account_added', addAccount ? 'true' : 'false');
    redirectUrl.searchParams.set('email', userEmail);
    redirectUrl.searchParams.set('name', userName);
    redirectUrl.searchParams.set('account_count', accountCount.toString());

    res.redirect(redirectUrl.toString());
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

  const userAccounts = tokenStore.get(userId as string);
  const accounts = userAccounts ? Array.from(userAccounts.values()) : [];

  res.json({
    connected: accounts.length > 0,
    accountCount: accounts.length,
    accounts: accounts.map(acc => ({
      email: acc.email,
      name: acc.name,
      connectedAt: acc.connectedAt
    })),
    connectedAt: accounts.length > 0 ? accounts[0].connectedAt : null
  });
};

/**
 * Get OAuth2 client with stored tokens for a user (first account)
 * @deprecated Use getAllAuthenticatedClients for multi-account support
 */
export function getAuthenticatedClient(userId: string) {
  const userAccounts = tokenStore.get(userId);
  if (!userAccounts || userAccounts.size === 0) {
    return null;
  }

  // Return first account for backward compatibility
  const firstAccount = Array.from(userAccounts.values())[0];
  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials(firstAccount.tokens);
  return oauth2Client;
}

/**
 * Get all OAuth2 clients for all Gmail accounts of a user
 */
export function getAllAuthenticatedClients(userId: string): Array<{ email: string; client: any }> {
  const userAccounts = tokenStore.get(userId);
  if (!userAccounts || userAccounts.size === 0) {
    return [];
  }

  const clients: Array<{ email: string; client: any }> = [];
  for (const [emailId, account] of userAccounts.entries()) {
    try {
      const oauth2Client = createOAuth2Client();
      oauth2Client.setCredentials(account.tokens);
      clients.push({
        email: account.email,
        client: oauth2Client
      });
    } catch (err) {
      console.error(`Error creating client for account ${account.email}:`, err);
    }
  }

  return clients;
}

/**
 * Sync Gmail messages for authenticated user (all accounts)
 * POST /api/sync-gmail
 */
export const syncGmailMessages = async (req: Request, res: Response) => {
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  const accountClients = getAllAuthenticatedClients(userId);

  if (accountClients.length === 0) {
    return res.status(401).json({
      error: 'Gmail not authenticated. Please connect your Gmail account first.',
      needsAuth: true
    });
  }

  try {
    const allSyncedMessages: any[] = [];

    // Sync from all accounts
    for (const { email, client } of accountClients) {
      try {
        const gmail = google.gmail({ version: 'v1', auth: client });

        // Fetch recent messages
        const response = await gmail.users.messages.list({
          userId: 'me',
          maxResults: 50,
          q: 'newer_than:30d' // Last 30 days
        });

        const messages = response.data.messages || [];

        // Fetch full message details for each
        for (const msg of messages.slice(0, 20)) { // Limit to 20 per account
          try {
            const fullMessage = await gmail.users.messages.get({
              userId: 'me',
              id: msg.id!,
              format: 'metadata',
              metadataHeaders: ['From', 'To', 'Subject', 'Date']
            });

            const headers = fullMessage.data.payload?.headers || [];
            const getHeader = (name: string) =>
              headers.find((h: any) => h.name?.toLowerCase() === name.toLowerCase())?.value || '';

            allSyncedMessages.push({
              id: msg.id,
              threadId: msg.threadId,
              subject: getHeader('Subject'),
              from: getHeader('From'),
              to: getHeader('To'),
              date: getHeader('Date'),
              snippet: fullMessage.data.snippet,
              accountEmail: email // Include account identifier
            });
          } catch (err) {
            console.error(`Error fetching message ${msg.id} from ${email}:`, err);
          }
        }
      } catch (err: any) {
        console.error(`Error syncing account ${email}:`, err);
        if (err.code === 401 || err.message?.includes('invalid_grant')) {
          // Remove invalid account
          const userAccounts = tokenStore.get(userId);
          if (userAccounts) {
            const emailId = email.toLowerCase().replace(/[^a-z0-9]/g, '_');
            userAccounts.delete(emailId);
            if (userAccounts.size === 0) {
              tokenStore.delete(userId);
            }
            saveTokens(tokenStore);
          }
        }
      }
    }

    res.json({
      synced: allSyncedMessages.length,
      messages: allSyncedMessages,
      accountCount: accountClients.length,
      message: `Successfully synced ${allSyncedMessages.length} Gmail messages from ${accountClients.length} account(s)`
    });
  } catch (err: any) {
    console.error('Gmail sync error:', err);
    res.status(500).json({ error: 'Failed to sync Gmail messages' });
  }
};

/**
 * Disconnect Gmail account(s)
 * POST /auth/gmail/disconnect
 * Body: { userId, emailId? } - if emailId provided, disconnect specific account; otherwise disconnect all
 */
export const disconnectGmail = (req: Request, res: Response) => {
  const { userId, emailId } = req.body;

  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  const userAccounts = tokenStore.get(userId);
  if (!userAccounts || userAccounts.size === 0) {
    return res.json({ success: true, message: 'No Gmail accounts to disconnect' });
  }

  if (emailId) {
    // Disconnect specific account
    const account = userAccounts.get(emailId);
    if (account) {
      userAccounts.delete(emailId);
      if (userAccounts.size === 0) {
        tokenStore.delete(userId);
      }
      saveTokens(tokenStore);
      console.log(`Disconnected Gmail account ${account.email} for user ${userId}`);
      return res.json({ 
        success: true, 
        message: `Gmail account ${account.email} disconnected`,
        remainingAccounts: userAccounts.size
      });
    } else {
      return res.status(404).json({ error: 'Account not found' });
    }
  } else {
    // Disconnect all accounts
    const accountCount = userAccounts.size;
    tokenStore.delete(userId);
    saveTokens(tokenStore);
    console.log(`Disconnected all ${accountCount} Gmail account(s) for user ${userId}`);
    return res.json({ 
      success: true, 
      message: `All ${accountCount} Gmail account(s) disconnected` 
    });
  }
};

/**
 * Check if a user has Gmail connected (for internal use)
 */
export function isGmailConnected(userId: string): boolean {
  const userAccounts = tokenStore.get(userId);
  return userAccounts ? userAccounts.size > 0 : false;
}

/**
 * Get Gmail account count for a user (for internal use)
 */
export function getGmailAccountCount(userId: string): number {
  const userAccounts = tokenStore.get(userId);
  return userAccounts ? userAccounts.size : 0;
}

/**
 * Get all Gmail accounts for a user (for internal use)
 */
export function getGmailAccounts(userId: string): Array<{ email: string; name: string; connectedAt: string }> {
  const userAccounts = tokenStore.get(userId);
  if (!userAccounts) {
    return [];
  }
  return Array.from(userAccounts.values()).map(acc => ({
    email: acc.email,
    name: acc.name,
    connectedAt: acc.connectedAt
  }));
}

/**
 * Create or get Gmail label
 */
async function getOrCreateLabel(gmail: any, labelName: string): Promise<string> {
  try {
    // First, try to find existing label
    const labelsResponse = await gmail.users.labels.list({ userId: 'me' });
    const existingLabel = labelsResponse.data.labels?.find(
      (label: any) => label.name?.toLowerCase() === labelName.toLowerCase()
    );
    
    if (existingLabel) {
      return existingLabel.id!;
    }

    // Create new label if it doesn't exist
    const createResponse = await gmail.users.labels.create({
      userId: 'me',
      requestBody: {
        name: labelName,
        labelListVisibility: 'labelShow',
        messageListVisibility: 'show'
      }
    });

    return createResponse.data.id!;
  } catch (err: any) {
    console.error('Error creating/getting label:', err);
    throw err;
  }
}

/**
 * Label emails in Gmail
 * POST /api/label-emails
 */
export const labelEmails = async (req: Request, res: Response) => {
  const { userId, labelName, emailIds } = req.body;

  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  if (!labelName) {
    return res.status(400).json({ error: 'labelName is required' });
  }

  if (!emailIds || !Array.isArray(emailIds) || emailIds.length === 0) {
    return res.status(400).json({ error: 'emailIds array is required' });
  }

  // Get all accounts for the user
  const accountClients = getAllAuthenticatedClients(userId);
  if (accountClients.length === 0) {
    return res.status(401).json({
      error: 'Gmail not authenticated. Please connect your Gmail account first.',
      needsAuth: true
    });
  }

  // Group emailIds by accountEmail if provided, otherwise use first account
  // For now, we'll label in all accounts (or we could require accountEmail per email)
  // Let's use the first account for backward compatibility, but we can enhance this later
  const firstAccount = accountClients[0];
  
  try {
    const gmail = google.gmail({ version: 'v1', auth: firstAccount.client });

    // Get or create the label
    const labelId = await getOrCreateLabel(gmail, labelName);
    console.log(`📋 Using label "${labelName}" (ID: ${labelId})`);

    // Apply label to all emails in batches (Gmail API limit is 1000 per request)
    const batchSize = 1000;
    const results = {
      success: 0,
      failed: 0,
      errors: [] as string[]
    };

    for (let i = 0; i < emailIds.length; i += batchSize) {
      const batch = emailIds.slice(i, i + batchSize);
      
      try {
        // Use batch modify for efficiency
        await gmail.users.messages.batchModify({
          userId: 'me',
          requestBody: {
            ids: batch,
            addLabelIds: [labelId]
          }
        });
        results.success += batch.length;
      } catch (err: any) {
        console.error(`Error labeling batch:`, err);
        // Fallback to individual labeling
        for (const emailId of batch) {
          try {
            await gmail.users.messages.modify({
              userId: 'me',
              id: emailId,
              requestBody: {
                addLabelIds: [labelId]
              }
            });
            results.success++;
          } catch (individualErr: any) {
            results.failed++;
            results.errors.push(`Email ${emailId}: ${individualErr.message}`);
          }
        }
      }
    }

    console.log(`✅ Labeled ${results.success} emails with "${labelName}"`);

    res.json({
      success: true,
      labelName,
      labelId,
      results: {
        total: emailIds.length,
        success: results.success,
        failed: results.failed
      },
      errors: results.errors.length > 0 ? results.errors : undefined
    });
  } catch (err: any) {
    console.error('Error labeling emails:', err);
    res.status(500).json({ 
      error: 'Failed to label emails',
      message: err.message 
    });
  }
};
