import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, ArrowRight, Send, Mail, MessageSquare, Check, Sparkles, Hash, Loader2, CheckCircle, Lock, Twitter, Facebook, Instagram } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link, useNavigate } from "react-router-dom";
import logo from "@/assets/logo.png";
import {
  FEATURES,
  ONBOARDING_STEPS,
  fadeUpVariants,
} from "@/config/constants";
import { getUserStatus, getRecentMemories, connectGmail, connectDiscord, connectSlack } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useUser } from "@/contexts/UserContext";

// Available MCP servers/platforms
const MCP_SERVERS = [
  { id: 'gmail', name: 'Gmail', icon: Mail, color: 'from-red-500/20 to-red-600/10', iconColor: 'text-red-500', description: 'Search your emails', available: true },
  { id: 'discord', name: 'Discord', icon: MessageSquare, color: 'from-indigo-500/20 to-indigo-600/10', iconColor: 'text-indigo-500', description: 'Search server messages', available: true },
  { id: 'slack', name: 'Slack', icon: Hash, color: 'from-purple-500/20 to-purple-600/10', iconColor: 'text-purple-500', description: 'Index workspace chats', available: true },
  { id: 'twitter', name: 'X (Twitter)', icon: Twitter, color: 'from-blue-400/20 to-blue-500/10', iconColor: 'text-blue-400', description: 'Find tweets & DMs', available: false },
  { id: 'instagram', name: 'Instagram', icon: Instagram, color: 'from-pink-500/20 to-pink-600/10', iconColor: 'text-pink-500', description: 'Search messages', available: false },
  { id: 'facebook', name: 'Facebook', icon: Facebook, color: 'from-blue-600/20 to-blue-700/10', iconColor: 'text-blue-600', description: 'Messenger & posts', available: false },
];

const Landing = () => {
  const { user, isAuthenticated } = useUser();
  const userId = user?.id || 'guest';

  const [query, setQuery] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [connectedServices, setConnectedServices] = useState<string[]>([]);
  const [recentMemories, setRecentMemories] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const navigate = useNavigate();

  // Check user status and recent memories on mount
  useEffect(() => {
    const checkStatus = async () => {
      if (!isAuthenticated) {
        setIsLoading(false);
        return;
      }

      try {
        const status = await getUserStatus(userId);
        setConnectedServices(status.connectedServices || []);

        if (status.memoriesCount > 0) {
          const memories = await getRecentMemories(userId, 3);
          setRecentMemories(memories.memories || []);
        }
      } catch (err) {
        console.error("Failed to get status:", err);
      } finally {
        setIsLoading(false);
      }
    };

    // Check for OAuth callback - if we get redirected back from OAuth, redirect to dashboard
    const urlParams = new URLSearchParams(window.location.search);
    const gmailConnected = urlParams.get('gmail_connected') === 'true';
    const discordConnected = urlParams.get('discord_connected') === 'true';
    const slackConnected = urlParams.get('slack_connected') === 'true';
    const email = urlParams.get('email');
    const callbackUserId = urlParams.get('userId');
    
    if (gmailConnected || discordConnected || slackConnected) {
      // If OAuth completed, redirect to dashboard for proper handling
      // Dashboard will handle the login and status refresh
      if (email || callbackUserId) {
        navigate('/dashboard?' + urlParams.toString());
        return;
      }
    }

    checkStatus();
  }, [isAuthenticated, userId, navigate]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    if (connectedServices.length === 0) {
      navigate('/chat');
    } else {
      navigate(`/chat?q=${encodeURIComponent(query)}`);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    setIsTyping(e.target.value.length > 0);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && query.trim()) {
      handleSearch(e);
    }
  };

  const handleConnect = (platformId: string) => {
    setIsConnecting(true);
    
    // Generate userId from email if user is authenticated, otherwise use 'guest'
    // Note: When OAuth completes, the backend will use the actual email from Google
    // to store accounts. The Dashboard OAuth handler will then login the user with
    // that email, generating the correct userId.
    const connectUserId = isAuthenticated && user ? userId : 'guest';
    
    if (platformId === 'gmail') {
      connectGmail(connectUserId, false);
    } else if (platformId === 'discord') {
      connectDiscord(connectUserId);
    } else if (platformId === 'slack') {
      connectSlack(connectUserId);
    }
  };

  const scrollToPricing = () => {
    document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen overflow-hidden relative cloud-background">
      {/* Subtle accent glows */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[10%] left-[20%] w-[600px] h-[600px] rounded-full bg-primary/8 blur-[180px] animate-pulse-slow" />
        <div className="absolute bottom-[15%] right-[15%] w-[500px] h-[500px] rounded-full bg-accent/6 blur-[150px] animate-pulse-slow" style={{ animationDelay: '2.5s' }} />
        <div className="absolute top-[50%] left-[50%] -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-primary/4 blur-[200px]" />
      </div>

      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass-nav bg-primary">
        <div className="container mx-auto px-6 py-5 flex items-center justify-between bg-slate-100 border-slate-100">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-3">
            <img src={logo} alt="RecallJump" className="w-12 h-12 object-contain" />
            <span className="text-2xl font-medium tracking-tight text-[#3473b3]/70 font-serif">Recall Jump</span>
          </motion.div>

          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-5">
            <button onClick={scrollToPricing} className="text-muted-foreground hover:text-foreground font-body text-base transition-colors">
              Pricing
            </button>
            {isAuthenticated ? (
              <>
                <Link to="/dashboard">
                  <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground font-body text-base">Dashboard</Button>
                </Link>
                <Link to="/chat">
                  <Button size="sm" className="bg-gradient-to-r from-primary to-accent text-primary-foreground shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-shadow font-body text-base px-6">
                    Chat
                  </Button>
                </Link>
              </>
            ) : (
              <Link to="/dashboard">
                <Button size="sm" className="bg-gradient-to-r from-primary to-accent text-primary-foreground shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-shadow font-body text-base px-6">
                  Get Started
                </Button>
              </Link>
            )}
          </motion.div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-40 pb-20">
        <div className="container mx-auto px-6 relative">
          <motion.div initial="hidden" animate="visible" className="text-center max-w-4xl mx-auto">
            <motion.div custom={0} variants={fadeUpVariants} className="inline-flex items-center gap-2.5 px-6 py-3 rounded-full glass-card mb-12">
              <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span className="text-sm text-muted-foreground font-body font-medium tracking-wide uppercase">Powered by Advanced AI</span>
            </motion.div>

            <motion.h1 custom={1} variants={fadeUpVariants} className="text-5xl md:text-7xl lg:text-8xl font-display font-medium mb-10 leading-[1.1] tracking-tight">
              <span className="text-foreground">Find Anything You</span>
              <br />
              <span className="gradient-text italic">Forgot. Instantly.</span>
            </motion.h1>

            <motion.p custom={2} variants={fadeUpVariants} className="text-xl md:text-2xl text-muted-foreground mb-16 max-w-2xl mx-auto leading-relaxed font-body font-light">
              Search across conversations, emails, and memories with AI.
              Your personal memory assistant that never forgets.
            </motion.p>
          </motion.div>

          {/* Interactive Chat Interface */}
          <motion.div
            initial={{ opacity: 0, y: 60 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="relative"
          >
            <div className="glass-card-strong p-8 md:p-12 max-w-4xl mx-auto">
              {/* Search Input with Glow */}
              <form onSubmit={handleSearch} className="flex items-center gap-4 mb-10">
                <div className={`relative flex-1 glass-input ${isTyping ? 'glow-active' : ''}`}>
                  <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-6 h-6 text-muted-foreground" />
                  <input
                    type="text"
                    value={query}
                    onChange={handleInputChange}
                    onKeyDown={handleInputKeyDown}
                    placeholder="Ask anything about your emails, chats, or documents..."
                    className="w-full h-16 bg-transparent pl-14 pr-5 text-foreground placeholder:text-muted-foreground focus:outline-none font-body text-lg"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={!query.trim()}
                  size="lg"
                  className="h-16 px-8 bg-gradient-to-r from-primary to-accent text-primary-foreground shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all disabled:opacity-40"
                >
                  <Send className="w-5 h-5" />
                </Button>
              </form>

              {/* Connect Your Accounts - Redesigned with glass aesthetic */}
              <div className="mb-8">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                      <Sparkles className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <p className="font-display font-medium text-lg">
                        {connectedServices.length > 0 ? 'Connected Services' : 'Connect to Start'}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {connectedServices.length > 0
                          ? `${connectedServices.length} service${connectedServices.length > 1 ? 's' : ''} ready to search`
                          : 'Link your accounts to search across platforms'}
                      </p>
                    </div>
                  </div>
                  {connectedServices.length > 0 && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/20"
                    >
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      <span className="text-sm font-medium text-green-600">Active</span>
                    </motion.div>
                  )}
                </div>

                {/* Platform Grid - Improved aesthetic */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {MCP_SERVERS.map((server, i) => {
                    const isConnected = connectedServices.includes(server.id);
                    return (
                      <motion.div
                        key={server.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 + i * 0.05 }}
                        whileHover={{ scale: server.available ? 1.02 : 1, y: server.available ? -2 : 0 }}
                        className={cn(
                          "relative overflow-hidden rounded-2xl border backdrop-blur-xl transition-all duration-300 cursor-pointer group",
                          isConnected
                            ? "border-green-500/40 bg-gradient-to-br from-green-500/10 to-green-600/5 shadow-lg shadow-green-500/10"
                            : server.available
                              ? "border-border/50 hover:border-primary/50 bg-gradient-to-br from-white/80 to-white/40 hover:shadow-xl hover:shadow-primary/10"
                              : "border-border/30 bg-gradient-to-br from-white/40 to-white/20 opacity-60"
                        )}
                        onClick={() => server.available && !isConnected && handleConnect(server.id)}
                      >
                        {/* Gradient overlay */}
                        <div className={cn("absolute inset-0 bg-gradient-to-br opacity-50", server.color)} />

                        <div className="relative p-5">
                          <div className="flex items-start justify-between mb-3">
                            <div className={cn(
                              "w-12 h-12 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110",
                              isConnected ? "bg-green-500/20" : "bg-white/60"
                            )}>
                              <server.icon className={cn("w-6 h-6", isConnected ? "text-green-600" : server.iconColor)} />
                            </div>
                            {isConnected && (
                              <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center"
                              >
                                <Check className="w-4 h-4 text-white" />
                              </motion.div>
                            )}
                            {!server.available && (
                              <Lock className="w-4 h-4 text-muted-foreground/50" />
                            )}
                          </div>

                          <h4 className="font-medium text-foreground mb-1">{server.name}</h4>
                          <p className="text-xs text-muted-foreground">{server.description}</p>

                          {server.available && !isConnected && (
                            <motion.div
                              initial={{ opacity: 0, y: 10 }}
                              whileHover={{ opacity: 1, y: 0 }}
                              className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-primary/90 to-primary/70 opacity-0 group-hover:opacity-100 transition-all"
                            >
                              <span className="text-sm font-medium text-white flex items-center justify-center gap-2">
                                {isConnecting ? (
                                  <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Connecting...
                                  </>
                                ) : (
                                  <>Click to Connect</>
                                )}
                              </span>
                            </motion.div>
                          )}

                          {!server.available && (
                            <div className="absolute top-2 right-2">
                              <span className="text-[10px] font-medium bg-black/10 text-muted-foreground px-2 py-0.5 rounded-full">
                                Soon
                              </span>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>

              {/* Recent Memories - Only show if there are actual memories */}
              <AnimatePresence>
                {recentMemories.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-4 pt-6 border-t border-border/30"
                  >
                    <p className="text-sm text-muted-foreground font-body uppercase tracking-wider font-medium">Recent Memories</p>
                    {recentMemories.map((memory, i) => (
                      <motion.div
                        key={memory.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.1 * i }}
                        className="flex items-center gap-5 p-5 rounded-2xl glass-card hover:border-primary/30 transition-all duration-300 cursor-pointer group"
                        onClick={() => navigate(`/chat?q=${encodeURIComponent(memory.text.substring(0, 50))}`)}
                      >
                        <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${memory.platform === 'gmail' ? 'bg-red-500/10 text-red-500' : 'bg-accent/15 text-accent'}`}>
                          {memory.platform === 'gmail' ? <Mail className="w-6 h-6" /> : <MessageSquare className="w-6 h-6" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-1.5">
                            <span className={`text-sm font-semibold px-3 py-1.5 rounded-full font-body uppercase tracking-wide ${memory.platform === 'gmail' ? 'bg-red-500/10 text-red-500' : 'bg-accent/15 text-accent'}`}>
                              {memory.platform}
                            </span>
                            <span className="text-sm text-muted-foreground font-body">
                              {new Date(memory.timestamp).toLocaleDateString()}
                            </span>
                          </div>
                          <p className="font-body text-foreground truncate">{memory.text}</p>
                        </div>
                        <ArrowRight className="w-6 h-6 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                      </motion.div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Empty state when no memories */}
              {!isLoading && recentMemories.length === 0 && connectedServices.length === 0 && (
                <div className="text-center py-4 border-t border-border/30 mt-6">
                  <p className="text-muted-foreground font-body text-sm">
                    Connect a service above to start finding your forgotten conversations ✨
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-32 relative">
        <div className="container mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="text-center mb-20"
          >
            <h2 className="text-4xl md:text-6xl font-display font-medium text-foreground mb-6 tracking-tight">How It Works</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto text-xl font-body font-light">
              Get started in minutes. Three simple steps to never forget anything again.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-10 max-w-5xl mx-auto">
            {ONBOARDING_STEPS.map((step, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ delay: i * 0.15, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                className="relative"
              >
                <div className="glass-card p-10 h-full hover-lift">
                  <span className="text-7xl font-display gradient-text opacity-60">{step.number}</span>
                  <h3 className="text-2xl font-display font-medium text-foreground mt-6 mb-4">{step.title}</h3>
                  <p className="text-lg text-muted-foreground font-body">{step.description}</p>
                </div>
                {i < ONBOARDING_STEPS.length - 1 && (
                  <div className="hidden md:block absolute top-1/2 -right-5 w-10 h-0.5 bg-gradient-to-r from-primary/40 to-transparent" />
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-32 relative">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,hsl(210_55%_90%/0.4),transparent_60%)]" />
        <div className="container mx-auto px-6 relative">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="text-center mb-20"
          >
            <h2 className="text-4xl md:text-6xl font-display font-medium text-foreground mb-6 tracking-tight">Powerful Features</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto text-xl font-body font-light">
              Everything you need to recall and organize your digital memories.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {FEATURES.map((feature, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ delay: i * 0.1, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                className="glass-card p-8 hover-lift group"
              >
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <feature.icon className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-2xl font-display font-medium text-foreground mb-4">{feature.title}</h3>
                <p className="text-lg text-muted-foreground font-body leading-relaxed">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-32 relative">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(210_55%_92%/0.5),transparent_50%)]" />
        <div className="container mx-auto px-6 relative">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="text-center mb-20"
          >
            <h2 className="text-4xl md:text-6xl font-display font-medium text-foreground mb-6 tracking-tight">
              Simple Pricing
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto text-xl font-body font-light">
              Start free, upgrade when you need more. No hidden fees.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto mb-16">
            {/* Free Tier */}
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ delay: 0, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className="glass-card p-8 hover-lift"
            >
              <div className="text-center mb-8">
                <h3 className="text-xl font-display font-medium text-foreground mb-2">Free</h3>
                <div className="flex items-baseline justify-center gap-1">
                  <span className="text-5xl font-display font-medium">$0</span>
                  <span className="text-muted-foreground font-body">/month</span>
                </div>
                <p className="text-sm text-muted-foreground mt-3 font-body">Perfect for getting started</p>
              </div>
              <ul className="space-y-4 mb-8">
                {["1 connected account", "100 memories/month", "Basic AI search", "7-day history"].map((feature, i) => (
                  <li key={i} className="flex items-center gap-3 font-body text-foreground">
                    <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Check className="w-3 h-3 text-primary" />
                    </div>
                    {feature}
                  </li>
                ))}
              </ul>
              <Link to="/chat" className="block">
                <Button variant="outline" className="w-full h-12 font-body">
                  Get Started
                </Button>
              </Link>
            </motion.div>

            {/* Pro Tier */}
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ delay: 0.1, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className="glass-card-strong p-8 hover-lift relative border-2 border-primary/30"
            >
              <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                <span className="px-4 py-1.5 bg-gradient-to-r from-primary to-accent text-white text-sm font-body font-medium rounded-full shadow-lg shadow-primary/25">
                  Most Popular
                </span>
              </div>
              <div className="text-center mb-8 pt-2">
                <h3 className="text-xl font-display font-medium text-foreground mb-2">Pro</h3>
                <div className="flex items-baseline justify-center gap-1">
                  <span className="text-5xl font-display font-medium gradient-text">$12</span>
                  <span className="text-muted-foreground font-body">/month</span>
                </div>
                <p className="text-sm text-muted-foreground mt-3 font-body">For power users</p>
              </div>
              <ul className="space-y-4 mb-8">
                {["5 connected accounts", "Unlimited memories", "Advanced AI search", "1-year history", "Priority support", "Custom integrations"].map((feature, i) => (
                  <li key={i} className="flex items-center gap-3 font-body text-foreground">
                    <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                      <Check className="w-3 h-3 text-primary" />
                    </div>
                    {feature}
                  </li>
                ))}
              </ul>
              <Link to="/chat" className="block">
                <Button className="w-full h-12 font-body bg-gradient-to-r from-primary to-accent shadow-lg shadow-primary/25 hover:shadow-primary/40">
                  Start Free Trial
                </Button>
              </Link>
            </motion.div>

            {/* Enterprise Tier */}
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ delay: 0.2, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className="glass-card p-8 hover-lift"
            >
              <div className="text-center mb-8">
                <h3 className="text-xl font-display font-medium text-foreground mb-2">Enterprise</h3>
                <div className="flex items-baseline justify-center gap-1">
                  <span className="text-5xl font-display font-medium">Custom</span>
                </div>
                <p className="text-sm text-muted-foreground mt-3 font-body">For teams & organizations</p>
              </div>
              <ul className="space-y-4 mb-8">
                {["Unlimited accounts", "Unlimited memories", "Custom AI models", "Unlimited history", "Dedicated support", "SSO & admin tools", "On-premise option"].map((feature, i) => (
                  <li key={i} className="flex items-center gap-3 font-body text-foreground">
                    <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Check className="w-3 h-3 text-primary" />
                    </div>
                    {feature}
                  </li>
                ))}
              </ul>
              <Button variant="outline" className="w-full h-12 font-body">
                Contact Sales
              </Button>
            </motion.div>
          </div>

        </div>
      </section>

      {/* Footer */}
      <footer className="glass-footer py-16 relative bg-slate-100 border-destructive-foreground">
        <div className="container mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-col md:flex-row items-center justify-between gap-8"
          >
            <div className="flex items-center gap-3">
              <img src={logo} alt="RecallJump" className="w-12 h-12 object-contain" />
            </div>

            <div className="flex items-center gap-10 text-base text-muted-foreground font-body">
              <Link to="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
              <Link to="/terms" className="hover:text-foreground transition-colors">Terms</Link>
              <a href="mailto:support@recalljump.com" className="hover:text-foreground transition-colors">Contact</a>
            </div>

            <p className="text-base text-muted-foreground font-body">
              © 2024 RecallJump. All rights reserved.
            </p>
          </motion.div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
