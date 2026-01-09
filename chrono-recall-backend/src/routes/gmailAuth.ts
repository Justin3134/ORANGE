import { Request, Response } from 'express';
import { google } from 'googleapis';
import { config } from '../config/env';
import * as fs from 'fs';
import * as path from 'path';

// File-based token store for persistence across server restarts
// Use absolute path to ensure it works in production
const TOKEN_FILE = path.resolve(__dirname, '../../.tokens.json');

// Interface for Gmail account data
interface GmailAccount {
  tokens: any;
  email: string;
  name: string;
  connectedAt: string;
  gmailAccountIndex?: number; // Gmail URL index (u/0, u/1, etc.) for this browser
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
      const accountsObj: any = {};
      for (const [emailId, account] of accounts.entries()) {
        // Ensure tokens are properly serialized (they should be plain objects)
        accountsObj[emailId] = {
          tokens: account.tokens, // OAuth tokens are already plain objects
          email: account.email,
          name: account.name,
          connectedAt: account.connectedAt,
          gmailAccountIndex: account.gmailAccountIndex // Include Gmail account index
        };
      }
      data[userId] = accountsObj;
    }
    
    // Ensure directory exists
    const dir = path.dirname(TOKEN_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(TOKEN_FILE, JSON.stringify(data, null, 2));
    const totalAccounts = Array.from(store.values()).reduce((sum, accounts) => sum + accounts.size, 0);
    console.log(`💾 Saved token store: ${store.size} user(s) with ${totalAccounts} account(s)`);
  } catch (err) {
    console.error('Error saving tokens:', err);
    // Try to ensure directory exists and retry
    try {
      const dir = path.dirname(TOKEN_FILE);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      // Rebuild data for retry
      const data: any = {};
      for (const [userId, accounts] of store.entries()) {
        const accountsObj: any = {};
        for (const [emailId, account] of accounts.entries()) {
          accountsObj[emailId] = {
            tokens: account.tokens,
            email: account.email,
            name: account.name,
            connectedAt: account.connectedAt,
            gmailAccountIndex: account.gmailAccountIndex // Include Gmail account index
          };
        }
        data[userId] = accountsObj;
      }
      fs.writeFileSync(TOKEN_FILE, JSON.stringify(data, null, 2));
      console.log('💾 Retry: Successfully saved tokens');
    } catch (retryErr) {
      console.error('Error saving tokens on retry:', retryErr);
    }
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
    
    // CRITICAL: Determine the actual userId to use
    // - If userId was 'guest', generate userId from email (first-time login)
    // - Otherwise, use the provided userId (for adding accounts to existing user)
    // This ensures all accounts for a user are stored under the same userId
    let actualUserId = finalUserId;
    if (finalUserId === 'guest' || !finalUserId) {
      actualUserId = emailId; // Use email-based userId for guest users (first account)
      console.log(`🔄 Converting guest userId to email-based userId: ${actualUserId} (first-time login)`);
    } else {
      // User is logged in - use the provided userId to ensure all accounts are stored together
      console.log(`✅ Using provided userId: ${actualUserId} (adding account to existing user)`);
    }

    // Get or create user's account map
    let userAccounts = tokenStore.get(actualUserId);
    if (!userAccounts) {
      userAccounts = new Map();
      tokenStore.set(actualUserId, userAccounts);
      console.log(`📁 Created new account map for userId: ${actualUserId}`);
    } else {
      console.log(`📁 Using existing account map for userId: ${actualUserId} (${userAccounts.size} existing account(s))`);
    }

    // Check if this email is already connected to this userId
    const existingAccount = userAccounts.get(emailId);
    if (existingAccount) {
      console.log(`🔄 Updating existing Gmail account tokens for user ${actualUserId}: ${userEmail}`);
      // Update tokens but keep original connectedAt timestamp and gmailAccountIndex
      userAccounts.set(emailId, {
        tokens,
        email: userEmail,
        name: userName,
        connectedAt: existingAccount.connectedAt,
        gmailAccountIndex: existingAccount.gmailAccountIndex // Preserve existing index mapping
      });
    } else {
      console.log(`➕ Adding NEW Gmail account to user ${actualUserId}: ${userEmail} (total accounts will be: ${userAccounts.size + 1})`);
      // Add new account to the user's account map (no index set yet - user will configure it)
      userAccounts.set(emailId, {
        tokens,
        email: userEmail,
        name: userName,
        connectedAt: new Date().toISOString()
        // gmailAccountIndex will be undefined until user sets it
      });
    }
    
    // Ensure the store is updated with actualUserId
    tokenStore.set(actualUserId, userAccounts);
    
    // Persist to file immediately
    saveTokens(tokenStore);

    const accountCount = userAccounts.size;
    const totalAccounts = Array.from(tokenStore.values()).reduce((sum, accounts) => sum + accounts.size, 0);
    console.log(`✅ Gmail connected for user ${actualUserId} (${userEmail}). Total accounts: ${accountCount}`);
    console.log(`📋 Token store status: ${tokenStore.size} user(s), ${totalAccounts} total account(s)`);
    console.log(`💾 Token file location: ${TOKEN_FILE}`);

    // Redirect back to frontend with success and user info
    // Use actualUserId (which might be email-based if original was 'guest')
    const redirectUrl = new URL(`${config.frontendUrl}/dashboard`);
    redirectUrl.searchParams.set('gmail_connected', 'true');
    redirectUrl.searchParams.set('gmail_account_added', addAccount ? 'true' : 'false');
    redirectUrl.searchParams.set('email', userEmail);
    redirectUrl.searchParams.set('name', userName);
    redirectUrl.searchParams.set('account_count', accountCount.toString());
    redirectUrl.searchParams.set('userId', actualUserId); // Use actualUserId (email-based if was guest)

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
export function getAllAuthenticatedClients(userId: string): Array<{ email: string; client: any; gmailAccountIndex?: number }> {
  const userAccounts = tokenStore.get(userId);
  if (!userAccounts || userAccounts.size === 0) {
    return [];
  }

  const clients: Array<{ email: string; client: any; gmailAccountIndex?: number }> = [];
  for (const [emailId, account] of userAccounts.entries()) {
    try {
      const oauth2Client = createOAuth2Client();
      oauth2Client.setCredentials(account.tokens);
      clients.push({
        email: account.email,
        client: oauth2Client,
        gmailAccountIndex: account.gmailAccountIndex // Include Gmail account index
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
export function getGmailAccounts(userId: string): Array<{ email: string; name: string; connectedAt: string; gmailAccountIndex?: number }> {
  const userAccounts = tokenStore.get(userId);
  if (!userAccounts) {
    return [];
  }
  return Array.from(userAccounts.values()).map(acc => ({
    email: acc.email,
    name: acc.name,
    connectedAt: acc.connectedAt,
    gmailAccountIndex: acc.gmailAccountIndex // Include Gmail account index
  }));
}

/**
 * Update Gmail account index mapping
 * PUT /api/gmail/account-index
 */
export const updateGmailAccountIndex = (req: Request, res: Response) => {
  const { userId, emailId, gmailAccountIndex } = req.body;

  if (!userId || !emailId || gmailAccountIndex === undefined) {
    return res.status(400).json({ error: 'userId, emailId, and gmailAccountIndex are required' });
  }

  try {
    const userAccounts = tokenStore.get(userId);
    if (!userAccounts) {
      return res.status(404).json({ error: 'User not found' });
    }

    const account = userAccounts.get(emailId);
    if (!account) {
      return res.status(404).json({ error: 'Gmail account not found' });
    }

    // Validate index is a number between 0 and 10
    const index = parseInt(String(gmailAccountIndex), 10);
    if (isNaN(index) || index < 0 || index > 10) {
      return res.status(400).json({ error: 'gmailAccountIndex must be a number between 0 and 10' });
    }

    // Update the account index
    account.gmailAccountIndex = index;
    userAccounts.set(emailId, account);
    saveTokens(tokenStore);

    console.log(`✅ Updated Gmail account index for ${account.email}: u/${account.gmailAccountIndex}`);

    res.json({
      success: true,
      email: account.email,
      gmailAccountIndex: account.gmailAccountIndex
    });
  } catch (err: any) {
    console.error('Error updating Gmail account index:', err);
    res.status(500).json({ error: 'Failed to update account index' });
  }
};

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
  const { userId, labelName, emailIds, allGmailEmails } = req.body;

  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  if (!labelName) {
    return res.status(400).json({ error: 'labelName is required' });
  }

  // Support both old format (array of strings) and new format (array of objects with accountEmail)
  let emailData: Array<{ id: string; accountEmail?: string; accountIndex?: number }> = [];
  
  if (allGmailEmails && Array.isArray(allGmailEmails)) {
    // New format: array of objects with id and accountEmail
    emailData = allGmailEmails;
  } else if (emailIds && Array.isArray(emailIds)) {
    // Old format: array of strings, convert to objects
    emailData = emailIds.map((id: any) => 
      typeof id === 'string' ? { id } : id
    );
  } else {
    return res.status(400).json({ error: 'emailIds or allGmailEmails array is required' });
  }

  if (emailData.length === 0) {
    return res.status(400).json({ error: 'No emails to label' });
  }

  // Get all accounts for the user
  const accountClients = getAllAuthenticatedClients(userId);
  if (accountClients.length === 0) {
    return res.status(401).json({
      error: 'Gmail not authenticated. Please connect your Gmail account first.',
      needsAuth: true
    });
  }

  // Group emails by accountEmail
  const emailsByAccount = new Map<string, string[]>();
  const emailsWithoutAccount: string[] = [];

  for (const emailDataItem of emailData) {
    const emailId = emailDataItem.id;
    const accountEmail = emailDataItem.accountEmail;
    
    if (accountEmail) {
      if (!emailsByAccount.has(accountEmail)) {
        emailsByAccount.set(accountEmail, []);
      }
      emailsByAccount.get(accountEmail)!.push(emailId);
    } else {
      emailsWithoutAccount.push(emailId);
    }
  }

  // Create a map of accountEmail to accountClient for quick lookup
  const accountClientMap = new Map<string, any>();
  accountClients.forEach(({ email, client }) => {
    accountClientMap.set(email.toLowerCase(), client);
  });

  const results = {
    success: 0,
    failed: 0,
    errors: [] as string[],
    byAccount: {} as Record<string, { success: number; failed: number }>
  };

  // Label emails in each account
  for (const [accountEmail, emailIdsForAccount] of emailsByAccount.entries()) {
    const accountClient = accountClientMap.get(accountEmail.toLowerCase());
    if (!accountClient) {
      console.warn(`⚠️ Account client not found for ${accountEmail}, skipping ${emailIdsForAccount.length} emails`);
      results.failed += emailIdsForAccount.length;
      results.errors.push(`Account ${accountEmail}: Client not found`);
      continue;
    }

    try {
      const gmail = google.gmail({ version: 'v1', auth: accountClient });
      const labelId = await getOrCreateLabel(gmail, labelName);
      console.log(`📋 Using label "${labelName}" (ID: ${labelId}) in account ${accountEmail}`);

      const batchSize = 1000;
      let accountSuccess = 0;
      let accountFailed = 0;

      for (let i = 0; i < emailIdsForAccount.length; i += batchSize) {
        const batch = emailIdsForAccount.slice(i, i + batchSize);
        
        try {
          await gmail.users.messages.batchModify({
            userId: 'me',
            requestBody: {
              ids: batch,
              addLabelIds: [labelId]
            }
          });
          accountSuccess += batch.length;
        } catch (err: any) {
          console.error(`Error labeling batch in ${accountEmail}:`, err);
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
              accountSuccess++;
            } catch (individualErr: any) {
              accountFailed++;
              results.errors.push(`Email ${emailId} in ${accountEmail}: ${individualErr.message}`);
            }
          }
        }
      }

      results.success += accountSuccess;
      results.failed += accountFailed;
      results.byAccount[accountEmail] = { success: accountSuccess, failed: accountFailed };
      console.log(`✅ Labeled ${accountSuccess} emails with "${labelName}" in account ${accountEmail}`);
    } catch (err: any) {
      console.error(`Error labeling emails in account ${accountEmail}:`, err);
      results.failed += emailIdsForAccount.length;
      results.errors.push(`Account ${accountEmail}: ${err.message}`);
    }
  }

  // Handle emails without accountEmail (fallback to first account for backward compatibility)
  if (emailsWithoutAccount.length > 0 && accountClients.length > 0) {
    console.warn(`⚠️ Labeling ${emailsWithoutAccount.length} emails without accountEmail in first account`);
    const firstAccount = accountClients[0];
    try {
      const gmail = google.gmail({ version: 'v1', auth: firstAccount.client });
      const labelId = await getOrCreateLabel(gmail, labelName);

      const batchSize = 1000;
      for (let i = 0; i < emailsWithoutAccount.length; i += batchSize) {
        const batch = emailsWithoutAccount.slice(i, i + batchSize);
        try {
          await gmail.users.messages.batchModify({
            userId: 'me',
            requestBody: {
              ids: batch,
              addLabelIds: [labelId]
            }
          });
          results.success += batch.length;
        } catch (err: any) {
          results.failed += batch.length;
          results.errors.push(`Batch in fallback account: ${err.message}`);
        }
      }
    } catch (err: any) {
      console.error('Error labeling emails in fallback account:', err);
      results.failed += emailsWithoutAccount.length;
      results.errors.push(`Fallback account: ${err.message}`);
    }
  }

  console.log(`✅ Labeled ${results.success}/${emailData.length} emails with "${labelName}"`);

  res.json({
    success: true,
    labelName,
    results: {
      total: emailData.length,
      success: results.success,
      failed: results.failed
    },
    byAccount: Object.keys(results.byAccount).length > 0 ? results.byAccount : undefined,
    errors: results.errors.length > 0 ? results.errors : undefined
  });
};
