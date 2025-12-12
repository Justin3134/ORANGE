import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { User, ChevronRight, Sparkles, Filter, Search, Brain } from "lucide-react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { syncFake, searchMemories, connectGmail, connectDiscord, syncGmail, getUserStatus, getRecentMemories } from "@/lib/api";
import {
  SIDEBAR_ITEMS,
  TYPE_COLORS,
  SYNC_INTEGRATIONS,
} from "@/config/constants";
import { Mail } from "lucide-react";
import { useUser } from "@/contexts/UserContext";
import { toast } from "sonner";

const Dashboard = () => {
  const { user, login } = useUser();
  const [searchParams] = useSearchParams();
  const userId = user?.id || 'guest';

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedResult, setSelectedResult] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [aiParsed, setAiParsed] = useState<any>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSyncedData, setHasSyncedData] = useState(false);
  const [connectedPlatforms, setConnectedPlatforms] = useState<string[]>([]);
  const [gmailConnected, setGmailConnected] = useState(false);
  const [recentMemories, setRecentMemories] = useState<any[]>([]);
  const [isLoadingMemories, setIsLoadingMemories] = useState(false);
  const location = useLocation();

  // Fetch recent memories when connected
  const fetchRecentMemories = async () => {
    setIsLoadingMemories(true);
    try {
      const data = await getRecentMemories(userId, 5);
      setRecentMemories(data.memories || []);
    } catch (err) {
      console.error("Failed to fetch recent memories:", err);
    } finally {
      setIsLoadingMemories(false);
    }
  };

  // Handle OAuth callback - auto-login user
  useEffect(() => {
    const gmailConnectedParam = searchParams.get('gmail_connected');
    const discordConnectedParam = searchParams.get('discord_connected');
    const slackConnectedParam = searchParams.get('slack_connected');
    const email = searchParams.get('email');
    const name = searchParams.get('name');

    if ((gmailConnectedParam === 'true' || discordConnectedParam === 'true' || slackConnectedParam === 'true') && email) {
      // Auto-login the user from OAuth
      login(email, name || undefined);
      const service = gmailConnectedParam ? 'Gmail' : discordConnectedParam ? 'Discord' : 'Slack';
      toast.success(`Successfully connected ${service}!`);

      if (gmailConnectedParam) {
        setGmailConnected(true);
        setConnectedPlatforms(prev => [...new Set([...prev, 'gmail'])]);
        setHasSyncedData(true);
      }
      if (discordConnectedParam) {
        setConnectedPlatforms(prev => [...new Set([...prev, 'discord'])]);
        setHasSyncedData(true);
      }
      if (slackConnectedParam) {
        setConnectedPlatforms(prev => [...new Set([...prev, 'slack'])]);
        setHasSyncedData(true);
      }

      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [searchParams, login]);

  // Check user status on mount
  useEffect(() => {
    const checkStatus = async () => {
      if (userId === 'guest') return;

      try {
        const status = await getUserStatus(userId);
        if (status.connectedServices?.includes('gmail')) {
          setGmailConnected(true);
          setConnectedPlatforms(prev => [...new Set([...prev, 'gmail'])]);
          setHasSyncedData(true);
          fetchRecentMemories();
        }
        if (status.connectedServices?.includes('discord')) {
          setConnectedPlatforms(prev => [...new Set([...prev, 'discord'])]);
          setHasSyncedData(true);
        }
        if (status.connectedServices?.includes('slack')) {
          setConnectedPlatforms(prev => [...new Set([...prev, 'slack'])]);
          setHasSyncedData(true);
        }
      } catch (err) {
        console.error("Failed to get user status:", err);
      }
    };
    checkStatus();
  }, [userId]);

  // Function to search the backend with AI
  const handleSearch = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      setAiParsed(null);
      return;
    }

    setIsSearching(true);
    try {
      const data = await searchMemories(userId, query);
      console.log("AI Search results:", data);

      // Store AI parsing results
      setAiParsed(data.parsed);

      // Transform results for UI
      const transformedResults = (data.results || []).map(result => ({
        id: result.item.id,
        platform: result.item.platform,
        title: result.item.title || `${result.item.platform} message`,
        snippet: result.item.text,
        timestamp: result.item.timestamp,
        source: result.item.platform,
        url: result.item.url,
        score: result.score,
        matchedFields: result.matchedFields
      }));
      setSearchResults(transformedResults);
    } catch (error) {
      console.error("Search error:", error);
    } finally {
      setIsSearching(false);
    }
  };

  // Handle search input changes and trigger search
  const handleSearchInput = (value: string) => {
    setSearchQuery(value);
    handleSearch(value);
  };

  return (
    <div className="min-h-screen bg-background dark flex">
      {/* Ambient Background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/4 right-0 w-[600px] h-[600px] bg-primary/3 rounded-full blur-[150px]" />
        <div className="absolute bottom-0 left-1/4 w-[500px] h-[500px] bg-[hsl(199,89%,48%)]/3 rounded-full blur-[120px]" />
      </div>

      {/* Sidebar */}
      <motion.aside
        initial={{ x: -100, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        className="w-16 lg:w-64 glass-sidebar flex flex-col fixed left-0 top-0 bottom-0 z-40"
      >
        {/* Logo */}
        <div className="p-4 border-b border-border">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-[hsl(199,89%,48%)] flex items-center justify-center shrink-0 shadow-lg shadow-primary/25">
              <Sparkles className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-lg font-semibold text-foreground hidden lg:block">RecallJump</span>
          </Link>
        </div>

        {/* Nav Items */}
        <nav className="flex-1 p-3 space-y-1">
          {SIDEBAR_ITEMS.map((item) => {
            const isActive = location.pathname === item.path ||
              (item.path === "/dashboard" && location.pathname === "/dashboard");

            return (
              <Link key={item.label} to={item.path}>
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  )}
                >
                  <item.icon className="w-5 h-5 shrink-0" />
                  <span className="hidden lg:block">{item.label}</span>
                </motion.div>
              </Link>
            );
          })}
        </nav>

        {/* User */}
        <div className="p-3 border-t border-border">
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-secondary transition-colors cursor-pointer">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-[hsl(199,89%,48%)] flex items-center justify-center shrink-0">
              <User className="w-4 h-4 text-primary-foreground" />
            </div>
            <div className="hidden lg:block">
              <p className="text-sm font-medium text-foreground">{user?.name || 'User'}</p>
              <p className="text-xs text-muted-foreground">Free Plan</p>
            </div>
          </div>
        </div>
      </motion.aside>

      {/* Main Content */}
      <main className="flex-1 ml-16 lg:ml-64">
        {/* Top Bar */}
        <motion.header
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="sticky top-0 z-30 glass-nav px-6 py-4"
        >
          <div className="flex items-center gap-4 max-w-4xl mx-auto">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                variant="search"
                placeholder={hasSyncedData ? "Ask about your memories..." : "Connect accounts to search your memories..."}
                value={searchQuery}
                onChange={(e) => handleSearchInput(e.target.value)}
                className="w-full"
                disabled={!hasSyncedData}
              />
            </div>
            <Button
              variant="glass"
              size="sm"
              className="shrink-0 mr-2"
              onClick={async () => {
                try {
                  const data = await syncFake(userId);
                  console.log("Synced data:", data);
                  setHasSyncedData(true);
                  alert(`Synced ${data.synced} memories from ${data.platforms.join(", ")}`);
                } catch (error) {
                  console.error("Sync error:", error);
                }
              }}
            >
              Sync Data
            </Button>
            <Button variant="glass" size="icon" className="shrink-0">
              <Filter className="w-5 h-5" />
            </Button>
          </div>
        </motion.header>

        {/* Results */}
        <div className="p-6 max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="mb-6"
          >
            <h2 className="text-sm font-medium text-muted-foreground">
              {searchResults.length > 0
                ? `Search Results ${isSearching ? '(Searching...)' : ''}`
                : hasSyncedData
                  ? 'Recent Memories'
                  : 'Get Started'
              }
            </h2>

            {/* AI Parsing Results */}
            {aiParsed && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-3 p-4 bg-primary/5 rounded-lg border border-primary/20"
              >
                <div className="flex items-center gap-2 mb-2">
                  <Brain className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium">AI Understanding</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  {aiParsed.nameHints.length > 0 && (
                    <div>
                      <span className="font-medium">Names:</span> {aiParsed.nameHints.join(", ")}
                    </div>
                  )}
                  {aiParsed.topicHints.length > 0 && (
                    <div>
                      <span className="font-medium">Topics:</span> {aiParsed.topicHints.join(", ")}
                    </div>
                  )}
                  {(aiParsed.dateFrom || aiParsed.dateTo) && (
                    <div className="md:col-span-2">
                      <span className="font-medium">Time Range:</span>{" "}
                      {aiParsed.dateFrom ? new Date(aiParsed.dateFrom).toLocaleDateString() : "Any"}
                      {" → "}
                      {aiParsed.dateTo ? new Date(aiParsed.dateTo).toLocaleDateString() : "Any"}
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* Connection Panel - Show when no data synced */}
            {!hasSyncedData && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="mt-8"
              >
                <h3 className="text-lg font-semibold mb-4">Connect Your Accounts</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {SYNC_INTEGRATIONS.map((integration, i) => (
                    <motion.div
                      key={integration.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 + i * 0.05 }}
                      className="glass-card p-4"
                    >
                      <div className="flex items-center gap-4">
                        <div className={cn(
                          "w-12 h-12 rounded-xl flex items-center justify-center",
                          connectedPlatforms.includes(integration.id)
                            ? "bg-primary/20 text-primary"
                            : "bg-secondary text-muted-foreground"
                        )}>
                          <integration.icon className="w-6 h-6" />
                        </div>

                        <div className="flex-1">
                          <h4 className="font-semibold text-foreground">{integration.name}</h4>
                          <p className="text-sm text-muted-foreground">{integration.description}</p>
                        </div>

                        <Button
                          variant={connectedPlatforms.includes(integration.id) ? "secondary" : "default"}
                          size="sm"
                          onClick={async () => {
                            if (integration.id === 'gmail') {
                              if (connectedPlatforms.includes('gmail')) {
                                // Gmail sync
                                try {
                                  const data = await syncGmail(userId);
                                  setHasSyncedData(true);
                                  alert(data.message || `Synced ${data.synced} Gmail messages`);
                                } catch (error: any) {
                                  if (error.message.includes('not authenticated')) {
                                    // Redirect to OAuth
                                    connectGmail(userId);
                                  } else {
                                    alert(`Gmail sync failed: ${error.message}`);
                                  }
                                }
                              } else {
                                // Start Gmail OAuth
                                connectGmail(userId);
                              }
                            } else if (integration.id === 'discord') {
                              if (!connectedPlatforms.includes('discord')) {
                                // Start Discord OAuth
                                connectDiscord(userId);
                              }
                            } else {
                              // Other platforms (fake for now)
                              if (connectedPlatforms.includes(integration.id)) {
                                setConnectedPlatforms(prev => prev.filter(p => p !== integration.id));
                              } else {
                                setConnectedPlatforms(prev => [...prev, integration.id]);
                                alert(`${integration.name} connected (fake for now)`);
                              }
                            }
                          }}
                        >
                          {connectedPlatforms.includes(integration.id)
                            ? (integration.id === 'gmail' ? "Sync Gmail" : "Connected")
                            : "Connect"
                          }
                        </Button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}
          </motion.div>

          <div className="space-y-3">
            {searchResults.length > 0 ? (
              // Show search results
              searchResults.map((result, i) => {
                // Handle different result formats
                const isSearchResult = searchResults.length > 0;
                const resultType = result.platform || result.type;
                const resultTitle = result.title || `${result.platform || result.type} message`;
                const resultSource = result.source || result.platform;
                const resultDate = result.timestamp ? new Date(result.timestamp).toLocaleDateString() : result.date;
                const IconComponent = Search;

                return (
                  <motion.div
                    key={result.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 + i * 0.05 }}
                    onClick={() => setSelectedResult(result.id)}
                    className={cn(
                      "glass-card p-4 cursor-pointer transition-all duration-300 hover:border-primary/30 glow-effect",
                      selectedResult === result.id && "border-primary/30 shadow-lg shadow-primary/10"
                    )}
                  >
                    <div className="flex items-start gap-4">
                      <div className={cn(
                        "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
                        TYPE_COLORS[resultType] || "bg-primary/20 text-primary"
                      )}>
                        <IconComponent className="w-5 h-5" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={cn(
                            "text-xs font-medium px-2 py-0.5 rounded-full",
                            TYPE_COLORS[resultType] || "bg-primary/20 text-primary"
                          )}>
                            {resultType}
                          </span>
                          <span className="text-xs text-muted-foreground">{resultSource}</span>
                          <span className="text-xs text-muted-foreground ml-auto">{resultDate}</span>
                        </div>
                        <h3 className="font-medium text-foreground mb-1 truncate">{resultTitle}</h3>
                        <p className="text-sm text-muted-foreground line-clamp-2">{result.snippet}</p>
                      </div>

                      <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0 mt-2" />
                    </div>
                  </motion.div>
                );
              })
            ) : hasSyncedData ? (
              // Show recent memories when synced - real data from API
              isLoadingMemories ? (
                <div className="text-center py-8">
                  <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-2"></div>
                  <p className="text-muted-foreground">Loading your emails...</p>
                </div>
              ) : recentMemories.length > 0 ? (
                recentMemories.map((memory, i) => (
                  <motion.div
                    key={memory.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 + i * 0.05 }}
                    onClick={() => {
                      setSelectedResult(memory.id);
                      if (memory.url) {
                        window.open(memory.url, '_blank');
                      }
                    }}
                    className={cn(
                      "glass-card p-4 cursor-pointer transition-all duration-300 hover:border-primary/30 glow-effect",
                      selectedResult === memory.id && "border-primary/30 shadow-lg shadow-primary/10"
                    )}
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 bg-red-500/20 text-red-500">
                        <Mail className="w-5 h-5" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-500/20 text-red-500">
                            Gmail
                          </span>
                          <span className="text-xs text-muted-foreground truncate max-w-[150px]">{memory.from}</span>
                          <span className="text-xs text-muted-foreground ml-auto">{memory.date}</span>
                        </div>
                        <h3 className="font-medium text-foreground mb-1 truncate">{memory.title}</h3>
                        <p className="text-sm text-muted-foreground line-clamp-2">{memory.snippet}</p>
                      </div>

                      <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0 mt-2" />
                    </div>
                  </motion.div>
                ))
              ) : (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">No emails found. Try syncing your Gmail.</p>
                </div>
              )
            ) : (
              // Show "get started" message when no data synced
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center py-12"
              >
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
                  <Sparkles className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Welcome to Chrono Recall</h3>
                <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                  Connect your accounts to start recalling memories from your emails, chats, and documents.
                </p>
                <Button
                  onClick={() => {
                    // Scroll to sync button or show sync options
                    document.querySelector('button')?.click();
                  }}
                  className="mr-2"
                >
                  Get Started
                </Button>
              </motion.div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
