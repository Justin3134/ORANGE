import { Request, Response } from 'express';
import { config } from '../config/env';
import * as fs from 'fs';
import * as path from 'path';

// Discord.js will be imported dynamically to handle if not installed
let Client: any;
let GatewayIntentBits: any;
let discordClient: any = null;

// File-based token store for Discord (stores discordUserId per app userId)
const DISCORD_TOKEN_FILE = path.join(__dirname, '../../.discord-tokens.json');

// In-memory message store for Discord messages
const discordMessageStore: Map<string, any[]> = new Map();

// Load tokens from file on startup
function loadDiscordTokens(): Map<string, any> {
  try {
    if (fs.existsSync(DISCORD_TOKEN_FILE)) {
      const data = fs.readFileSync(DISCORD_TOKEN_FILE, 'utf-8');
      const parsed = JSON.parse(data);
      console.log(`📂 Loaded ${Object.keys(parsed).length} Discord connection(s) from storage`);
      return new Map(Object.entries(parsed));
    }
  } catch (err) {
    console.error('Error loading Discord tokens:', err);
  }
  return new Map();
}

// Save tokens to file
function saveDiscordTokens(store: Map<string, any>) {
  try {
    const data = Object.fromEntries(store);
    fs.writeFileSync(DISCORD_TOKEN_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Error saving Discord tokens:', err);
  }
}

// Initialize token store from file
const discordTokenStore: Map<string, any> = loadDiscordTokens();

/**
 * Discord OAuth scopes - we only need identity and guilds
 * (Bot handles message access separately)
 */
const SCOPES = ['identify', 'guilds'];

/**
 * Initialize Discord Bot
 */
export async function initializeDiscordBot() {
  if (!config.discord.botToken) {
    console.log('⚠️  Discord bot token not configured, skipping bot initialization');
    return null;
  }

  try {
    // Dynamic import of discord.js
    const discordJs = await import('discord.js');
    Client = discordJs.Client;
    GatewayIntentBits = discordJs.GatewayIntentBits;

    discordClient = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
      ],
    });

    discordClient.once('ready', () => {
      console.log(`✅ Discord bot ready! Logged in as ${discordClient.user?.tag}`);
      console.log(`📡 Bot is in ${discordClient.guilds.cache.size} server(s)`);
    });

    // Listen for new messages and store them
    discordClient.on('messageCreate', (msg: any) => {
      if (msg.author.bot) return;

      const messageItem = {
        id: `discord-${msg.id}`,
        platform: 'discord',
        channelId: msg.channel.id,
        channelName: msg.channel.name || 'DM',
        guildId: msg.guild?.id || null,
        guildName: msg.guild?.name || 'Direct Message',
        authorId: msg.author.id,
        authorUsername: msg.author.username,
        content: msg.content,
        timestamp: new Date(msg.createdTimestamp).toISOString(),
        url: msg.url,
      };

      // Store message for all connected users who are in this guild
      discordTokenStore.forEach((userData, appUserId) => {
        if (!msg.guild?.id || userData.guilds?.includes(msg.guild.id)) {
          const userMessages = discordMessageStore.get(appUserId) || [];
          userMessages.unshift(messageItem); // Add to beginning
          // Keep only last 1000 messages per user
          if (userMessages.length > 1000) {
            userMessages.pop();
          }
          discordMessageStore.set(appUserId, userMessages);
        }
      });

      console.log(`📨 Discord: Captured message from ${msg.author.username} in #${msg.channel.name || 'DM'}`);
    });

    await discordClient.login(config.discord.botToken);
    return discordClient;
  } catch (err: any) {
    if (err.code === 'MODULE_NOT_FOUND') {
      console.log('⚠️  discord.js not installed. Run: npm install discord.js');
    } else {
      console.error('❌ Failed to initialize Discord bot:', err.message);
    }
    return null;
  }
}

/**
 * Initiate Discord OAuth flow
 * GET /auth/discord?userId=<userId>
 */
export const initiateDiscordAuth = (req: Request, res: Response) => {
  const { userId } = req.query;

  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  // Check if Discord credentials are configured
  if (!config.discord.clientId || !config.discord.clientSecret) {
    return res.status(500).json({
      error: 'Discord OAuth not configured. Please set DISCORD_CLIENT_ID and DISCORD_CLIENT_SECRET environment variables.',
      hint: 'Visit https://discord.com/developers/applications to create OAuth credentials'
    });
  }

  const authUrl = `https://discord.com/api/oauth2/authorize?client_id=${config.discord.clientId}&redirect_uri=${encodeURIComponent(config.discord.redirectUri)}&response_type=code&scope=${SCOPES.join('%20')}&state=${userId}`;

  console.log(`Redirecting user ${userId} to Discord OAuth...`);
  res.redirect(authUrl);
};

/**
 * Handle Discord OAuth callback
 * GET /auth/discord/callback?code=<code>&state=<userId>
 */
export const handleDiscordCallback = async (req: Request, res: Response) => {
  const { code, state: userId, error } = req.query;

  if (error) {
    console.error('Discord OAuth error:', error);
    return res.redirect(`${config.frontendUrl}/login?discord_error=${error}`);
  }

  if (!code || !userId) {
    return res.redirect(`${config.frontendUrl}/login?discord_error=missing_params`);
  }

  try {
    // Exchange code for tokens using fetch
    const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: config.discord.clientId,
        client_secret: config.discord.clientSecret,
        grant_type: 'authorization_code',
        code: code as string,
        redirect_uri: config.discord.redirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      throw new Error('Failed to exchange code for token');
    }

    const tokens = await tokenResponse.json();
    const accessToken = tokens.access_token;

    // Fetch user info
    const userResponse = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!userResponse.ok) {
      throw new Error('Failed to fetch Discord user info');
    }

    const userInfo = await userResponse.json();

    // Fetch user's guilds (servers)
    const guildsResponse = await fetch('https://discord.com/api/users/@me/guilds', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const guilds = guildsResponse.ok ? await guildsResponse.json() : [];

    // Create email-like identifier for Discord users
    const discordEmail = `${userInfo.username}@discord.user`;
    const finalUserId = discordEmail.toLowerCase().replace(/[^a-z0-9]/g, '_');

    // Store Discord connection info for the user
    discordTokenStore.set(finalUserId, {
      discordUserId: userInfo.id,
      discordUsername: userInfo.username,
      discriminator: userInfo.discriminator,
      avatar: userInfo.avatar,
      email: discordEmail,
      guilds: guilds.map((g: any) => g.id),
      guildNames: guilds.map((g: any) => g.name),
      connectedAt: new Date().toISOString(),
    });
    saveDiscordTokens(discordTokenStore);

    console.log(`✅ Discord connected for user ${finalUserId} (Discord: ${userInfo.username})`);
    console.log(`   User is in ${guilds.length} server(s)`);

    // Redirect to frontend with success and user info
    const redirectUrl = new URL(`${config.frontendUrl}/login`);
    redirectUrl.searchParams.set('discord_connected', 'true');
    redirectUrl.searchParams.set('email', discordEmail);
    redirectUrl.searchParams.set('name', userInfo.username);

    res.redirect(redirectUrl.toString());
  } catch (err: any) {
    console.error('Discord OAuth token exchange error:', err);
    res.redirect(`${config.frontendUrl}/login?discord_error=token_exchange_failed`);
  }
};

/**
 * Check if user has Discord connected
 * GET /auth/discord/status?userId=<userId>
 */
export const getDiscordStatus = (req: Request, res: Response) => {
  const { userId } = req.query;

  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  const connection = discordTokenStore.get(userId as string);
  const messageCount = discordMessageStore.get(userId as string)?.length || 0;

  res.json({
    connected: !!connection,
    connectedAt: connection?.connectedAt || null,
    discordUsername: connection?.discordUsername || null,
    serverCount: connection?.guilds?.length || 0,
    serverNames: connection?.guildNames || [],
    messageCount,
    botOnline: discordClient?.isReady() || false,
  });
};

/**
 * Get bot invite link
 * GET /auth/discord/bot-invite
 */
export const getBotInviteLink = (req: Request, res: Response) => {
  if (!config.discord.clientId) {
    return res.status(500).json({ error: 'Discord not configured' });
  }

  const inviteUrl = `https://discord.com/api/oauth2/authorize?client_id=${config.discord.clientId}&permissions=${config.discord.botPermissions}&scope=bot`;

  res.json({
    inviteUrl,
    instructions: 'Click this link to invite the ChronoRecall bot to your Discord server. The bot will read and store messages for AI search.',
  });
};

/**
 * Disconnect Discord
 * POST /auth/discord/disconnect
 */
export const disconnectDiscord = (req: Request, res: Response) => {
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  discordTokenStore.delete(userId);
  discordMessageStore.delete(userId);
  saveDiscordTokens(discordTokenStore);

  res.json({ success: true, message: 'Discord disconnected' });
};

/**
 * Sync Discord messages - fetches historical messages from channels the bot has access to
 * POST /api/sync-discord
 */
export const syncDiscordMessages = async (req: Request, res: Response) => {
  const { userId, channelId, limit = 100 } = req.body;

  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  const connection = discordTokenStore.get(userId);
  if (!connection) {
    return res.status(401).json({
      error: 'Discord not connected. Please connect your Discord account first.',
      needsAuth: true,
    });
  }

  if (!discordClient || !discordClient.isReady()) {
    return res.status(503).json({
      error: 'Discord bot is not online. Please ensure the bot is running and invited to your server.',
      needsBotInvite: true,
    });
  }

  try {
    const syncedMessages: any[] = [];

    // If specific channel provided, fetch from it
    if (channelId) {
      const channel = await discordClient.channels.fetch(channelId);
      if (channel && channel.isTextBased()) {
        const messages = await channel.messages.fetch({ limit: Math.min(limit, 100) });
        messages.forEach((msg: any) => {
          if (!msg.author.bot) {
            syncedMessages.push({
              id: `discord-${msg.id}`,
              platform: 'discord',
              channelId: msg.channel.id,
              channelName: msg.channel.name || 'DM',
              guildId: msg.guild?.id || null,
              guildName: msg.guild?.name || 'Direct Message',
              authorId: msg.author.id,
              authorUsername: msg.author.username,
              content: msg.content,
              timestamp: new Date(msg.createdTimestamp).toISOString(),
              url: msg.url,
            });
          }
        });
      }
    } else {
      // Fetch from all accessible text channels in user's guilds
      for (const guildId of connection.guilds || []) {
        try {
          const guild = await discordClient.guilds.fetch(guildId);
          const channels = guild.channels.cache.filter((c: any) => c.isTextBased());

          for (const [, channel] of channels) {
            try {
              const messages = await (channel as any).messages.fetch({ limit: 20 });
              messages.forEach((msg: any) => {
                if (!msg.author.bot) {
                  syncedMessages.push({
                    id: `discord-${msg.id}`,
                    platform: 'discord',
                    channelId: msg.channel.id,
                    channelName: msg.channel.name || 'DM',
                    guildId: msg.guild?.id || null,
                    guildName: msg.guild?.name || 'Direct Message',
                    authorId: msg.author.id,
                    authorUsername: msg.author.username,
                    content: msg.content,
                    timestamp: new Date(msg.createdTimestamp).toISOString(),
                    url: msg.url,
                  });
                }
              });
            } catch (channelErr) {
              // Skip channels we can't access
            }
          }
        } catch (guildErr) {
          // Skip guilds the bot isn't in
          console.log(`⚠️ Bot not in guild ${guildId} or can't access it`);
        }
      }
    }

    // Store synced messages
    const existingMessages = discordMessageStore.get(userId) || [];
    const newMessageIds = new Set(syncedMessages.map(m => m.id));
    const filteredExisting = existingMessages.filter(m => !newMessageIds.has(m.id));
    const allMessages = [...syncedMessages, ...filteredExisting].slice(0, 1000);
    discordMessageStore.set(userId, allMessages);

    res.json({
      synced: syncedMessages.length,
      total: allMessages.length,
      message: `Successfully synced ${syncedMessages.length} Discord messages`,
    });
  } catch (err: any) {
    console.error('Discord sync error:', err);
    res.status(500).json({ error: 'Failed to sync Discord messages' });
  }
};

/**
 * Search Discord messages for a user
 */
export function searchDiscordMessages(userId: string, query: string): any[] {
  const messages = discordMessageStore.get(userId) || [];

  if (!query) {
    return messages.slice(0, 50);
  }

  const lowerQuery = query.toLowerCase();
  const queryTerms = lowerQuery.split(/\s+/).filter(t => t.length > 0);

  return messages.filter(msg => {
    const searchText = `${msg.content} ${msg.authorUsername} ${msg.channelName} ${msg.guildName}`.toLowerCase();
    return queryTerms.some(term => searchText.includes(term));
  }).slice(0, 50);
}

/**
 * Check if a user has Discord connected (for internal use)
 */
export function isDiscordConnected(userId: string): boolean {
  return discordTokenStore.has(userId);
}

/**
 * Get Discord connection info for a user
 */
export function getDiscordConnection(userId: string) {
  return discordTokenStore.get(userId);
}
