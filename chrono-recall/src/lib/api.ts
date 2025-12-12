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

export async function connectGmail(userId: string = DEFAULT_USER_ID) {
  // Redirect to Gmail OAuth
  window.location.href = `${BACKEND_URL}/auth/gmail?userId=${userId}`;
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

  return res.json(); // { userId, connectedServices, memoriesCount, isAuthenticated }
}

// Get recent memories
export async function getRecentMemories(userId: string = DEFAULT_USER_ID, limit: number = 5) {
  const res = await fetch(`${BACKEND_URL}/api/memories/recent?userId=${userId}&limit=${limit}`);

  if (!res.ok) {
    throw new Error("Failed to get recent memories");
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
