import { Request, Response } from 'express';
import OpenAI from 'openai';
import { config } from '../config/env';
import { getAllAuthenticatedClients } from './gmailAuth';
import { searchDiscordMessages, isDiscordConnected } from './discordAuth';
import { searchSlackMessages, isSlackConnected } from './slackAuth';
import { google } from 'googleapis';

// Initialize OpenAI client
function getOpenAIClient() {
  if (!config.openai.apiKey) {
    return null;
  }
  return new OpenAI({ apiKey: config.openai.apiKey });
}

// Helper to decode Gmail's URL-safe base64
function decodeGmailBody(data: string): string {
  const normalized = data.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(normalized, 'base64').toString('utf-8');
}

/**
 * Parse user query with OpenAI to extract search terms
 */
async function parseUserQuery(openai: OpenAI, userMessage: string): Promise<{
  names: string[];
  emails: string[];
  topics: string[];
  dateHints: string[];
  keywords: string[];
  partialNames: string[];
}> {
  try {
    const parseResponse = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: `You are a query parser for email search. Extract ALL possible search terms from user queries.
Be generous - if something could be a name or keyword, include it.

Return a JSON object with these fields:
- names: array of full person names mentioned (e.g., "John Smith", "Shyam")
- emails: array of email addresses mentioned (e.g., "john@example.com")
- topics: array of topics/subjects being searched for (e.g., "budget", "meeting", "project")
- dateHints: array of date references (e.g., "last week", "2023", "yesterday", "2 years ago")
- keywords: array of other important search words from the query
- partialNames: array of partial name hints (e.g., if user says "starts with shy" or "name like john", extract "shy", "john")

IMPORTANT: 
- Even if user just says a single name like "Shyam", extract it as a name
- If user says "shy" or mentions partial names, add to partialNames
- Extract ANY word that could help find the email

Example 1: "Shyam"
Output: {"names":["Shyam"],"emails":[],"topics":[],"dateHints":[],"keywords":[],"partialNames":[]}

Example 2: "Find emails from someone named shy or shyam"
Output: {"names":["shyam"],"emails":[],"topics":[],"dateHints":[],"keywords":["emails"],"partialNames":["shy"]}

Example 3: "conversation about budget"
Output: {"names":[],"emails":[],"topics":["budget"],"dateHints":[],"keywords":["conversation"],"partialNames":[]}

Only return valid JSON, no other text.`
        },
        { role: 'user', content: userMessage }
      ],
      temperature: 0,
      max_tokens: 500
    });

    const content = parseResponse.choices[0]?.message?.content || '{}';
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        names: parsed.names || [],
        emails: parsed.emails || [],
        topics: parsed.topics || [],
        dateHints: parsed.dateHints || [],
        keywords: parsed.keywords || [],
        partialNames: parsed.partialNames || []
      };
    }
    return { names: [], emails: [], topics: [], dateHints: [], keywords: [], partialNames: [] };
  } catch (err) {
    console.error('Error parsing query:', err);
    return { names: [], emails: [], topics: [], dateHints: [], keywords: [], partialNames: [] };
  }
}

/**
 * Convert date hints to Gmail date format
 */
function convertDateHint(hint: string): { after?: string; before?: string } {
  const now = new Date();
  const hintLower = hint.toLowerCase();

  if (hintLower.includes('today')) {
    const today = now.toISOString().split('T')[0].replace(/-/g, '/');
    return { after: today };
  }
  if (hintLower.includes('yesterday')) {
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    return { after: yesterday.toISOString().split('T')[0].replace(/-/g, '/') };
  }
  if (hintLower.includes('last week') || hintLower.includes('this week')) {
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return { after: weekAgo.toISOString().split('T')[0].replace(/-/g, '/') };
  }
  if (hintLower.includes('last month') || hintLower.includes('this month')) {
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    return { after: monthAgo.toISOString().split('T')[0].replace(/-/g, '/') };
  }
  if (hintLower.includes('last year') || hintLower.includes('this year')) {
    const yearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
    return { after: yearAgo.toISOString().split('T')[0].replace(/-/g, '/') };
  }

  // Check for "X years ago" or "X months ago"
  const yearsMatch = hintLower.match(/(\d+)\s*years?\s*ago/);
  if (yearsMatch) {
    const years = parseInt(yearsMatch[1]);
    const dateAgo = new Date(now.getTime() - years * 365 * 24 * 60 * 60 * 1000);
    const dateEnd = new Date(dateAgo.getTime() + 365 * 24 * 60 * 60 * 1000);
    return {
      after: dateAgo.toISOString().split('T')[0].replace(/-/g, '/'),
      before: dateEnd.toISOString().split('T')[0].replace(/-/g, '/')
    };
  }

  const monthsMatch = hintLower.match(/(\d+)\s*months?\s*ago/);
  if (monthsMatch) {
    const months = parseInt(monthsMatch[1]);
    const dateAgo = new Date(now.getTime() - months * 30 * 24 * 60 * 60 * 1000);
    return { after: dateAgo.toISOString().split('T')[0].replace(/-/g, '/') };
  }

  // Check for specific year (e.g., "2022", "in 2023")
  const yearMatch = hintLower.match(/\b(20\d{2})\b/);
  if (yearMatch) {
    return {
      after: `${yearMatch[1]}/01/01`,
      before: `${yearMatch[1]}/12/31`
    };
  }

  return {};
}

/**
 * Build Gmail search query from parsed terms
 * Gmail search is powerful - just searching a name will find it in from, to, subject, and body
 */
function buildGmailQuery(parsed: {
  names: string[];
  emails: string[];
  topics: string[];
  dateHints: string[];
  keywords: string[];
  partialNames: string[];
}): string {
  const queryParts: string[] = [];

  // Add email address searches - search both from and to
  for (const email of parsed.emails) {
    queryParts.push(`(from:${email} OR to:${email})`);
  }

  // Add name searches - simple search finds in from, to, subject, body
  // Gmail is smart enough to match "Shyam" in "shyam@gmail.com" or "Shyam Patel"
  for (const name of parsed.names) {
    queryParts.push(name);
  }

  // Add partial name searches with wildcards
  // Gmail doesn't support * wildcard in all cases, but the name itself often works
  for (const partial of parsed.partialNames) {
    queryParts.push(partial);
  }

  // Add topic/keyword searches
  for (const topic of parsed.topics) {
    queryParts.push(topic);
  }

  // Add other keywords (but filter out common words)
  const commonWords = ['email', 'emails', 'find', 'search', 'show', 'get', 'conversation', 'conversations', 'message', 'messages'];
  for (const keyword of parsed.keywords) {
    if (!commonWords.includes(keyword.toLowerCase())) {
      queryParts.push(keyword);
    }
  }

  // Add date filters
  for (const hint of parsed.dateHints) {
    const dates = convertDateHint(hint);
    if (dates.after) queryParts.push(`after:${dates.after}`);
    if (dates.before) queryParts.push(`before:${dates.before}`);
  }

  // Join with spaces - Gmail will search for all terms
  return queryParts.join(' ');
}

/**
 * Search a single Gmail account
 */
async function searchSingleGmailAccount(
  gmail: any,
  accountEmail: string,
  query: string,
  accountIndex: number = 0,
  maxResults: number = 20
): Promise<any[]> {
  try {
    console.log(`🔍 Searching Gmail account ${accountEmail} with query: "${query || '(recent emails)'}"`);

    // Search Gmail with the query (or get recent if no query)
    const response = await gmail.users.messages.list({
      userId: 'me',
      maxResults: 50,
      q: query || undefined
    });

    const messages = response.data.messages || [];
    const fetchedMessages = [];

    // Fetch full message details
    for (const msg of messages.slice(0, maxResults)) {
      try {
        const fullMessage = await gmail.users.messages.get({
          userId: 'me',
          id: msg.id!,
          format: 'full'
        });

        const headers = fullMessage.data.payload?.headers || [];
        const getHeader = (name: string) =>
          headers.find((h: any) => h.name?.toLowerCase() === name.toLowerCase())?.value || '';

        // Get message body with proper decoding
        let body = '';
        const payload = fullMessage.data.payload;
        if (payload?.body?.data) {
          body = decodeGmailBody(payload.body.data);
        } else if (payload?.parts) {
          // Try text/plain first, then text/html
          for (const part of payload.parts) {
            if (part.mimeType === 'text/plain' && part.body?.data) {
              body = decodeGmailBody(part.body.data);
              break;
            }
            if (!body && part.mimeType === 'text/html' && part.body?.data) {
              body = decodeGmailBody(part.body.data);
            }
          }
        }

        fetchedMessages.push({
          id: msg.id,
          subject: getHeader('Subject'),
          from: getHeader('From'),
          to: getHeader('To'),
          date: getHeader('Date'),
          snippet: fullMessage.data.snippet,
          body: body.substring(0, 1500),
          // Use account index in URL to redirect to the correct Gmail account
          url: `https://mail.google.com/mail/u/${accountIndex}/#inbox/${msg.id}`,
          accountEmail, // Add account identifier
          accountIndex // Store account index for reference
        });
      } catch (err) {
        console.error(`Error fetching message ${msg.id} from ${accountEmail}:`, err);
      }
    }

    console.log(`📧 Found ${fetchedMessages.length} matching emails in ${accountEmail}`);
    return fetchedMessages;
  } catch (err) {
    console.error(`Error searching Gmail account ${accountEmail}:`, err);
    return [];
  }
}

/**
 * Search Gmail across all connected accounts for a user
 */
async function searchGmail(userId: string, query: string): Promise<any[]> {
  const accountClients = getAllAuthenticatedClients(userId);
  
  if (accountClients.length === 0) {
    console.log(`⚠️ No Gmail accounts connected for user ${userId}`);
    return [];
  }

  console.log(`🔍 Searching ${accountClients.length} Gmail account(s) for user ${userId}`);

  // Search all accounts in parallel, passing account index for proper URL generation
  const searchPromises = accountClients.map(({ email, client }, index) => {
    const gmail = google.gmail({ version: 'v1', auth: client });
    return searchSingleGmailAccount(gmail, email, query, index, 20);
  });

  try {
    const allResults = await Promise.all(searchPromises);
    
    // Combine all results from all accounts
    const combinedResults = allResults.flat();
    
    // Sort by date (newest first)
    combinedResults.sort((a, b) => {
      const dateA = new Date(a.date || 0).getTime();
      const dateB = new Date(b.date || 0).getTime();
      return dateB - dateA;
    });

    console.log(`📧 Found ${combinedResults.length} total matching emails across ${accountClients.length} account(s)`);
    return combinedResults;
  } catch (err) {
    console.error('Error searching Gmail accounts:', err);
    return [];
  }
}

/**
 * Chat endpoint - processes user message with AI and Gmail search
 * POST /api/chat
 */
export const handleChat = async (req: Request, res: Response) => {
  const { userId, message, platforms = ['gmail'] } = req.body;

  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  if (!message) {
    return res.status(400).json({ error: 'message is required' });
  }

  const openai = getOpenAIClient();
  if (!openai) {
    return res.status(500).json({
      error: 'OpenAI not configured. Please set OPENAI_API_KEY environment variable.',
      response: "I'm sorry, but the AI service is not configured. Please add your OpenAI API key to the backend configuration."
    });
  }

  try {
    let gmailMessages: any[] = [];
    let discordMessages: any[] = [];
    let slackMessages: any[] = [];

    // Parse the user's query to extract search terms
    console.log(`\n📝 User query: "${message}"`);
    console.log(`📱 Platforms requested: ${platforms.join(', ')}`);
    console.log(`👤 User ID: ${userId}`);
    const parsed = await parseUserQuery(openai, message);
    console.log('🔎 Parsed search terms:', JSON.stringify(parsed));

    if (platforms.includes('gmail')) {
      // Build Gmail search query
      const gmailQuery = buildGmailQuery(parsed);
      console.log(`📨 Gmail query: "${gmailQuery}"`);

      // Search Gmail with the query
      gmailMessages = await searchGmail(userId, gmailQuery);

      // If no results with specific query, fall back to recent emails
      if (gmailMessages.length === 0 && gmailQuery) {
        console.log('⚠️ No Gmail results, fetching recent emails as fallback');
        gmailMessages = await searchGmail(userId, '');
      }
    }

    if (platforms.includes('discord')) {
      const discordConnected = isDiscordConnected(userId);
      console.log(`💬 Discord connected for ${userId}: ${discordConnected}`);

      if (discordConnected) {
        // Build Discord search query from parsed terms
        const discordQuery = [
          ...parsed.names,
          ...parsed.topics,
          ...parsed.keywords,
          ...parsed.partialNames
        ].join(' ');
        console.log(`💬 Discord query: "${discordQuery}"`);

        // Search Discord messages
        discordMessages = searchDiscordMessages(userId, discordQuery);
        console.log(`💬 Found ${discordMessages.length} Discord messages`);
      }
    }

    if (platforms.includes('slack')) {
      const slackConnected = isSlackConnected(userId);
      console.log(`📨 Slack connected for ${userId}: ${slackConnected}`);

      if (slackConnected) {
        // Build Slack search query from parsed terms
        const slackQuery = [
          ...parsed.names,
          ...parsed.topics,
          ...parsed.keywords,
          ...parsed.partialNames
        ].join(' ');
        console.log(`📨 Slack query: "${slackQuery}"`);

        // Search Slack messages
        slackMessages = searchSlackMessages(userId, slackQuery);
        console.log(`📨 Found ${slackMessages.length} Slack messages`);
      }
    }

    // Build context from matching emails
    let emailContext = '';
    if (gmailMessages.length > 0) {
      emailContext = gmailMessages.map(m =>
        `[EMAIL] From: ${m.from}\nTo: ${m.to}\nSubject: ${m.subject}\nDate: ${m.date}\nContent: ${m.snippet || m.body?.substring(0, 800)}`
      ).join('\n\n---\n\n');
    }

    // Build context from matching Discord messages
    let discordContext = '';
    if (discordMessages.length > 0) {
      discordContext = discordMessages.map(m =>
        `[DISCORD] Server: ${m.guildName}\nChannel: #${m.channelName}\nFrom: ${m.authorUsername}\nDate: ${m.timestamp}\nMessage: ${m.content}`
      ).join('\n\n---\n\n');
    }

    // Build context from matching Slack messages
    let slackContext = '';
    if (slackMessages.length > 0) {
      slackContext = slackMessages.map(m =>
        `[SLACK] Channel: #${m.channelName}\nDate: ${m.timestamp}\nMessage: ${m.text}`
      ).join('\n\n---\n\n');
    }

    // Combine all context
    const allContext = [emailContext, discordContext, slackContext].filter(Boolean).join('\n\n===\n\n');

    // Create the AI prompt with matched messages
    const systemPrompt = `You are a helpful AI assistant that helps users search and understand their conversations across email and Discord.
You have access to the user's emails and Discord messages that match their search query.
When answering, be specific and cite relevant sources (mention sender, channel/subject, date).
If you found relevant content, summarize what you found.
Clearly indicate whether information comes from email or Discord.
If no messages match what the user is looking for, let them know clearly.

${allContext
        ? `Here are the messages matching the user's search:\n\n${allContext}`
        : 'No matching messages were found for this search.'}`;

    // Step 6: Get AI response
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message }
      ],
      temperature: 0.7,
      max_tokens: 1000
    });

    const aiResponse = completion.choices[0]?.message?.content || "I couldn't generate a response.";

    // Build sources from both Gmail and Discord
    const gmailSources = gmailMessages.slice(0, 5).map(m => ({
      platform: 'gmail',
      title: m.subject || 'Email',
      from: m.from,
      date: m.date,
      url: m.url,
      accountEmail: m.accountEmail // Include account identifier
    }));

    const discordSources = discordMessages.slice(0, 5).map(m => ({
      platform: 'discord',
      title: `#${m.channelName} in ${m.guildName}`,
      from: m.authorUsername,
      date: m.timestamp,
      url: m.url
    }));

    const slackSources = slackMessages.slice(0, 5).map(m => ({
      platform: 'slack',
      title: `#${m.channelName}`,
      from: 'Slack',
      date: m.timestamp,
      url: ''
    }));

    const allSources = [...gmailSources, ...discordSources, ...slackSources];

    // Determine which services had results
    const servicesWithResults: string[] = [];
    if (gmailMessages.length > 0) servicesWithResults.push('gmail');
    if (discordMessages.length > 0) servicesWithResults.push('discord');
    if (slackMessages.length > 0) servicesWithResults.push('slack');

    res.json({
      response: aiResponse,
      sources: allSources,
      connectedServices: servicesWithResults,
      searchResults: {
        gmail: gmailMessages.slice(0, 5), // Always show 1-5 emails
        discord: discordMessages.slice(0, 5),
        slack: slackMessages.slice(0, 5)
      },
      // Add fields for labeling feature
      totalGmailCount: gmailMessages.length,
      allGmailIds: gmailMessages.map(m => m.id), // All email IDs for labeling
      allGmailEmails: gmailMessages.map(m => ({ id: m.id, accountEmail: m.accountEmail, accountIndex: m.accountIndex })), // All emails with account info for labeling
      hasRelevantSources: allSources.length > 0
    });

  } catch (err: any) {
    console.error('Chat error:', err);

    if (err.code === 'invalid_api_key') {
      return res.status(500).json({
        error: 'Invalid OpenAI API key',
        response: "There's an issue with the AI configuration. Please check the OpenAI API key."
      });
    }

    res.status(500).json({
      error: err.message || 'Failed to process chat',
      response: "I encountered an error while processing your request. Please try again."
    });
  }
};

/**
 * Get recent emails endpoint
 * GET /api/memories/recent
 */
export const getRecentEmails = async (req: Request, res: Response) => {
  const { userId, limit = '5' } = req.query;

  if (!userId || typeof userId !== 'string') {
    return res.status(400).json({ error: 'userId is required' });
  }

  try {
    const messages = await searchGmail(userId, '');
    const limitNum = parseInt(limit as string, 10) || 5;

    const recentEmails = messages.slice(0, limitNum).map(m => ({
      id: m.id,
      type: 'gmail',
      platform: 'gmail',
      title: m.subject || 'No Subject',
      snippet: m.snippet || m.body?.substring(0, 200) || '',
      from: m.from,
      date: m.date,
      url: m.url
    }));

    res.json({
      memories: recentEmails,
      total: messages.length
    });
  } catch (err: any) {
    console.error('Error fetching recent emails:', err);
    res.status(500).json({ error: 'Failed to fetch recent emails' });
  }
};
