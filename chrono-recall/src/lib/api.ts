// /Users/justinkim/ORANGE/chrono-recall/src/lib/api.ts

// Backend URL - can be configured via environment variable
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:4000";

// Default user ID (in production, this would come from auth)
const DEFAULT_USER_ID = "justin";

export async function syncFake(userId: string = DEFAULT_USER_ID) {
  const res = await fetch(`${BACKEND_URL}/api/sync-fake`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ userId }),
  });

  if (!res.ok) {
    throw new Error("Sync failed");
  }

  return res.json();
}

export async function searchMemories(userId: string = DEFAULT_USER_ID, query: string) {
  const res = await fetch(`${BACKEND_URL}/api/search-ai`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ userId, query }),
  });

  if (!res.ok) {
    throw new Error("Search failed");
  }

  return res.json(); // { rawQuery, parsed, results }
}

export async function connectGmail(userId: string = DEFAULT_USER_ID, addAccount: boolean = false) {
  // Redirect to Gmail OAuth with add_account flag
  const url = new URL(`${BACKEND_URL}/auth/gmail`);
  url.searchParams.set('userId', userId);
  if (addAccount) {
    url.searchParams.set('add_account', 'true');
  }
  window.location.href = url.toString();
}

export async function connectDiscord(userId: string = DEFAULT_USER_ID) {
  // Redirect to Discord OAuth
  window.location.href = `${BACKEND_URL}/auth/discord?userId=${userId}`;
}

export async function getDiscordStatus(userId: string = DEFAULT_USER_ID) {
  const res = await fetch(`${BACKEND_URL}/auth/discord/status?userId=${userId}`);

  if (!res.ok) {
    throw new Error("Failed to get Discord status");
  }

  return res.json();
}

export async function getDiscordBotInvite() {
  const res = await fetch(`${BACKEND_URL}/auth/discord/bot-invite`);

  if (!res.ok) {
    throw new Error("Failed to get bot invite link");
  }

  return res.json();
}

export async function syncDiscord(userId: string = DEFAULT_USER_ID) {
  const res = await fetch(`${BACKEND_URL}/api/sync-discord`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ userId }),
  });

  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.error || "Discord sync failed");
  }

  return res.json();
}

export async function disconnectDiscord(userId: string = DEFAULT_USER_ID) {
  const res = await fetch(`${BACKEND_URL}/auth/discord/disconnect`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ userId }),
  });

  if (!res.ok) {
    throw new Error("Failed to disconnect Discord");
  }

  return res.json();
}

// Slack API functions
export async function connectSlack(userId: string = DEFAULT_USER_ID) {
  // Redirect to Slack OAuth
  window.location.href = `${BACKEND_URL}/auth/slack?userId=${userId}`;
}

export async function getSlackStatus(userId: string = DEFAULT_USER_ID) {
  const res = await fetch(`${BACKEND_URL}/auth/slack/status?userId=${userId}`);

  if (!res.ok) {
    throw new Error("Failed to get Slack status");
  }

  return res.json();
}

export async function syncSlack(userId: string = DEFAULT_USER_ID) {
  const res = await fetch(`${BACKEND_URL}/api/sync-slack`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ userId }),
  });

  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.error || "Slack sync failed");
  }

  return res.json();
}

export async function disconnectSlack(userId: string = DEFAULT_USER_ID) {
  const res = await fetch(`${BACKEND_URL}/auth/slack/disconnect`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ userId }),
  });

  if (!res.ok) {
    throw new Error("Failed to disconnect Slack");
  }

  return res.json();
}

export async function syncGmail(userId: string = DEFAULT_USER_ID) {
  const res = await fetch(`${BACKEND_URL}/api/sync-gmail`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ userId }),
  });

  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.error || "Gmail sync failed");
  }

  return res.json();
}

// Chat with AI - searches connected services
export async function sendChatMessage(
  userId: string = DEFAULT_USER_ID,
  message: string,
  platforms: string[] = ['gmail']
) {
  const res = await fetch(`${BACKEND_URL}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ userId, message, platforms }),
  });

  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.error || "Chat failed");
  }

  return res.json(); // { response, sources, parsed, connectedServices, searchResults }
}

// Get user status (connected services, memory count)
export async function getUserStatus(userId: string = DEFAULT_USER_ID) {
  const res = await fetch(`${BACKEND_URL}/api/user/status?userId=${userId}`);

  if (!res.ok) {
    throw new Error("Failed to get user status");
  }

  return res.json(); // { userId, connectedServices, gmailAccountCount, gmailAccounts, memoriesCount, isAuthenticated }
}

// Get Gmail status (all connected accounts)
export async function getGmailStatus(userId: string = DEFAULT_USER_ID) {
  const res = await fetch(`${BACKEND_URL}/auth/gmail/status?userId=${userId}`);

  if (!res.ok) {
    throw new Error("Failed to get Gmail status");
  }

  return res.json(); // { connected, accountCount, accounts: [{ email, name, connectedAt }] }
}

// Disconnect specific Gmail account
export async function disconnectGmailAccount(userId: string = DEFAULT_USER_ID, emailId?: string) {
  const res = await fetch(`${BACKEND_URL}/auth/gmail/disconnect`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ userId, emailId }),
  });

  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.error || "Failed to disconnect Gmail account");
  }

  return res.json();
}

// Get recent memories
export async function getRecentMemories(userId: string = DEFAULT_USER_ID, limit: number = 5) {
  const res = await fetch(`${BACKEND_URL}/api/memories/recent?userId=${userId}&limit=${limit}`);

  if (!res.ok) {
    throw new Error("Failed to get recent memories");
  }

  return res.json(); // { memories, total }
}

// Get memory signals (AI-generated memory abstractions)
export async function getMemorySignals(userId: string = DEFAULT_USER_ID, limit: number = 5) {
  const res = await fetch(`${BACKEND_URL}/api/memories/signals?userId=${userId}&limit=${limit}`);

  if (!res.ok) {
    throw new Error("Failed to get memory signals");
  }

  return res.json(); // { memories, total }
}

// Disconnect a service
export async function disconnectService(userId: string = DEFAULT_USER_ID, service: string) {
  const res = await fetch(`${BACKEND_URL}/api/disconnect/${service}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ userId }),
  });

  if (!res.ok) {
    throw new Error(`Failed to disconnect ${service}`);
  }

  return res.json();
}

// Label emails in Gmail
export async function labelEmails(
  userId: string = DEFAULT_USER_ID,
  labelName: string,
  emailIds: string[]
) {
  const res = await fetch(`${BACKEND_URL}/api/label-emails`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ userId, labelName, emailIds }),
  });

  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.error || "Failed to label emails");
  }

  return res.json();
}
