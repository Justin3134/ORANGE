import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, RefreshCw, CheckCircle, Clock, Sparkles, User, Mail, Hash, MessageSquare, Lock, Loader2, Twitter, Facebook, Instagram, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SIDEBAR_ITEMS, SYNC_ACTIVITY } from "@/config/constants";
import { connectGmail, connectDiscord, syncGmail, syncDiscord, getUserStatus } from "@/lib/api";
import { useUser } from "@/contexts/UserContext";

// Extended platform list
const PLATFORMS = [
  { id: 'gmail', name: 'Gmail', icon: Mail, color: 'from-red-500/20 to-red-600/10', iconColor: 'text-red-500 bg-red-500/10', description: 'Sync your emails and attachments', available: true },
  { id: 'discord', name: 'Discord', icon: MessageSquare, color: 'from-indigo-500/20 to-indigo-600/10', iconColor: 'text-indigo-500 bg-indigo-500/10', description: 'Search server messages and DMs', available: true },
  { id: 'slack', name: 'Slack', icon: Hash, color: 'from-purple-500/20 to-purple-600/10', iconColor: 'text-purple-500 bg-purple-500/10', description: 'Index your workspace conversations', available: false },
  { id: 'twitter', name: 'X (Twitter)', icon: Twitter, color: 'from-blue-400/20 to-blue-500/10', iconColor: 'text-blue-400 bg-blue-400/10', description: 'Find tweets, replies, and DMs', available: false },
  { id: 'facebook', name: 'Facebook', icon: Facebook, color: 'from-blue-600/20 to-blue-700/10', iconColor: 'text-blue-600 bg-blue-600/10', description: 'Messenger conversations and posts', available: false },
  { id: 'instagram', name: 'Instagram', icon: Instagram, color: 'from-pink-500/20 to-pink-600/10', iconColor: 'text-pink-500 bg-pink-500/10', description: 'Direct messages and comments', available: false },
];

const Sync = () => {
  const { user } = useUser();
  const userId = user?.id || 'guest';
  
  const [connectedPlatforms, setConnectedPlatforms] = useState<string[]>([]);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<Record<string, string>>({});
  const [memoriesCount, setMemoriesCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const location = useLocation();

  // Load user status on mount
  useEffect(() => {
    const loadStatus = async () => {
      try {
        const status = await getUserStatus(userId);
        setConnectedPlatforms(status.connectedServices || []);
        setMemoriesCount(status.memoriesCount || 0);
      } catch (err) {
        console.error("Failed to load status:", err);
      } finally {
        setIsLoading(false);
      }
    };
    loadStatus();

    // Check for OAuth callback
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('gmail_connected') === 'true') {
      setConnectedPlatforms(prev => [...new Set([...prev, 'gmail'])]);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
    if (urlParams.get('discord_connected') === 'true') {
      setConnectedPlatforms(prev => [...new Set([...prev, 'discord'])]);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const handleConnect = async (platformId: string) => {
    if (platformId === 'gmail') {
      connectGmail(userId);
    } else if (platformId === 'discord') {
      connectDiscord(userId);
    } else {
      // Mock connect for other platforms
      setConnectedPlatforms(prev => [...prev, platformId]);
    }
  };

  // Discord bot invite URL - built client-side to avoid popup blocking
  const DISCORD_BOT_INVITE_URL = `https://discord.com/api/oauth2/authorize?client_id=1448501908456341545&permissions=537259072&scope=bot`;

  const handleBotInvite = () => {
    // Open directly without async call to prevent popup blocking
    window.open(DISCORD_BOT_INVITE_URL, 'discord-bot-invite', 'width=500,height=800,menubar=no,toolbar=no');
  };

  const handleSync = async (platformId: string) => {
    setSyncing(platformId);
    try {
      if (platformId === 'gmail') {
        const result = await syncGmail(userId);
        setMemoriesCount(prev => prev + (result.synced || 0));
      } else if (platformId === 'discord') {
        const result = await syncDiscord(userId);
        setMemoriesCount(prev => prev + (result.synced || 0));
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
      setLastSync(prev => ({ ...prev, [platformId]: 'Just now' }));
    } catch (error: any) {
      console.error('Sync error:', error);
      if (error.message?.includes('not authenticated') || error.message?.includes('not connected')) {
        if (platformId === 'gmail') {
          connectGmail(userId);
        } else if (platformId === 'discord') {
          connectDiscord(userId);
        }
      } else if (error.message?.includes('bot')) {
        // Bot not in server - show invite
        handleBotInvite();
      }
    } finally {
      setSyncing(null);
    }
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
        <div className="p-4 border-b border-border">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-[hsl(199,89%,48%)] flex items-center justify-center shrink-0 shadow-lg shadow-primary/25">
              <Sparkles className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-lg font-semibold text-foreground hidden lg:block">RecallJump</span>
          </Link>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {SIDEBAR_ITEMS.map((item) => {
            const isActive = location.pathname === item.path;
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

        <div className="p-3 border-t border-border">
          <Link to="/settings">
            <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-secondary transition-colors cursor-pointer">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-[hsl(199,89%,48%)] flex items-center justify-center shrink-0">
                <User className="w-4 h-4 text-primary-foreground" />
              </div>
              <div className="hidden lg:block">
                <p className="text-sm font-medium text-foreground">{user?.name || 'User'}</p>
                <p className="text-xs text-muted-foreground">Free Plan</p>
              </div>
            </div>
          </Link>
        </div>
      </motion.aside>

      {/* Main Content */}
      <main className="flex-1 ml-16 lg:ml-64 p-6">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-between mb-8"
          >
            <div>
              <h1 className="text-3xl font-display font-medium mb-2">Sync & Integrations</h1>
              <p className="text-muted-foreground">Connect your accounts to sync your memories</p>
            </div>
            <Link to="/settings">
              <Button variant="outline" size="sm">
                <Settings className="w-4 h-4 mr-2" />
                Settings
              </Button>
            </Link>
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="grid grid-cols-3 gap-4 mb-8"
          >
            <div className="glass-card p-5 text-center">
              <p className="text-4xl font-display font-medium gradient-text">{connectedPlatforms.length}</p>
              <p className="text-sm text-muted-foreground mt-1">Connected</p>
            </div>
            <div className="glass-card p-5 text-center">
              <p className="text-4xl font-display font-medium">{memoriesCount.toLocaleString()}</p>
              <p className="text-sm text-muted-foreground mt-1">Memories</p>
            </div>
            <div className="glass-card p-5 text-center">
              <p className="text-4xl font-display font-medium">{Object.keys(lastSync).length > 0 ? 'Just now' : '—'}</p>
              <p className="text-sm text-muted-foreground mt-1">Last Sync</p>
            </div>
          </motion.div>

          {/* All Platforms */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <h2 className="text-xl font-semibold mb-4">All Platforms</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
              {PLATFORMS.map((platform, i) => {
                const isConnected = connectedPlatforms.includes(platform.id);
                const isSyncing = syncing === platform.id;

                return (
                  <motion.div
                    key={platform.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 + i * 0.05 }}
                    whileHover={{ scale: platform.available ? 1.01 : 1 }}
                    className={cn(
                      "relative overflow-hidden rounded-2xl border backdrop-blur-xl transition-all duration-300",
                      isConnected
                        ? "border-green-500/40 bg-gradient-to-br from-green-500/5 to-green-600/5"
                        : platform.available
                          ? "border-border/50 hover:border-primary/30 bg-gradient-to-br from-white/80 to-white/40"
                          : "border-border/30 bg-gradient-to-br from-white/40 to-white/20 opacity-70"
                    )}
                  >
                    {/* Background gradient */}
                    <div className={cn("absolute inset-0 bg-gradient-to-br opacity-30", platform.color)} />

                    <div className="relative p-5">
                      <div className="flex items-center gap-4">
                        <div className={cn(
                          "w-14 h-14 rounded-xl flex items-center justify-center transition-all",
                          platform.iconColor
                        )}>
                          <platform.icon className="w-7 h-7" />
                        </div>

                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold text-foreground">{platform.name}</h4>
                            {isConnected && (
                              <CheckCircle className="w-4 h-4 text-green-500" />
                            )}
                            {!platform.available && (
                              <span className="text-xs bg-black/10 text-muted-foreground px-2 py-0.5 rounded-full flex items-center gap-1">
                                <Lock className="w-3 h-3" />
                                Soon
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">{platform.description}</p>
                          {isConnected && lastSync[platform.id] && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                              <Clock className="w-3 h-3" />
                              Last sync: {lastSync[platform.id]}
                            </p>
                          )}
                        </div>

                        <div className="flex flex-col gap-2">
                          {platform.available ? (
                            isConnected ? (
                              <>
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => handleSync(platform.id)}
                                  disabled={isSyncing}
                                  className="min-w-[100px]"
                                >
                                  {isSyncing ? (
                                    <>
                                      <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                                      Syncing
                                    </>
                                  ) : (
                                    <>
                                      <RefreshCw className="w-4 h-4 mr-1" />
                                      Sync Now
                                    </>
                                  )}
                                </Button>
                                {platform.id === 'discord' && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleBotInvite}
                                    className="min-w-[100px] text-indigo-500 border-indigo-500/30 hover:bg-indigo-500/10"
                                  >
                                    Invite Bot
                                  </Button>
                                )}
                              </>
                            ) : (
                              <Button
                                size="sm"
                                onClick={() => handleConnect(platform.id)}
                                className={cn(
                                  "min-w-[100px]",
                                  platform.id === 'discord' && "bg-indigo-500 hover:bg-indigo-600"
                                )}
                              >
                                Connect
                              </Button>
                            )
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              disabled
                              className="min-w-[100px] opacity-50"
                            >
                              Coming Soon
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>

          {/* Recent Activity */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <h2 className="text-xl font-semibold mb-4">Recent Activity</h2>
            <div className="glass-card divide-y divide-border/50">
              {SYNC_ACTIVITY.map((activity, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + i * 0.05 }}
                  className="p-4 flex items-center gap-4"
                >
                  <div className={cn(
                    "w-2 h-2 rounded-full",
                    activity.status === 'success' ? "bg-green-500" : "bg-yellow-500"
                  )} />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{activity.service}</p>
                    <p className="text-xs text-muted-foreground">{activity.action}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">{activity.time}</p>
                </motion.div>
              ))}
              {SYNC_ACTIVITY.length === 0 && (
                <div className="p-8 text-center text-muted-foreground">
                  <p>No activity yet. Connect a service to get started!</p>
                </div>
              )}
            </div>
          </motion.div>

          {/* Help Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="mt-8 p-6 glass-card border border-primary/20"
          >
            <h3 className="font-semibold mb-2">Need help connecting?</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Each platform requires OAuth authentication to securely access your data. Click "Connect" and follow the authorization prompts.
            </p>
            <div className="flex gap-3">
              <Button variant="outline" size="sm">View Documentation</Button>
              <Button variant="outline" size="sm">Contact Support</Button>
            </div>
          </motion.div>
        </div>
      </main>
    </div>
  );
};

export default Sync;
