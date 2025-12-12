import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { config } from './config/env';

// Import route handlers
import { getHealth } from './routes/health';
import { devLogin } from './routes/auth';
import { getIntegrations } from './routes/integrations';
import {
  initiateGmailAuth,
  handleGmailCallback,
  getGmailStatus,
  syncGmailMessages,
  disconnectGmail,
  isGmailConnected
} from './routes/gmailAuth';
import {
  initiateDiscordAuth,
  handleDiscordCallback,
  getDiscordStatus,
  getBotInviteLink,
  disconnectDiscord,
  syncDiscordMessages,
  isDiscordConnected,
  initializeDiscordBot
} from './routes/discordAuth';
import { handleChat, getRecentEmails } from './routes/chat';

const app = express();

// Middleware
app.use(helmet()); // Security headers
app.use(cors({
  origin: config.frontendUrl, // Allow requests from your Vite dev server
  credentials: true
}));
app.use(morgan('combined')); // Request logging
app.use(express.json()); // Parse JSON bodies

// Health check
app.get('/health', getHealth);

// Auth routes
app.post('/auth/dev-login', devLogin);

// Gmail OAuth routes
app.get('/auth/gmail', initiateGmailAuth);
app.get('/auth/gmail/callback', handleGmailCallback);
app.get('/auth/gmail/status', getGmailStatus);
app.post('/auth/gmail/disconnect', disconnectGmail);

// Discord OAuth routes
app.get('/auth/discord', initiateDiscordAuth);
app.get('/auth/discord/callback', handleDiscordCallback);
app.get('/auth/discord/status', getDiscordStatus);
app.get('/auth/discord/bot-invite', getBotInviteLink);
app.post('/auth/discord/disconnect', disconnectDiscord);

// Integration routes
app.get('/integrations', getIntegrations);

// Gmail sync route
app.post('/api/sync-gmail', syncGmailMessages);

// Discord sync route
app.post('/api/sync-discord', syncDiscordMessages);

// Chat endpoint - AI-powered chat with email context
app.post('/api/chat', handleChat);

// Recent emails/memories endpoint
app.get('/api/memories/recent', getRecentEmails);

// User status endpoint - returns connected services
app.get('/api/user/status', (req, res) => {
  const { userId } = req.query;

  if (!userId || typeof userId !== 'string') {
    return res.status(400).json({ error: 'userId is required' });
  }

  const connectedServices: string[] = [];

  if (isGmailConnected(userId)) {
    connectedServices.push('gmail');
  }

  if (isDiscordConnected(userId)) {
    connectedServices.push('discord');
  }

  res.json({
    userId,
    connectedServices,
    memoriesCount: 0, // Can be extended later
    isAuthenticated: connectedServices.length > 0
  });
});

// Legacy routes for frontend compatibility
app.post('/api/sync-fake', async (req, res) => {
  const { userId } = req.body;
  // Return mock data for testing
  res.json({
    synced: 5,
    platforms: ['gmail', 'slack'],
    message: 'Mock data synced'
  });
});

app.post('/api/search-ai', async (req, res) => {
  const { userId, query } = req.body;
  // Return mock search results
  res.json({
    rawQuery: query,
    parsed: {
      nameHints: [],
      topicHints: [],
      dateFrom: null,
      dateTo: null
    },
    results: []
  });
});

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Start server
app.listen(config.port, async () => {
  console.log(`🚀 Chrono Recall Backend running on http://localhost:${config.port}`);
  console.log(`📱 Frontend should connect from ${config.frontendUrl}`);

  // Check if Gmail OAuth is configured
  if (!config.google.clientId || !config.google.clientSecret) {
    console.log('\n⚠️  Gmail OAuth not configured!');
    console.log('   Set these environment variables:');
    console.log('   - GOOGLE_CLIENT_ID');
    console.log('   - GOOGLE_CLIENT_SECRET');
    console.log('   - GOOGLE_REDIRECT_URI (optional, defaults to http://localhost:4000/auth/gmail/callback)\n');
  } else {
    console.log('✅ Gmail OAuth configured');
    console.log(`   Redirect URI: ${config.google.redirectUri}`);
  }

  // Check if Discord is configured
  if (!config.discord.clientId || !config.discord.clientSecret) {
    console.log('\n⚠️  Discord OAuth not configured!');
    console.log('   Set these environment variables:');
    console.log('   - DISCORD_CLIENT_ID');
    console.log('   - DISCORD_CLIENT_SECRET');
    console.log('   - DISCORD_BOT_TOKEN');
    console.log('   - DISCORD_REDIRECT_URI (optional, defaults to http://localhost:4000/auth/discord/callback)\n');
  } else {
    console.log('✅ Discord OAuth configured');
    console.log(`   Redirect URI: ${config.discord.redirectUri}`);

    // Initialize Discord bot if token is provided
    if (config.discord.botToken) {
      console.log('🤖 Starting Discord bot...');
      await initializeDiscordBot();
    } else {
      console.log('⚠️  Discord bot token not set, bot will not start');
    }
  }
});
