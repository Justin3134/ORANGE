import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  User,
  ChevronRight,
  Sparkles,
  Moon,
  Sun,
  RefreshCw,
  Bell,
  Shield,
  LogOut,
  Mail,
  Loader2,
  CheckCircle,
  XCircle,
  Lock,
  Trash2,
  Download,
  X,
  Check,
  Camera,
  MessageCircle,
  ExternalLink,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { getUserStatus, disconnectService, connectGmail, connectDiscord, getDiscordStatus, disconnectDiscord, getGmailStatus, disconnectGmailAccount } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useUser } from "@/contexts/UserContext";

const Settings = () => {
  const navigate = useNavigate();
  const { user, logout } = useUser();
  const userId = user?.id || 'guest';

  const [darkMode, setDarkMode] = useState(false);
  const [autoSync, setAutoSync] = useState(true);
  const [notifications, setNotifications] = useState(true);
  const [connectedServices, setConnectedServices] = useState<string[]>([]);
  const [gmailAccounts, setGmailAccounts] = useState<Array<{ email: string; name: string; connectedAt: string }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [memoriesCount, setMemoriesCount] = useState(0);

  // Profile edit state
  const [showProfileEdit, setShowProfileEdit] = useState(false);
  const [profileName, setProfileName] = useState(user?.name || "User");
  const [profileEmail, setProfileEmail] = useState(user?.email || "");
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Privacy settings state
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [dataRetention, setDataRetention] = useState("1year");
  const [shareAnalytics, setShareAnalytics] = useState(true);
  const [encryptData, setEncryptData] = useState(true);

  // Discord state
  const [discordUsername, setDiscordUsername] = useState<string | null>(null);
  const [discordServerCount, setDiscordServerCount] = useState(0);
  const [discordBotOnline, setDiscordBotOnline] = useState(false);
  const [showBotInvite, setShowBotInvite] = useState(false);
  const [botInviteUrl, setBotInviteUrl] = useState<string | null>(null);

  // Load user status on mount
  useEffect(() => {
    const loadStatus = async () => {
      try {
        const status = await getUserStatus(userId);
        setConnectedServices(status.connectedServices || []);
        setMemoriesCount(status.memoriesCount || 0);
        setGmailAccounts(status.gmailAccounts || []);

        // Load Gmail-specific status if connected
        if (status.connectedServices?.includes('gmail')) {
          try {
            const gmailStatus = await getGmailStatus(userId);
            setGmailAccounts(gmailStatus.accounts || []);
          } catch (err) {
            console.error("Failed to load Gmail status:", err);
          }
        }

        // Load Discord-specific status if connected
        if (status.connectedServices?.includes('discord')) {
          try {
            const discordStatus = await getDiscordStatus(userId);
            setDiscordUsername(discordStatus.discordUsername);
            setDiscordServerCount(discordStatus.serverCount || 0);
            setDiscordBotOnline(discordStatus.botOnline || false);
          } catch (err) {
            console.error("Failed to load Discord status:", err);
          }
        }
      } catch (err) {
        console.error("Failed to load status:", err);
      } finally {
        setIsLoading(false);
      }
    };
    loadStatus();

    // Check for OAuth callback and refresh Gmail accounts
    const urlParams = new URLSearchParams(window.location.search);
    const gmailConnected = urlParams.get('gmail_connected') === 'true';
    const gmailAccountAdded = urlParams.get('gmail_account_added') === 'true';
    const callbackUserId = urlParams.get('userId');
    
    if (gmailConnected || gmailAccountAdded) {
      // Refresh Gmail accounts after OAuth callback
      const refreshAfterOAuth = async () => {
        const currentUserId = callbackUserId || userId;
        try {
          const status = await getUserStatus(currentUserId);
          setConnectedServices(status.connectedServices || []);
          
          if (status.connectedServices?.includes('gmail')) {
            const gmailStatus = await getGmailStatus(currentUserId);
            setGmailAccounts(gmailStatus.accounts || []);
          }
        } catch (err) {
          console.error("Failed to refresh status after OAuth:", err);
        }
      };
      
      refreshAfterOAuth();
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    // Load settings from localStorage
    const savedDarkMode = localStorage.getItem('darkMode') === 'true';
    setDarkMode(savedDarkMode);
    if (savedDarkMode) {
      document.documentElement.classList.add('dark');
    }

    setAutoSync(localStorage.getItem('autoSync') !== 'false');
    setNotifications(localStorage.getItem('notifications') !== 'false');

    // Load profile
    const savedName = localStorage.getItem('profileName');
    if (savedName) setProfileName(savedName);
  }, []);

  // Handle dark mode toggle
  const handleDarkModeToggle = (value: boolean) => {
    setDarkMode(value);
    localStorage.setItem('darkMode', String(value));

    if (value) {
      document.documentElement.classList.add('dark');
      document.body.style.backgroundColor = '#0a0a0a';
    } else {
      document.documentElement.classList.remove('dark');
      document.body.style.backgroundColor = '';
    }
  };

  // Handle auto sync toggle
  const handleAutoSyncToggle = (value: boolean) => {
    setAutoSync(value);
    localStorage.setItem('autoSync', String(value));
  };

  // Handle notifications toggle
  const handleNotificationsToggle = (value: boolean) => {
    setNotifications(value);
    localStorage.setItem('notifications', String(value));

    if (value && 'Notification' in window) {
      Notification.requestPermission();
    }
  };

  // Handle disconnect
  const handleDisconnect = async (service: string) => {
    setIsDisconnecting(true);
    try {
      if (service === 'discord') {
        await disconnectDiscord(userId);
        setDiscordUsername(null);
        setDiscordServerCount(0);
      } else {
        await disconnectService(userId, service);
      }
      setConnectedServices(prev => prev.filter(s => s !== service));
      setMemoriesCount(0);
    } catch (err) {
      console.error("Failed to disconnect:", err);
    } finally {
      setIsDisconnecting(false);
    }
  };

  // Handle disconnect specific Gmail account
  const handleDisconnectGmailAccount = async (emailId: string) => {
    setIsDisconnecting(true);
    try {
      await disconnectGmailAccount(userId, emailId);
      // Reload Gmail status
      const gmailStatus = await getGmailStatus(userId);
      setGmailAccounts(gmailStatus.accounts || []);
      if (gmailStatus.accounts.length === 0) {
        setConnectedServices(prev => prev.filter(s => s !== 'gmail'));
      }
    } catch (err) {
      console.error("Failed to disconnect Gmail account:", err);
    } finally {
      setIsDisconnecting(false);
    }
  };

  // Discord bot invite URL - built client-side to avoid async issues
  const DISCORD_BOT_INVITE_URL = `https://discord.com/api/oauth2/authorize?client_id=1448501908456341545&permissions=537259072&scope=bot`;

  // Handle Discord bot invite
  const handleGetBotInvite = () => {
    setBotInviteUrl(DISCORD_BOT_INVITE_URL);
    setShowBotInvite(true);
  };

  // Handle sign out
  const handleSignOut = () => {
    logout();
    navigate('/');
  };

  // Save profile
  const handleSaveProfile = async () => {
    setIsSavingProfile(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    localStorage.setItem('profileName', profileName);
    setIsSavingProfile(false);
    setShowProfileEdit(false);
  };

  return (
    <div className={cn("min-h-screen transition-colors duration-300", darkMode ? "bg-[#0a0a0a]" : "bg-background")}>
      {/* Header */}
      <motion.header
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className={cn(
          "border-b backdrop-blur-xl px-6 py-4",
          darkMode ? "border-white/10 bg-black/50" : "border-border/50 bg-card/50"
        )}
      >
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          <Link to="/dashboard">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className={cn("text-xl font-semibold", darkMode ? "text-white" : "text-foreground")}>Settings</h1>
            <p className={cn("text-sm", darkMode ? "text-white/60" : "text-muted-foreground")}>Manage your preferences</p>
          </div>
        </div>
      </motion.header>

      {/* Content */}
      <div className="p-6 max-w-4xl mx-auto">
        {/* Profile Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            "rounded-2xl p-6 mb-8 border backdrop-blur-xl",
            darkMode ? "bg-white/5 border-white/10" : "glass-card"
          )}
        >
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-[hsl(199,89%,48%)] flex items-center justify-center">
                <User className="w-8 h-8 text-primary-foreground" />
              </div>
              <button
                onClick={() => setShowProfileEdit(true)}
                className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-primary flex items-center justify-center hover:bg-primary/90 transition-colors"
              >
                <Camera className="w-3 h-3 text-white" />
              </button>
            </div>
            <div className="flex-1">
              <h2 className={cn("text-xl font-semibold", darkMode ? "text-white" : "text-foreground")}>{user?.name || profileName}</h2>
              <p className={darkMode ? "text-white/60" : "text-muted-foreground"}>{user?.email || profileEmail}</p>
              <div className="flex items-center gap-2 mt-2">
                <span className="flex items-center gap-1 text-xs font-medium text-primary bg-primary/10 px-2 py-1 rounded-full">
                  <Sparkles className="w-3 h-3" />
                  Free Plan
                </span>
                <span className={cn("text-xs", darkMode ? "text-white/40" : "text-muted-foreground")}>
                  {memoriesCount} memories synced
                </span>
              </div>
            </div>
            <Button variant="outline" onClick={() => setShowProfileEdit(true)}>Edit Profile</Button>
          </div>
        </motion.div>

        {/* Connected Services */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-8"
        >
          <h3 className={cn("text-sm font-medium mb-4", darkMode ? "text-white/60" : "text-muted-foreground")}>Connected Services</h3>
          <div className={cn(
            "rounded-2xl border divide-y backdrop-blur-xl",
            darkMode ? "bg-white/5 border-white/10 divide-white/10" : "glass-card divide-border/50"
          )}>
            {/* Gmail */}
            <div className="p-4">
              <div className="flex items-center gap-4 mb-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-red-500/10 text-red-500">
                  <Mail className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <p className={cn("font-medium", darkMode ? "text-white" : "text-foreground")}>Gmail</p>
                  <p className={cn("text-sm", darkMode ? "text-white/60" : "text-muted-foreground")}>
                    {connectedServices.includes('gmail')
                      ? `${gmailAccounts.length} account${gmailAccounts.length !== 1 ? 's' : ''} connected`
                      : 'Not connected'}
                  </p>
                </div>
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                ) : connectedServices.includes('gmail') ? (
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => connectGmail(userId, true)}
                      className="gap-2"
                    >
                      <Mail className="w-4 h-4" />
                      Add Another Account
                    </Button>
                  </div>
                ) : (
                  <Button size="sm" onClick={() => connectGmail(userId)}>
                    Connect
                  </Button>
                )}
              </div>
              
              {/* List of connected Gmail accounts */}
              {gmailAccounts.length > 0 && (
                <div className="ml-14 space-y-2 mt-3">
                  {gmailAccounts.map((account, index) => {
                    const emailId = account.email.toLowerCase().replace(/[^a-z0-9]/g, '_');
                    return (
                      <div
                        key={emailId}
                        className={cn(
                          "flex items-center justify-between p-3 rounded-lg border",
                          darkMode ? "bg-white/5 border-white/10" : "bg-secondary/50 border-border/50"
                        )}
                      >
                        <div className="flex-1 min-w-0">
                          <p className={cn("text-sm font-medium truncate", darkMode ? "text-white" : "text-foreground")}>
                            {account.name || account.email}
                          </p>
                          <p className={cn("text-xs truncate", darkMode ? "text-white/60" : "text-muted-foreground")}>
                            {account.email}
                          </p>
                          <p className={cn("text-xs mt-1", darkMode ? "text-white/40" : "text-muted-foreground")}>
                            Connected {new Date(account.connectedAt).toLocaleDateString()}
                          </p>
                        </div>
                        {gmailAccounts.length > 1 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDisconnectGmailAccount(emailId)}
                            disabled={isDisconnecting}
                            className="text-red-500 hover:text-red-600 hover:bg-red-500/10"
                          >
                            {isDisconnecting ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Discord */}
            <div className="flex items-center gap-4 p-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-indigo-500/10 text-indigo-500">
                <MessageCircle className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <p className={cn("font-medium", darkMode ? "text-white" : "text-foreground")}>Discord</p>
                <p className={cn("text-sm", darkMode ? "text-white/60" : "text-muted-foreground")}>
                  {connectedServices.includes('discord')
                    ? `Connected as ${discordUsername || 'User'} • ${discordServerCount} server(s)`
                    : 'Not connected'}
                </p>
              </div>
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              ) : connectedServices.includes('discord') ? (
                <div className="flex items-center gap-2">
                  {discordBotOnline ? (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleGetBotInvite}
                      className="text-indigo-500"
                    >
                      Invite Bot
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDisconnect('discord')}
                    disabled={isDisconnecting}
                  >
                    {isDisconnecting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Disconnect'}
                  </Button>
                </div>
              ) : (
                <Button size="sm" onClick={() => connectDiscord(userId)} className="bg-indigo-500 hover:bg-indigo-600">
                  Connect
                </Button>
              )}
            </div>

            {/* Bot Invite Modal */}
            <AnimatePresence>
              {showBotInvite && botInviteUrl && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="px-4 pb-4"
                >
                  <div className={cn(
                    "p-4 rounded-xl",
                    darkMode ? "bg-indigo-500/10 border border-indigo-500/20" : "bg-indigo-50 border border-indigo-100"
                  )}>
                    <p className={cn("text-sm mb-3", darkMode ? "text-white/80" : "text-foreground")}>
                      <strong>Invite the ChronoRecall bot</strong> to your Discord server to sync messages:
                    </p>
                    <Button
                      onClick={() => window.open(botInviteUrl, '_blank')}
                      className="bg-indigo-500 hover:bg-indigo-600 text-white"
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Open Bot Invite
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowBotInvite(false)}
                      className="ml-2"
                    >
                      Dismiss
                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* Preferences */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="mb-8"
        >
          <h3 className={cn("text-sm font-medium mb-4", darkMode ? "text-white/60" : "text-muted-foreground")}>Preferences</h3>
          <div className={cn(
            "rounded-2xl border divide-y backdrop-blur-xl",
            darkMode ? "bg-white/5 border-white/10 divide-white/10" : "glass-card divide-border/50"
          )}>
            {/* Dark Mode */}
            <div className="flex items-center gap-4 p-4">
              <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", darkMode ? "bg-yellow-500/10 text-yellow-500" : "bg-secondary text-muted-foreground")}>
                {darkMode ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
              </div>
              <div className="flex-1">
                <p className={cn("font-medium", darkMode ? "text-white" : "text-foreground")}>Dark Mode</p>
                <p className={cn("text-sm", darkMode ? "text-white/60" : "text-muted-foreground")}>Use dark theme</p>
              </div>
              <Switch checked={darkMode} onCheckedChange={handleDarkModeToggle} />
            </div>

            {/* Auto Sync */}
            <div className="flex items-center gap-4 p-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-secondary text-muted-foreground">
                <RefreshCw className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <p className={cn("font-medium", darkMode ? "text-white" : "text-foreground")}>Auto Sync</p>
                <p className={cn("text-sm", darkMode ? "text-white/60" : "text-muted-foreground")}>Sync automatically every hour</p>
              </div>
              <Switch checked={autoSync} onCheckedChange={handleAutoSyncToggle} />
            </div>

            {/* Notifications */}
            <div className="flex items-center gap-4 p-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-secondary text-muted-foreground">
                <Bell className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <p className={cn("font-medium", darkMode ? "text-white" : "text-foreground")}>Notifications</p>
                <p className={cn("text-sm", darkMode ? "text-white/60" : "text-muted-foreground")}>Get notified about sync status</p>
              </div>
              <Switch checked={notifications} onCheckedChange={handleNotificationsToggle} />
            </div>
          </div>
        </motion.div>

        {/* Privacy & Security */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-8"
        >
          <h3 className={cn("text-sm font-medium mb-4", darkMode ? "text-white/60" : "text-muted-foreground")}>Privacy & Security</h3>
          <div className={cn(
            "rounded-2xl border divide-y backdrop-blur-xl",
            darkMode ? "bg-white/5 border-white/10 divide-white/10" : "glass-card divide-border/50"
          )}>
            <div
              className="flex items-center gap-4 p-4 cursor-pointer hover:bg-secondary/50 transition-colors"
              onClick={() => setShowPrivacy(!showPrivacy)}
            >
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-secondary text-muted-foreground">
                <Shield className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <p className={cn("font-medium", darkMode ? "text-white" : "text-foreground")}>Privacy Settings</p>
                <p className={cn("text-sm", darkMode ? "text-white/60" : "text-muted-foreground")}>Manage your data and permissions</p>
              </div>
              <ChevronRight className={cn("w-5 h-5 transition-transform", showPrivacy && "rotate-90")} />
            </div>

            <AnimatePresence>
              {showPrivacy && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="p-4 space-y-4">
                    {/* Data Retention */}
                    <div className="flex items-center justify-between">
                      <div>
                        <p className={cn("text-sm font-medium", darkMode ? "text-white" : "text-foreground")}>Data Retention</p>
                        <p className={cn("text-xs", darkMode ? "text-white/60" : "text-muted-foreground")}>How long to keep your data</p>
                      </div>
                      <select
                        value={dataRetention}
                        onChange={(e) => setDataRetention(e.target.value)}
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-sm border",
                          darkMode ? "bg-black/50 border-white/10 text-white" : "bg-secondary border-border"
                        )}
                      >
                        <option value="7days">7 days</option>
                        <option value="30days">30 days</option>
                        <option value="1year">1 year</option>
                        <option value="forever">Forever</option>
                      </select>
                    </div>

                    {/* Share Analytics */}
                    <div className="flex items-center justify-between">
                      <div>
                        <p className={cn("text-sm font-medium", darkMode ? "text-white" : "text-foreground")}>Share Analytics</p>
                        <p className={cn("text-xs", darkMode ? "text-white/60" : "text-muted-foreground")}>Help improve RecallJump</p>
                      </div>
                      <Switch checked={shareAnalytics} onCheckedChange={setShareAnalytics} />
                    </div>

                    {/* Encrypt Data */}
                    <div className="flex items-center justify-between">
                      <div>
                        <p className={cn("text-sm font-medium", darkMode ? "text-white" : "text-foreground")}>Encrypt Data</p>
                        <p className={cn("text-xs", darkMode ? "text-white/60" : "text-muted-foreground")}>End-to-end encryption</p>
                      </div>
                      <Switch checked={encryptData} onCheckedChange={setEncryptData} />
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 pt-2">
                      <Button variant="outline" size="sm">
                        <Download className="w-4 h-4 mr-2" />
                        Export Data
                      </Button>
                      <Button variant="outline" size="sm" className="text-destructive hover:bg-destructive/10">
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete All Data
                      </Button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Sign Out */}
            <div
              className="flex items-center gap-4 p-4 cursor-pointer hover:bg-destructive/5 transition-colors"
              onClick={handleSignOut}
            >
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-destructive/10 text-destructive">
                <LogOut className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-destructive">Sign Out</p>
                <p className={cn("text-sm", darkMode ? "text-white/60" : "text-muted-foreground")}>Sign out of your account</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Danger Zone */}
        {connectedServices.includes('gmail') && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className={cn(
              "rounded-2xl p-6 border",
              darkMode ? "bg-red-500/5 border-red-500/20" : "bg-destructive/5 border-destructive/20"
            )}
          >
            <h3 className="font-semibold text-destructive mb-2">Danger Zone</h3>
            <p className={cn("text-sm mb-4", darkMode ? "text-white/60" : "text-muted-foreground")}>
              Disconnect your Google account. This will remove access to your Gmail and delete all synced data.
            </p>
            <Button
              variant="outline"
              className="text-destructive border-destructive/50 hover:bg-destructive/10"
              onClick={() => handleDisconnect('gmail')}
              disabled={isDisconnecting}
            >
              {isDisconnecting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <XCircle className="w-4 h-4 mr-2" />
              )}
              Disconnect Google Account
            </Button>
          </motion.div>
        )}

        {/* Version */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className={cn("text-center text-sm mt-8", darkMode ? "text-white/40" : "text-muted-foreground")}
        >
          RecallJump v1.0.0 • Made with ❤️
        </motion.p>
      </div>

      {/* Profile Edit Modal */}
      <AnimatePresence>
        {showProfileEdit && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowProfileEdit(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className={cn(
                "w-full max-w-md rounded-2xl p-6",
                darkMode ? "bg-[#1a1a1a] border border-white/10" : "bg-white"
              )}
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className={cn("text-xl font-semibold", darkMode ? "text-white" : "text-foreground")}>Edit Profile</h2>
                <button onClick={() => setShowProfileEdit(false)} className="p-2 hover:bg-secondary rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className={cn("text-sm font-medium mb-1 block", darkMode ? "text-white/60" : "text-muted-foreground")}>
                    Display Name
                  </label>
                  <Input
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                    placeholder="Enter your name"
                    className={darkMode ? "bg-black/50 border-white/10" : ""}
                  />
                </div>

                <div>
                  <label className={cn("text-sm font-medium mb-1 block", darkMode ? "text-white/60" : "text-muted-foreground")}>
                    Email (read-only)
                  </label>
                  <Input
                    value={profileEmail}
                    disabled
                    className={cn("opacity-60", darkMode ? "bg-black/50 border-white/10" : "")}
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <Button variant="outline" className="flex-1" onClick={() => setShowProfileEdit(false)}>
                    Cancel
                  </Button>
                  <Button className="flex-1" onClick={handleSaveProfile} disabled={isSavingProfile}>
                    {isSavingProfile ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Save Changes
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Settings;
