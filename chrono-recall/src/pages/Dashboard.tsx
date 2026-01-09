import React, { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { User, ChevronRight, Sparkles, Brain } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { syncFake, connectGmail, connectDiscord, syncGmail, getUserStatus, getMemorySignals } from "@/lib/api";
import {
  SIDEBAR_ITEMS,
  TYPE_COLORS,
  SYNC_INTEGRATIONS,
} from "@/config/constants";
import { Mail } from "lucide-react";
import { useUser } from "@/contexts/UserContext";
import { toast } from "sonner";
import logo from "@/assets/logo.png";

const Dashboard = () => {
  const { user, login, isLoading: userLoading } = useUser();
  const isAuthenticated = !!user;
  const userId = user?.id || 'guest';

  // Removed search-related state since search bar was removed
  const [hasSyncedData, setHasSyncedData] = useState(false);
  const [connectedPlatforms, setConnectedPlatforms] = useState<string[]>([]);
  const [gmailConnected, setGmailConnected] = useState(false);
  const [memorySignals, setMemorySignals] = useState<any[]>([]);
  const [isLoadingMemories, setIsLoadingMemories] = useState(false);
  const [selectedResult, setSelectedResult] = useState<string | null>(null);
  const location = useLocation();

  // Fetch memory signals when connected - memoized with useCallback
  const fetchRecentMemories = useCallback(async () => {
    if (userId === 'guest') return;
    setIsLoadingMemories(true);
    try {
      const data = await getMemorySignals(userId, 5);
      setMemorySignals(data.memories || []);
    } catch (err) {
      console.error("Failed to fetch memory signals:", err);
      setMemorySignals([]);
    } finally {
      setIsLoadingMemories(false);
    }
  }, [userId]);

  // Handle OAuth callback - refresh status without changing userId
  // Wait for UserContext to finish loading before processing OAuth callback
  useEffect(() => {
    // Don't process OAuth callback until UserContext has finished loading
    if (userLoading) {
      return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const gmailConnectedParam = urlParams.get('gmail_connected');
    const gmailAccountAdded = urlParams.get('gmail_account_added');
    const discordConnectedParam = urlParams.get('discord_connected');
    const slackConnectedParam = urlParams.get('slack_connected');
    const email = urlParams.get('email');
    const name = urlParams.get('name');
    const callbackUserId = urlParams.get('userId'); // Get userId from redirect

    if (gmailConnectedParam === 'true' || discordConnectedParam === 'true' || slackConnectedParam === 'true') {
      console.log('🔄 OAuth callback detected:', { email, name, callbackUserId, isAuthenticated, currentUserId: userId });
      
      const refreshStatusAfterOAuth = async (useUserId: string | null) => {
        if (!useUserId || useUserId === 'guest') {
          console.warn('⚠️ Cannot refresh status: invalid userId', useUserId);
          return;
        }

        console.log(`📡 Refreshing status for userId: ${useUserId}`);
        try {
          const status = await getUserStatus(useUserId);
          console.log(`✅ Status retrieved:`, { connectedServices: status.connectedServices, gmailAccounts: status.gmailAccounts?.length });
          setConnectedPlatforms(status.connectedServices || []);
          
          if (status.connectedServices?.includes('gmail')) {
            setGmailConnected(true);
            setHasSyncedData(true);
            // Fetch memories with the correct userId
            setIsLoadingMemories(true);
            try {
              const data = await getMemorySignals(useUserId, 5);
              setMemorySignals(data.memories || []);
            } catch (err) {
              console.error("Failed to fetch memory signals:", err);
              setMemorySignals([]);
            } finally {
              setIsLoadingMemories(false);
            }
          }
          if (status.connectedServices?.includes('discord')) {
            setHasSyncedData(true);
          }
          if (status.connectedServices?.includes('slack')) {
            setHasSyncedData(true);
          }
        } catch (err) {
          console.error("❌ Failed to refresh status after OAuth:", err);
        }
      };

      // CRITICAL FIX: Always ensure user is logged in when email is present
      // This is the root cause of login not being remembered
      if (email) {
        const emailBasedUserId = email.toLowerCase().replace(/[^a-z0-9]/g, '_');
        
        // If user is NOT logged in, always log them in with the email from OAuth
        if (!user || !isAuthenticated) {
          console.log(`🔐 Logging in new user: ${email} (userId: ${emailBasedUserId})`);
          login(email, name || undefined);
          
          // Wait a bit for login to persist to localStorage, then refresh
          setTimeout(() => {
            refreshStatusAfterOAuth(emailBasedUserId);
          }, 200);
        } else {
          // User is already logged in - this means we're adding another account
          // ALWAYS use the current userId (where accounts are stored)
          // The backend stores all accounts under the same userId
          const currentUserId = userId !== 'guest' ? userId : emailBasedUserId;
          console.log(`✅ User already logged in: ${user.email} (userId: ${currentUserId})`);
          console.log(`➕ Adding additional account to existing userId: ${currentUserId}`);
          
          // Update user info if name is provided (optional)
          if (name && user.name !== name) {
            console.log(`📝 Updating user name: ${user.name} -> ${name}`);
            login(user.email, name); // Update name but keep same email/userId
          }
          
          // Refresh with current userId to get all accounts (including the newly added one)
          refreshStatusAfterOAuth(currentUserId);
        }
      } else if (callbackUserId && callbackUserId !== 'guest') {
        // Fallback: if no email but userId is present (shouldn't happen but handle it)
        console.warn('⚠️ No email in OAuth callback, using callbackUserId:', callbackUserId);
        if (!user || !isAuthenticated) {
          // Can't login without email, but can still refresh status
          refreshStatusAfterOAuth(callbackUserId);
        } else {
          // Use current userId if logged in
          const currentUserId = userId !== 'guest' ? userId : callbackUserId;
          refreshStatusAfterOAuth(currentUserId);
        }
      } else {
        console.error('❌ OAuth callback missing both email and userId!');
      }

      const service = gmailConnectedParam ? 'Gmail' : discordConnectedParam ? 'Discord' : 'Slack';
      toast.success(`Successfully connected ${service}${gmailAccountAdded === 'true' ? ' (account added)' : ''}!`);

      // Clean up URL after a short delay to ensure state updates complete
      setTimeout(() => {
        window.history.replaceState({}, document.title, window.location.pathname);
      }, 100);
    }
  }, [login, user, isAuthenticated, userId, userLoading]);

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
  }, [userId, fetchRecentMemories]);

  // Search functionality removed - search bar was removed from Dashboard

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
            <img src={logo} alt="RecallJump" className="w-8 h-8 object-contain" />
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
        {/* Results */}
        <div className="p-6 max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="mb-6"
          >
            <h1 className="text-2xl font-semibold text-foreground mb-2">
              What matters right now
            </h1>
            {hasSyncedData && (
              <p className="text-sm text-muted-foreground">
                AI-generated memory signals ranked by importance
              </p>
            )}

            {/* AI Parsing Results removed - search functionality removed */}

            {/* Connection Panel - Show when no data synced */}
            {!hasSyncedData && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="mt-8"
              >
                <div className="text-center py-12">
                  <img src={logo} alt="RecallJump" className="w-16 h-16 mx-auto mb-4 object-contain" />
                  <h3 className="text-lg font-semibold mb-4">Connect Your Accounts</h3>
                  <p className="text-sm text-muted-foreground mb-6">
                    Connect your accounts to start recalling memories from your emails, chats, and documents.
                  </p>
                </div>
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
            {hasSyncedData ? (
              // Show memory signals when synced - AI-generated memory abstractions
              isLoadingMemories ? (
                <div className="text-center py-8">
                  <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-2"></div>
                  <p className="text-muted-foreground">Analyzing your memories...</p>
                </div>
              ) : memorySignals.length > 0 ? (
                memorySignals.map((memory, i) => {
                  const typeColors: Record<string, string> = {
                    Decision: 'bg-blue-500/20 text-blue-500 border-blue-500/30',
                    Risk: 'bg-red-500/20 text-red-500 border-red-500/30',
                    'Open Question': 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30',
                    Commitment: 'bg-green-500/20 text-green-500 border-green-500/30',
                    Insight: 'bg-purple-500/20 text-purple-500 border-purple-500/30',
                  };

                  return (
                    <motion.div
                      key={memory.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 + i * 0.05 }}
                      onClick={() => {
                        setSelectedResult(memory.id);
                      }}
                      className={cn(
                        "glass-card p-4 cursor-pointer transition-all duration-300 hover:border-primary/30",
                        memory.unresolved && "border-l-4 border-l-yellow-500",
                        selectedResult === memory.id && "border-primary/30 shadow-lg shadow-primary/10"
                      )}
                    >
                      <div className="flex items-start gap-3 mb-3">
                        <div className={cn(
                          "px-2 py-1 rounded text-xs font-medium border",
                          typeColors[memory.type] || 'bg-gray-500/20 text-gray-500 border-gray-500/30'
                        )}>
                          {memory.type}
                        </div>
                        {memory.unresolved && (
                          <div className="px-2 py-1 rounded text-xs font-medium bg-yellow-500/20 text-yellow-500 border border-yellow-500/30">
                            Unresolved
                          </div>
                        )}
                      </div>

                      <h3 className="font-semibold text-foreground mb-2">{memory.title}</h3>
                      <p className="text-sm text-muted-foreground mb-3">{memory.summary}</p>

                      {memory.highlightedQuotes && memory.highlightedQuotes.length > 0 && (
                        <div className="bg-secondary/50 rounded-lg p-3 mb-3 border-l-2 border-primary/50">
                          {memory.highlightedQuotes.map((quote: string, idx: number) => (
                            <p key={idx} className="text-sm italic text-muted-foreground mb-1">
                              "{quote}"
                            </p>
                          ))}
                        </div>
                      )}

                      <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/50">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          {memory.sourceEmail && (
                            <span>raised by {memory.sourceEmail.split('<')[0].trim() || memory.sourceEmail.split('@')[0]}</span>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (memory.gmailUrl) {
                              window.open(memory.gmailUrl, '_blank');
                            }
                          }}
                          className="text-xs h-7"
                        >
                          View in Gmail
                        </Button>
                      </div>
                    </motion.div>
                  );
                })
              ) : (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">No critical memories to show right now.</p>
                </div>
              )
            ) : (
              // Show "get started" message when no data synced
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center py-12"
              >
                <img src={logo} alt="RecallJump" className="w-16 h-16 mx-auto mb-4 object-contain" />
                <h3 className="text-lg font-semibold mb-2">Welcome to RecallJump</h3>
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
