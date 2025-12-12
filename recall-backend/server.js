// /Users/justinkim/ORANGE/recall-backend/server.js

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { google } = require("googleapis");

const app = express();

// ----------- CONFIG -------------

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!OPENAI_API_KEY) {
  console.warn(
    "⚠️ OPENAI_API_KEY is not set. /api/search-ai will not work until you add it to .env"
  );
}

// Allow multiple frontend origins during development
const allowedOrigins = [
  "http://localhost:8080",
  "http://localhost:8081",
  "http://localhost:8082",
  "http://localhost:8083",
  "http://localhost:8084",
  "http://localhost:8085"
];

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps or curl)
      if (!origin) return callback(null, true);
      if (allowedOrigins.indexOf(origin) !== -1) {
        return callback(null, true);
      }
      return callback(null, true); // Allow all for development
    },
    credentials: true
  })
);

app.use(express.json());

// ----------- MEMORY STORE -------------

// memoryStore[userId] = [ MemoryItem, MemoryItem, ... ]
const memoryStore = {};

/**
 * MemoryItem (for your understanding, not enforced here):
 * {
 *   id: string,
 *   platform: "gmail" | "instagram" | "facebook" | "slack" | "discord",
 *   externalId: string,
 *   userId: string,
 *   title?: string,
 *   text: string,
 *   timestamp: string, // ISO
 *   participants?: string[],
 *   tags?: string[],
 *   url?: string
 * }
 */

function getUserMemories(userId) {
  if (!memoryStore[userId]) {
    memoryStore[userId] = [];
  }
  return memoryStore[userId];
}

function addUserMemories(userId, items) {
  const existing = getUserMemories(userId);
  memoryStore[userId] = existing.concat(items);
}

// ----------- GMAIL OAUTH SETUP -------------

// Store user tokens (in production, use a database)
const userTokens = {};

const GMAIL_CLIENT_ID = process.env.GMAIL_CLIENT_ID;
const GMAIL_CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET;
const GMAIL_REDIRECT_URI = process.env.GMAIL_REDIRECT_URI || "http://localhost:4000/auth/gmail/callback";

const oauth2Client = new google.auth.OAuth2(
  GMAIL_CLIENT_ID,
  GMAIL_CLIENT_SECRET,
  GMAIL_REDIRECT_URI
);

// Gmail scopes we need
const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.metadata'
];

// ----------- BASIC HELPERS -------------

/**
 * Basic keyword-based search over a user's memories.
 * Right now it just matches the raw query string across text/title/participants/tags.
 * We will reuse this in /api/search and /api/search-ai.
 */
function keywordSearch(userId, query) {
  const allItems = getUserMemories(userId);
  const q = query.toLowerCase();

  const scored = allItems
    .map((item) => {
      let score = 0;
      const matchedFields = [];

      if (item.text && item.text.toLowerCase().includes(q)) {
        score += 1;
        matchedFields.push("text");
      }

      if (item.title && item.title.toLowerCase().includes(q)) {
        score += 1;
        matchedFields.push("title");
      }

      if (
        item.participants &&
        item.participants.some((p) => p.toLowerCase().includes(q))
      ) {
        score += 1;
        matchedFields.push("participants");
      }

      if (
        item.tags &&
        item.tags.some((t) => t.toLowerCase().includes(q))
      ) {
        score += 1;
        matchedFields.push("tags");
      }

      return { item, score, matchedFields };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored;
}

// ----------- AI PARSER -------------

/**
 * Uses OpenAI to turn a messy natural query into structured hints.
 * Example output:
 * {
 *   nameHints: ["aliah"],
 *   topicHints: ["finance"],
 *   dateFrom: "2024-01-01T00:00:00.000Z",
 *   dateTo: "2024-12-31T23:59:59.999Z",
 *   platforms: ["gmail", "instagram"]
 * }
 */
async function parseQueryWithAI(rawQuery) {
  if (!OPENAI_API_KEY) {
    return {
      nameHints: [],
      topicHints: [],
      dateFrom: null,
      dateTo: null,
      platforms: [],
      rawFallback: true,
    };
  }

  const systemPrompt = `
You are a JSON-only parser for a memory search system.

Given a user's natural language query like:

- "there was this person aliah, last year we talked about finance"

- "my latest work conversation with John about the pricing deck around last week"

You MUST respond with a single JSON object with this shape:

{
  "nameHints": string[]        // lowercased names or handles, like ["aliah", "john"]
  "topicHints": string[]       // short topic phrases, like ["finance", "pricing deck"]
  "dateFrom": string | null    // ISO 8601 start datetime if there is a clear time range, else null
  "dateTo": string | null      // ISO 8601 end datetime if there is a clear time range, else null
  "platforms": string[]        // optional hints like ["gmail", "slack", "instagram"], can be empty
}

Rules:

- If you are not sure about dates, set both dateFrom and dateTo to null.
- Infer relative time phrases like "last year", "last week", "yesterday" into an approximate range.
- Do NOT add explanatory text. Only output JSON.
`.trim();

  const body = {
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: rawQuery },
    ],
    temperature: 0.1,
  };

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await response.json();

  const content = data.choices?.[0]?.message?.content ?? "{}";

  try {
    const parsed = JSON.parse(content);
    return {
      nameHints: parsed.nameHints ?? [],
      topicHints: parsed.topicHints ?? [],
      dateFrom: parsed.dateFrom ?? null,
      dateTo: parsed.dateTo ?? null,
      platforms: parsed.platforms ?? [],
    };
  } catch (err) {
    console.error("Failed to parse AI JSON:", err, "content was:", content);
    return {
      nameHints: [],
      topicHints: [],
      dateFrom: null,
      dateTo: null,
      platforms: [],
      rawFallback: true,
    };
  }
}

// ----------- AI SCORED SEARCH -------------

/**
 * Uses AI hints to score memories more intelligently.
 * Combines keyword matching with AI-derived hints for better relevance.
 */
function aiScoredSearch(userId, query, parsedHints) {
  const allItems = getUserMemories(userId);
  const q = query.toLowerCase();
  const { nameHints = [], topicHints = [], dateFrom, dateTo } = parsedHints;

  const dFrom = dateFrom ? new Date(dateFrom).getTime() : null;
  const dTo = dateTo ? new Date(dateTo).getTime() : null;

  return allItems
    .map((item) => {
      let score = 0;
      const matchedFields = [];

      const tLow = item.text.toLowerCase();
      const titleLow = (item.title || "").toLowerCase();

      // Base keyword matching (lower weight)
      if (tLow.includes(q) || titleLow.includes(q)) {
        score += 1;
        matchedFields.push("rawText");
      }

      // AI hints boost (higher weight)
      if (
        item.participants &&
        nameHints.some((name) =>
          item.participants.some((p) => p.toLowerCase().includes(name))
        )
      ) {
        score += 3; // Higher boost for name matches
        matchedFields.push("nameHints");
      }

      if (
        item.tags &&
        topicHints.some((topic) =>
          item.tags.some((t) => t.toLowerCase().includes(topic))
        )
      ) {
        score += 2; // Boost for topic matches
        matchedFields.push("topicHints");
      }

      // Date range matching
      if (dFrom && dTo) {
        const ts = new Date(item.timestamp).getTime();
        if (ts >= dFrom && ts <= dTo) {
          score += 2; // Boost for date matches
          matchedFields.push("dateRange");
        } else if (ts < dFrom || ts > dTo) {
          score -= 1; // Penalty for out-of-range dates
        }
      }

      return { item, score, matchedFields };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);
}

// ----------- GMAIL SYNC FUNCTION -------------

async function syncGmailForUser(userId) {
  const tokens = userTokens[userId];
  if (!tokens) {
    throw new Error("User not authenticated with Gmail");
  }

  // Set up authenticated client
  const authClient = new google.auth.OAuth2(
    GMAIL_CLIENT_ID,
    GMAIL_CLIENT_SECRET,
    GMAIL_REDIRECT_URI
  );
  authClient.setCredentials(tokens);

  const gmail = google.gmail({ version: 'v1', auth: authClient });

  try {
    // Get recent emails (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const response = await gmail.users.messages.list({
      userId: 'me',
      q: `after:${Math.floor(thirtyDaysAgo.getTime() / 1000)}`,
      maxResults: 50
    });

    const messages = response.data.messages || [];
    const memoryItems = [];

    for (const message of messages.slice(0, 10)) { // Limit to 10 for demo
      try {
        const messageData = await gmail.users.messages.get({
          userId: 'me',
          id: message.id,
          format: 'metadata',
          metadataHeaders: ['Subject', 'From', 'To', 'Date']
        });

        const headers = messageData.data.payload.headers;
        const subject = headers.find(h => h.name === 'Subject')?.value || 'No Subject';
        const from = headers.find(h => h.name === 'From')?.value || '';
        const date = headers.find(h => h.name === 'Date')?.value || '';

        // Extract sender name from email
        const senderName = from.split('<')[0].trim().replace(/"/g, '') || from.split('@')[0];

        memoryItems.push({
          id: `gmail-${userId}-${message.id}`,
          platform: 'gmail',
          externalId: message.id,
          userId,
          title: subject,
          text: `Email from ${senderName} about: ${subject}`,
          timestamp: new Date(date).toISOString(),
          participants: [senderName],
          tags: ['email'],
          url: `https://mail.google.com/mail/u/0/#inbox/${message.id}`
        });
      } catch (err) {
        console.error(`Error processing message ${message.id}:`, err);
      }
    }

    return memoryItems;
  } catch (error) {
    console.error('Gmail sync error:', error);
    throw error;
  }
}

// ----------- ROUTES -------------

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// Fake "sync" to populate memory for a user
app.post("/api/sync-fake", (req, res) => {
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ error: "userId is required" });
  }

  const now = new Date();
  const fakeItems = [
    {
      id: "mem-1",
      platform: "gmail",
      externalId: "gmail-msg-1",
      userId,
      title: "Re: Finance talk with Aliah",
      text: "Hey, it was great talking about long-term investing and finance last year.",
      timestamp: new Date(now.getTime() - 1000 * 60 * 60 * 24 * 200).toISOString(),
      participants: ["aliah", "justin"],
      tags: ["finance", "investing", "conversation"],
      url: "https://mail.google.com/fake-link-1",
    },
    {
      id: "mem-2",
      platform: "instagram",
      externalId: "ig-dm-1",
      userId,
      title: "DM with Aliah",
      text: "Remember when we first started talking about money mindsets and finance goals?",
      timestamp: new Date(now.getTime() - 1000 * 60 * 60 * 24 * 250).toISOString(),
      participants: ["aliah", "justin"],
      tags: ["finance", "mindset", "relationship"],
      url: "https://instagram.com/fake-convo",
    },
    {
      id: "mem-3",
      platform: "slack",
      externalId: "slack-msg-1",
      userId,
      title: "Work chat about pricing deck",
      text: "John, here's the latest version of the pricing deck we discussed.",
      timestamp: new Date(now.getTime() - 1000 * 60 * 60 * 24 * 7).toISOString(),
      participants: ["john", "justin"],
      tags: ["pricing deck", "work"],
      url: "https://slack.com/fake-work-link",
    },
  ];

  addUserMemories(userId, fakeItems);

  return res.json({
    synced: fakeItems.length,
    userId,
    platforms: [...new Set(fakeItems.map((i) => i.platform))],
  });
});

// Old basic search (still useful for fallback/testing)
app.post("/api/search", (req, res) => {
  const { userId, query } = req.body;

  if (!userId || !query) {
    return res.status(400).json({ error: "userId and query are required" });
  }

  const results = keywordSearch(userId, query);

  return res.json({
    query,
    results,
  });
});

// New AI-powered search: /api/search-ai
app.post("/api/search-ai", async (req, res) => {
  const { userId, query } = req.body;

  if (!userId || !query) {
    return res.status(400).json({ error: "userId and query are required" });
  }

  try {
    // 1) Ask OpenAI to parse the query into hints
    const parsed = await parseQueryWithAI(query);

    // 2) Use AI hints to score memories more intelligently
    const results = aiScoredSearch(userId, query, parsed);

    return res.json({
      rawQuery: query,
      parsed,      // what AI thinks (nameHints, topicHints, dates)
      results,     // AI-boosted scoring
    });
  } catch (err) {
    console.error("Error in /api/search-ai:", err);
    return res.status(500).json({ error: "AI search failed" });
  }
});

// ----------- CHAT ENDPOINT (AI + MCP Server Search) -------------

/**
 * Main chat endpoint that:
 * 1. Parses user query with AI
 * 2. Searches connected services (Gmail, Slack, Discord, etc.)
 * 3. Generates intelligent response with OpenAI
 */
app.post("/api/chat", async (req, res) => {
  const { userId, message, platforms = ['gmail'] } = req.body;

  if (!userId || !message) {
    return res.status(400).json({ error: "userId and message are required" });
  }

  // Check if user has any connected services
  const connectedServices = [];
  if (userTokens[userId]) {
    connectedServices.push('gmail');
  }

  // Get user's memories
  const memories = getUserMemories(userId);

  try {
    // 1) Parse the query to understand intent
    const parsed = await parseQueryWithAI(message);

    // 2) Search through memories
    const searchResults = aiScoredSearch(userId, message, parsed);
    const topResults = searchResults.slice(0, 5);

    // 3) If user has Gmail connected and no local results, try to search Gmail
    let gmailResults = [];
    if (userTokens[userId] && topResults.length < 3) {
      try {
        gmailResults = await searchGmailDirectly(userId, message, parsed);
      } catch (err) {
        console.error("Gmail search error:", err);
      }
    }

    // 4) Generate AI response based on search results
    const aiResponse = await generateAIChatResponse(message, topResults, gmailResults, parsed, connectedServices);

    return res.json({
      response: aiResponse.content,
      sources: aiResponse.sources,
      parsed,
      connectedServices,
      searchResults: topResults.map(r => ({
        platform: r.item.platform,
        title: r.item.title,
        snippet: r.item.text.substring(0, 100),
        timestamp: r.item.timestamp,
        url: r.item.url
      }))
    });
  } catch (err) {
    console.error("Chat error:", err);
    return res.status(500).json({ error: "Chat failed" });
  }
});

/**
 * Search Gmail directly for a query
 */
async function searchGmailDirectly(userId, query, parsed) {
  const tokens = userTokens[userId];
  if (!tokens) return [];

  const authClient = new google.auth.OAuth2(
    GMAIL_CLIENT_ID,
    GMAIL_CLIENT_SECRET,
    GMAIL_REDIRECT_URI
  );
  authClient.setCredentials(tokens);

  const gmail = google.gmail({ version: 'v1', auth: authClient });

  // Build Gmail search query from parsed hints
  let gmailQuery = query;
  if (parsed.nameHints.length > 0) {
    gmailQuery = `from:${parsed.nameHints[0]} OR to:${parsed.nameHints[0]} ${query}`;
  }

  try {
    const response = await gmail.users.messages.list({
      userId: 'me',
      q: gmailQuery,
      maxResults: 10
    });

    const messages = response.data.messages || [];
    const results = [];

    for (const msg of messages.slice(0, 5)) {
      try {
        const fullMsg = await gmail.users.messages.get({
          userId: 'me',
          id: msg.id,
          format: 'full'
        });

        const headers = fullMsg.data.payload?.headers || [];
        const getHeader = (name) => headers.find(h => h.name?.toLowerCase() === name.toLowerCase())?.value || '';

        // Get email body
        let body = '';
        if (fullMsg.data.payload?.body?.data) {
          body = Buffer.from(fullMsg.data.payload.body.data, 'base64').toString('utf-8');
        } else if (fullMsg.data.payload?.parts) {
          const textPart = fullMsg.data.payload.parts.find(p => p.mimeType === 'text/plain');
          if (textPart?.body?.data) {
            body = Buffer.from(textPart.body.data, 'base64').toString('utf-8');
          }
        }

        results.push({
          id: msg.id,
          platform: 'gmail',
          subject: getHeader('Subject'),
          from: getHeader('From'),
          to: getHeader('To'),
          date: getHeader('Date'),
          snippet: fullMsg.data.snippet,
          body: body.substring(0, 500),
          url: `https://mail.google.com/mail/u/0/#inbox/${msg.id}`
        });
      } catch (err) {
        console.error(`Error fetching message ${msg.id}:`, err);
      }
    }

    return results;
  } catch (err) {
    console.error('Gmail search error:', err);
    return [];
  }
}

/**
 * Generate AI chat response based on search results
 */
async function generateAIChatResponse(userMessage, memoryResults, gmailResults, parsed, connectedServices) {
  if (!OPENAI_API_KEY) {
    return {
      content: "I couldn't search your connected services because the OpenAI API key is not configured. Please add OPENAI_API_KEY to your .env file.",
      sources: []
    };
  }

  // Build context from search results
  let context = "";
  const sources = [];

  if (memoryResults.length > 0) {
    context += "## Found in synced memories:\n";
    memoryResults.forEach((r, i) => {
      context += `${i + 1}. [${r.item.platform}] ${r.item.title || 'Untitled'}\n`;
      context += `   From: ${r.item.participants?.join(', ') || 'Unknown'}\n`;
      context += `   Date: ${r.item.timestamp}\n`;
      context += `   Content: ${r.item.text}\n\n`;
      sources.push({
        platform: r.item.platform,
        title: r.item.title,
        url: r.item.url
      });
    });
  }

  if (gmailResults.length > 0) {
    context += "\n## Found in Gmail:\n";
    gmailResults.forEach((r, i) => {
      context += `${i + 1}. Subject: ${r.subject}\n`;
      context += `   From: ${r.from}\n`;
      context += `   Date: ${r.date}\n`;
      context += `   Preview: ${r.snippet}\n\n`;
      sources.push({
        platform: 'gmail',
        title: r.subject,
        url: r.url
      });
    });
  }

  const systemPrompt = `You are RecallJump AI, a helpful assistant that helps users find and recall information from their connected services (Gmail, Slack, Discord, etc.).

Connected services for this user: ${connectedServices.length > 0 ? connectedServices.join(', ') : 'None connected yet'}

Your job is to:
1. Answer the user's question based on the search results provided
2. If results are found, summarize them clearly and helpfully
3. If no results are found, let the user know and suggest they might need to:
   - Connect more services
   - Sync their data
   - Try a different search query
4. Always be helpful and conversational
5. When citing information, mention where it came from (Gmail, Slack, etc.)

${context ? `\n## Search Results:\n${context}` : '\nNo relevant results found in connected services.'}`;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage }
        ],
        temperature: 0.7,
        max_tokens: 1000
      }),
    });

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "I couldn't generate a response. Please try again.";

    return { content, sources };
  } catch (err) {
    console.error("OpenAI API error:", err);
    return {
      content: "Sorry, I encountered an error while processing your request. Please try again.",
      sources: []
    };
  }
}

// ----------- USER AUTH STATUS -------------

// Check user's connected services
app.get("/api/user/status", (req, res) => {
  const userId = req.query.userId || "default-user";

  const connectedServices = [];
  if (userTokens[userId]) {
    connectedServices.push('gmail');
  }

  const memories = getUserMemories(userId);

  res.json({
    userId,
    connectedServices,
    memoriesCount: memories.length,
    isAuthenticated: connectedServices.length > 0
  });
});

// Get user's recent memories
app.get("/api/memories/recent", (req, res) => {
  const userId = req.query.userId || "default-user";
  const limit = parseInt(req.query.limit) || 5;

  const memories = getUserMemories(userId);
  const sorted = memories.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  res.json({
    memories: sorted.slice(0, limit),
    total: memories.length
  });
});

// Disconnect a service
app.post("/api/disconnect/:service", (req, res) => {
  const { service } = req.params;
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ error: "userId is required" });
  }

  if (service === 'gmail') {
    delete userTokens[userId];
    // Optionally clear Gmail memories
    const memories = getUserMemories(userId);
    memoryStore[userId] = memories.filter(m => m.platform !== 'gmail');
  }

  res.json({ success: true, message: `${service} disconnected` });
});

// ----------- GMAIL OAUTH ROUTES -------------

// Start Gmail OAuth flow
app.get("/auth/gmail", (req, res) => {
  const userId = req.query.userId || "default-user";

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: GMAIL_SCOPES,
    state: userId, // Pass userId in state
    prompt: 'consent' // Force refresh token
  });

  res.redirect(authUrl);
});

// Gmail OAuth callback
app.get("/auth/gmail/callback", async (req, res) => {
  const { code, state: userId, error } = req.query;

  // Frontend URL - check environment variable or use default
  const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:8081";

  if (error) {
    console.error('OAuth error:', error);
    return res.redirect(`${FRONTEND_URL}/dashboard?gmail_error=${error}`);
  }

  if (!code) {
    return res.redirect(`${FRONTEND_URL}/dashboard?gmail_error=no_code`);
  }

  try {
    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Store tokens for user
    userTokens[userId] = tokens;

    console.log(`Gmail authenticated for user: ${userId}`);

    // Redirect back to frontend with success
    res.redirect(`${FRONTEND_URL}/dashboard?gmail_connected=true`);
  } catch (error) {
    console.error('OAuth callback error:', error);
    res.redirect(`${FRONTEND_URL}/dashboard?gmail_error=token_exchange_failed`);
  }
});

// Sync Gmail data for authenticated user
app.post("/api/sync-gmail", async (req, res) => {
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ error: "userId is required" });
  }

  if (!userTokens[userId]) {
    return res.status(401).json({
      error: "User not authenticated with Gmail",
      authUrl: `/auth/gmail?userId=${userId}`
    });
  }

  try {
    const memoryItems = await syncGmailForUser(userId);
    addUserMemories(userId, memoryItems);

    return res.json({
      synced: memoryItems.length,
      userId,
      platforms: ['gmail'],
      message: `Successfully synced ${memoryItems.length} Gmail messages`
    });
  } catch (error) {
    console.error('Gmail sync error:', error);
    return res.status(500).json({ error: 'Failed to sync Gmail' });
  }
});

// ----------- START SERVER -------------

const PORT = process.env.PORT || 4000;
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:8081";

app.listen(PORT, () => {
  console.log(`\n🚀 Backend running on http://localhost:${PORT}`);
  console.log(`📱 Frontend expected at ${FRONTEND_URL}\n`);

  if (!GMAIL_CLIENT_ID || !GMAIL_CLIENT_SECRET) {
    console.log('⚠️  Gmail OAuth not configured!');
    console.log('   To enable Gmail integration:');
    console.log('   1. Go to https://console.cloud.google.com/apis/credentials');
    console.log('   2. Create OAuth 2.0 credentials');
    console.log('   3. Add this redirect URI: http://localhost:4000/auth/gmail/callback');
    console.log('   4. Set GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET in .env\n');
  } else {
    console.log('✅ Gmail OAuth configured');
    console.log(`   Redirect URI: ${GMAIL_REDIRECT_URI}`);
    console.log('   Make sure this URI is added in Google Cloud Console!\n');
  }
});
