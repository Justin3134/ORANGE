import dotenv from 'dotenv';
dotenv.config();

/**
 * Environment configuration with validation and defaults.
 * Centralizes all environment variable access and provides type safety.
 */
export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  // Frontend URL for redirects
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:8080',
  backendUrl: process.env.BACKEND_URL || 'http://localhost:4000',

  // Google OAuth Configuration
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    redirectUri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:4000/auth/gmail/callback',
  },

  // Discord OAuth + Bot Configuration
  discord: {
    clientId: process.env.DISCORD_CLIENT_ID || '',
    clientSecret: process.env.DISCORD_CLIENT_SECRET || '',
    redirectUri: process.env.DISCORD_REDIRECT_URI || 'http://localhost:4000/auth/discord/callback',
    botToken: process.env.DISCORD_BOT_TOKEN || '',
    botPermissions: process.env.DISCORD_BOT_PERMISSIONS || '537259072', // Read messages + history
  },

  // Slack OAuth + Bot Configuration
  slack: {
    clientId: process.env.SLACK_CLIENT_ID || '',
    clientSecret: process.env.SLACK_CLIENT_SECRET || '',
    signingSecret: process.env.SLACK_SIGNING_SECRET || '',
    redirectUri: process.env.SLACK_REDIRECT_URI || 'http://localhost:4000/auth/slack/callback',
  },

  // OpenAI Configuration
  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
  }
} as const;
