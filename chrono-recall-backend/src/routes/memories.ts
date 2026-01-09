import { Request, Response } from 'express';
import { getAllAuthenticatedClients } from './gmailAuth';
import { google } from 'googleapis';
import OpenAI from 'openai';
import { config } from '../config/env';

const openai = new OpenAI({ apiKey: config.openai.apiKey });

type MemoryType = 'Decision' | 'Risk' | 'Open Question' | 'Commitment' | 'Insight';

interface Memory {
  id: string;
  type: MemoryType;
  title: string;
  summary: string;
  importance: number;
  unresolved: boolean;
  sourceEmail?: string;
  sourceDate?: string;
  highlightedQuotes?: string[];
  gmailUrl?: string;
}

/**
 * Analyze email content and extract meaningful memories
 */
async function analyzeEmailForMemories(
  subject: string,
  body: string,
  from: string,
  date: string,
  emailId: string
): Promise<Memory[]> {
  // Only analyze emails that seem meaningful (not automated/notification emails)
  if (body.length < 50 || subject.toLowerCase().includes('notification') || 
      subject.toLowerCase().includes('automated') || subject.toLowerCase().includes('no-reply')) {
    return [];
  }

  const prompt = `Analyze this email and extract meaningful memories that actually matter. Focus on:
- Decisions made or pending
- Risks identified or potential issues
- Open questions that need answers
- Commitments made (by sender or requested)
- Insights or important learnings

IMPORTANT: Only extract memories that are truly significant. Skip routine notifications, automated messages, or trivial content.

Email Subject: ${subject}
From: ${from}
Date: ${date}
Body: ${body.substring(0, 2000)}

Return up to 3 memories as JSON array. Each memory should have:
- type: one of "Decision", "Risk", "Open Question", "Commitment", "Insight"
- title: concise idea-level title (max 60 chars, NO sender name, focus on what matters)
- summary: why this mattered or what makes it important (max 150 chars)
- importance: 1-10 scale (be conservative, only high values for truly critical items)
- unresolved: boolean (true if action needed or question unanswered)
- highlightedQuotes: array of 1-2 key quotes from email (max 100 chars each)

If no meaningful memories found, return empty array: []

Format: [{"type": "...", "title": "...", "summary": "...", "importance": 8, "unresolved": true, "highlightedQuotes": ["..."]}]`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 800,
    });

    const response = completion.choices[0]?.message?.content || '[]';
    // Clean up response - remove markdown code blocks if present
    const cleanedResponse = response.replace(/```json\n?|\n?```/g, '').trim();
    const memories: Partial<Memory>[] = JSON.parse(cleanedResponse);

    if (!Array.isArray(memories)) {
      return [];
    }

    return memories
      .filter(m => m.type && m.title && m.summary && m.importance)
      .map((m, idx) => ({
        id: `${emailId}-memory-${idx}`,
        type: m.type as MemoryType,
        title: (m.title as string).trim(),
        summary: (m.summary as string).trim(),
        importance: m.importance || 5,
        unresolved: m.unresolved ?? false,
        sourceEmail: from,
        sourceDate: date,
        highlightedQuotes: (m.highlightedQuotes || []).map((q: string) => q.trim()).filter((q: string) => q.length > 0),
        gmailUrl: `https://mail.google.com/mail/u/0/#inbox/${emailId}`,
      }))
      .filter(m => m.importance >= 5); // Only keep memories with importance >= 5
  } catch (err) {
    console.error('Error analyzing email for memories:', err);
    return [];
  }
}

/**
 * Extract plain text from email body (handle HTML emails)
 */
function extractPlainText(body: string): string {
  // Remove HTML tags if present
  const htmlRemoved = body.replace(/<[^>]*>/g, ' ');
  // Decode HTML entities
  const decoded = htmlRemoved
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  // Clean up whitespace
  return decoded.replace(/\s+/g, ' ').trim();
}

/**
 * GET /api/memories/signals
 * Get AI-generated memory signals, ranked by importance
 */
export const getMemorySignals = async (req: Request, res: Response) => {
  const { userId, limit = '5' } = req.query;

  if (!userId || typeof userId !== 'string') {
    return res.status(400).json({ error: 'userId is required' });
  }

  try {
    const accountClients = getAllAuthenticatedClients(userId);

    if (accountClients.length === 0) {
      return res.json({ memories: [], total: 0 });
    }

    const allMemories: Memory[] = [];

    // Fetch recent emails from all accounts
    for (const { email: accountEmail, client } of accountClients) {
      try {
        const gmail = google.gmail({ version: 'v1', auth: client });
        
        // Fetch recent messages (last 7 days, limit to avoid too many API calls)
        const response = await gmail.users.messages.list({
          userId: 'me',
          maxResults: 30,
          q: 'newer_than:7d -is:spam -is:trash', // Last 7 days, exclude spam/trash
        });

        const messages = response.data.messages || [];
        console.log(`📧 Processing ${messages.length} emails from ${accountEmail}...`);

        // Process emails in batches to avoid rate limits
        const batchSize = 5;
        for (let i = 0; i < Math.min(messages.length, 20); i += batchSize) {
          const batch = messages.slice(i, i + batchSize);
          
          await Promise.all(batch.map(async (msg) => {
            try {
              const fullMessage = await gmail.users.messages.get({
                userId: 'me',
                id: msg.id!,
                format: 'full',
              });

              const headers = fullMessage.data.payload?.headers || [];
              const getHeader = (name: string) =>
                headers.find((h: any) => h.name?.toLowerCase() === name.toLowerCase())?.value || '';

              const subject = getHeader('Subject') || 'No Subject';
              const from = getHeader('From') || '';
              const date = getHeader('Date') || '';

              // Extract body text
              let body = '';
              const extractBody = (part: any): string => {
                if (part.mimeType === 'text/plain' && part.body?.data) {
                  return Buffer.from(part.body.data, 'base64').toString('utf-8');
                }
                if (part.mimeType === 'text/html' && part.body?.data) {
                  const html = Buffer.from(part.body.data, 'base64').toString('utf-8');
                  return extractPlainText(html);
                }
                if (part.parts) {
                  return part.parts.map(extractBody).join(' ');
                }
                return '';
              };
              
              body = extractBody(fullMessage.data.payload || {});
              
              if (!body || body.length < 50) {
                return; // Skip emails with no meaningful content
              }

              // Analyze email for memories
              const memories = await analyzeEmailForMemories(
                subject,
                body,
                from,
                date,
                msg.id!
              );

              if (memories.length > 0) {
                allMemories.push(...memories);
              }
            } catch (err) {
              console.error(`Error processing message ${msg.id}:`, err);
            }
          }));

          // Small delay between batches to avoid rate limits
          if (i + batchSize < messages.length) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }
      } catch (err) {
        console.error(`Error fetching messages from ${accountEmail}:`, err);
      }
    }

    // Rank memories by importance, unresolved status, and potential impact
    const ranked = allMemories.sort((a, b) => {
      // Unresolved items first
      if (a.unresolved !== b.unresolved) {
        return a.unresolved ? -1 : 1;
      }
      // Then by importance (higher first)
      return b.importance - a.importance;
    });

    // Remove duplicates (same title + type)
    const uniqueMemories: Memory[] = [];
    const seen = new Set<string>();
    for (const memory of ranked) {
      const key = `${memory.type}-${memory.title.toLowerCase()}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueMemories.push(memory);
      }
    }

    const limitNum = parseInt(limit as string, 10) || 5;
    // Only return memories if they're truly important (importance >= 6)
    const topMemories = uniqueMemories
      .filter(m => m.importance >= 6)
      .slice(0, limitNum);

    console.log(`✅ Generated ${topMemories.length} memory signals from ${allMemories.length} total memories`);

    res.json({
      memories: topMemories,
      total: uniqueMemories.length,
    });
  } catch (err: any) {
    console.error('Error fetching memory signals:', err);
    res.status(500).json({ error: 'Failed to fetch memory signals' });
  }
};

