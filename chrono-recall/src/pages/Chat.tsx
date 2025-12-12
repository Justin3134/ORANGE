import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send,
  Plus,
  Sparkles,
  User,
  Copy,
  ThumbsUp,
  ThumbsDown,
  Share,
  MoreHorizontal,
  MessageSquare,
  Search,
  Clock,
  ExternalLink,
  ChevronDown,
  Mail,
  Hash,
  Loader2,
  CheckCircle,
  AlertCircle,
  Link2,
} from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import logo from "@/assets/logo.png";
import { sendChatMessage, getUserStatus, connectGmail, connectDiscord, connectSlack } from "@/lib/api";
import { useUser } from "@/contexts/UserContext";

interface Message {
  id: number;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  sources?: { platform: string; title: string; url?: string }[];
}

interface Conversation {
  id: string;
  title: string;
  timestamp: Date;
}

// Available MCP servers/platforms
const MCP_SERVERS = [
  { id: 'gmail', name: 'Gmail', icon: Mail, color: 'text-red-500', available: true },
  { id: 'discord', name: 'Discord', icon: MessageSquare, color: 'text-indigo-500', available: true },
  { id: 'slack', name: 'Slack', icon: Hash, color: 'text-purple-500', available: true },
  { id: 'twitter', name: 'X (Twitter)', icon: MessageSquare, color: 'text-blue-400', available: false },
  { id: 'facebook', name: 'Facebook', icon: MessageSquare, color: 'text-blue-600', available: false },
  { id: 'instagram', name: 'Instagram', icon: MessageSquare, color: 'text-pink-500', available: false },
];

const Chat = () => {
  const [searchParams] = useSearchParams();
  const initialQuery = searchParams.get('q') || '';
  const { user } = useUser();
  const userId = user?.id || 'guest';

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState(initialQuery);
  const [isTyping, setIsTyping] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(['gmail']);
  const [connectedServices, setConnectedServices] = useState<string[]>([]);
  const [showPlatformSelector, setShowPlatformSelector] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Check user status on mount
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const status = await getUserStatus(userId);
        setConnectedServices(status.connectedServices || []);
      } catch (err) {
        console.error("Failed to get user status:", err);
      }
    };
    checkStatus();

    // Check for OAuth callback
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('gmail_connected') === 'true') {
      setConnectedServices(prev => [...new Set([...prev, 'gmail'])]);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
    if (urlParams.get('discord_connected') === 'true') {
      setConnectedServices(prev => [...new Set([...prev, 'discord'])]);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  // Auto-send if there's a query parameter
  useEffect(() => {
    if (initialQuery && messages.length === 0 && connectedServices.length > 0) {
      handleSend(initialQuery);
    }
  }, [connectedServices]);

  const handleSend = async (overrideInput?: string) => {
    const messageText = overrideInput || input;
    if (!messageText.trim()) return;

    // Check if any platform is connected
    if (connectedServices.length === 0) {
      setMessages(prev => [...prev, {
        id: Date.now(),
        role: "assistant",
        content: "Please connect at least one service (like Gmail) to start searching your conversations. Click the 'Connect' button below to get started.",
        timestamp: new Date()
      }]);
      return;
    }

    const userMessage: Message = {
      id: Date.now(),
      role: "user",
      content: messageText,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsTyping(true);

    try {
      // Call the actual backend API
      const response = await sendChatMessage(userId, messageText, selectedPlatforms);

      const aiMessage: Message = {
        id: Date.now() + 1,
        role: "assistant",
        content: response.response,
        timestamp: new Date(),
        sources: response.sources || []
      };

      setMessages((prev) => [...prev, aiMessage]);

      // Add to conversation history
      if (messages.length === 0) {
        setConversations(prev => [{
          id: Date.now().toString(),
          title: messageText.substring(0, 30) + (messageText.length > 30 ? '...' : ''),
          timestamp: new Date()
        }, ...prev]);
      }
    } catch (error: any) {
      console.error("Chat error:", error);
      const errorMessage: Message = {
        id: Date.now() + 1,
        role: "assistant",
        content: `Sorry, I encountered an error: ${error.message}. Please make sure the backend is running and try again.`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const startNewChat = () => {
    setMessages([]);
    setInput("");
  };

  const togglePlatform = (platformId: string) => {
    setSelectedPlatforms(prev =>
      prev.includes(platformId)
        ? prev.filter(p => p !== platformId)
        : [...prev, platformId]
    );
  };

  const handleConnect = (platformId: string) => {
    setIsConnecting(true);
    if (platformId === 'gmail') {
      connectGmail(userId);
    } else if (platformId === 'discord') {
      connectDiscord(userId);
    } else if (platformId === 'slack') {
      connectSlack(userId);
    }
  };

  return (
    <div className="h-screen flex bg-background">
      {/* Sidebar */}
      <motion.aside
        initial={{ x: -300 }}
        animate={{ x: sidebarOpen ? 0 : -300 }}
        className={cn(
          "w-[280px] border-r border-border/50 flex flex-col bg-card/30 backdrop-blur-sm fixed lg:relative h-full z-40",
          !sidebarOpen && "lg:hidden"
        )}
      >
        {/* New Chat Button */}
        <div className="p-4">
          <Button
            onClick={startNewChat}
            className="w-full justify-start gap-3 h-11 bg-transparent border border-border/50 hover:bg-secondary/50 text-foreground"
            variant="outline"
          >
            <Plus className="w-4 h-4" />
            New chat
          </Button>
        </div>

        {/* Conversation History */}
        <div className="flex-1 overflow-y-auto px-2">
          <p className="px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">Recent</p>
          <div className="space-y-1">
            {conversations.length === 0 ? (
              <p className="px-3 py-2 text-sm text-muted-foreground">No conversations yet</p>
            ) : (
              conversations.map((conv) => (
                <button
                  key={conv.id}
                  className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-secondary/50 transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <MessageSquare className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span className="text-sm truncate flex-1">{conv.title}</span>
                    <MoreHorizontal className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Connected Services */}
        <div className="p-4 border-t border-border/50">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Connected</p>
          <div className="space-y-2">
            {connectedServices.length === 0 ? (
              <p className="text-sm text-muted-foreground">No services connected</p>
            ) : (
              connectedServices.map(service => {
                const server = MCP_SERVERS.find(s => s.id === service);
                if (!server) return null;
                return (
                  <div key={service} className="flex items-center gap-2 text-sm">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <server.icon className={cn("w-4 h-4", server.color)} />
                    <span>{server.name}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* User Section */}
        <div className="p-4 border-t border-border/50">
          <div className="flex items-center gap-3 px-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <User className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user?.name || 'User'}</p>
              <p className="text-xs text-muted-foreground">Free Plan</p>
            </div>
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          </div>
        </div>
      </motion.aside>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-14 border-b border-border/50 flex items-center justify-between px-4 bg-background/80 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 hover:bg-secondary/50 rounded-lg transition-colors lg:hidden"
            >
              <MessageSquare className="w-5 h-5" />
            </button>
            <Link to="/" className="flex items-center gap-2">
              <img src={logo} alt="RecallJump" className="w-7 h-7 object-contain" />
              <span className="font-medium text-foreground hidden sm:inline">RecallJump</span>
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/dashboard">
              <Button variant="ghost" size="sm">Dashboard</Button>
            </Link>
            <Button variant="ghost" size="icon" className="w-8 h-8">
              <Share className="w-4 h-4" />
            </Button>
          </div>
        </header>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto">
          {messages.length === 0 ? (
            /* Empty State */
            <div className="h-full flex flex-col items-center justify-center px-6 py-12">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center max-w-2xl"
              >
                <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                  <Sparkles className="w-8 h-8 text-primary" />
                </div>
                <h1 className="text-2xl font-display font-medium mb-3">What do you want to find?</h1>
                <p className="text-muted-foreground mb-8 font-body">
                  Search through your emails, chats, and documents with AI
                </p>

                {/* Connection Status */}
                {connectedServices.length === 0 ? (
                  <div className="mb-8 p-6 rounded-xl border border-amber-500/30 bg-amber-500/5">
                    <div className="flex items-center gap-3 mb-4">
                      <AlertCircle className="w-5 h-5 text-amber-500" />
                      <span className="font-medium">Connect a service to get started</span>
                    </div>
                    <p className="text-sm text-muted-foreground mb-4">
                      Connect your Gmail, Slack, or other services to search through your conversations.
                    </p>
                    <Button onClick={() => handleConnect('gmail')} disabled={isConnecting}>
                      {isConnecting ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Mail className="w-4 h-4 mr-2" />
                      )}
                      Connect Gmail
                    </Button>
                  </div>
                ) : (
                  /* Platform Selector */
                  <div className="mb-8">
                    <p className="text-sm text-muted-foreground mb-3">Search in:</p>
                    <div className="flex flex-wrap gap-2 justify-center">
                      {MCP_SERVERS.map(server => {
                        const isConnected = connectedServices.includes(server.id);
                        const isSelected = selectedPlatforms.includes(server.id);
                        return (
                          <button
                            key={server.id}
                            onClick={() => {
                              if (isConnected) {
                                togglePlatform(server.id);
                              } else if (server.available) {
                                handleConnect(server.id);
                              }
                            }}
                            disabled={!server.available && !isConnected}
                            className={cn(
                              "flex items-center gap-2 px-4 py-2 rounded-full border transition-all",
                              isConnected && isSelected
                                ? "border-primary bg-primary/10 text-primary"
                                : isConnected
                                  ? "border-border hover:border-primary/50"
                                  : server.available
                                    ? "border-border hover:border-primary/50 cursor-pointer"
                                    : "border-border/50 opacity-50 cursor-not-allowed"
                            )}
                          >
                            <server.icon className={cn("w-4 h-4", server.color)} />
                            <span className="text-sm">{server.name}</span>
                            {!isConnected && !server.available && (
                              <span className="text-xs bg-secondary px-1.5 py-0.5 rounded">Soon</span>
                            )}
                            {!isConnected && server.available && (
                              <span className="text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded">Connect</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Quick Actions */}
                {connectedServices.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg mx-auto">
                    {[
                      { icon: Search, text: "Find emails about budget" },
                      { icon: Clock, text: "What did Sarah say last week?" },
                      { icon: MessageSquare, text: "Show recent conversations" },
                      { icon: ExternalLink, text: "Find shared documents" },
                    ].map((item, i) => (
                      <button
                        key={i}
                        onClick={() => setInput(item.text)}
                        className="flex items-center gap-3 p-4 rounded-xl border border-border/50 hover:bg-secondary/50 hover:border-primary/30 transition-all text-left group"
                      >
                        <item.icon className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                        <span className="text-sm">{item.text}</span>
                      </button>
                    ))}
                  </div>
                )}
              </motion.div>
            </div>
          ) : (
            /* Messages */
            <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
              <AnimatePresence mode="popLayout">
                {messages.map((message) => (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="group"
                  >
                    {/* User Message */}
                    {message.role === "user" ? (
                      <div className="flex gap-4 justify-end">
                        <div className="max-w-[85%] bg-primary/10 rounded-2xl rounded-tr-sm px-4 py-3">
                          <p className="text-foreground whitespace-pre-wrap">{message.content}</p>
                        </div>
                      </div>
                    ) : (
                      /* Assistant Message */
                      <div className="flex gap-4">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center shrink-0">
                          <Sparkles className="w-4 h-4 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="prose prose-sm max-w-none text-foreground">
                            <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
                          </div>

                          {/* Sources */}
                          {message.sources && message.sources.length > 0 && (
                            <div className="mt-4 flex flex-wrap gap-2">
                              {message.sources.map((source, i) => (
                                <a
                                  key={i}
                                  href={source.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-secondary/50 hover:bg-secondary text-sm transition-colors"
                                >
                                  <Link2 className="w-3 h-3" />
                                  <span className="text-muted-foreground">{source.platform}</span>
                                  <span className="font-medium truncate max-w-[150px]">{source.title}</span>
                                </a>
                              ))}
                            </div>
                          )}

                          {/* Actions */}
                          <div className="flex items-center gap-1 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 px-2"
                              onClick={() => copyToClipboard(message.content)}
                            >
                              <Copy className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="sm" className="h-8 px-2">
                              <ThumbsUp className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="sm" className="h-8 px-2">
                              <ThumbsDown className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>

              {/* Typing Indicator */}
              <AnimatePresence>
                {isTyping && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="flex gap-4"
                  >
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                      <Sparkles className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex items-center gap-2 px-4 py-3">
                      <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Searching your {selectedPlatforms.join(', ')}...</span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="border-t border-border/50 bg-background p-4">
          <div className="max-w-3xl mx-auto">
            {/* Platform selector pills */}
            {connectedServices.length > 0 && messages.length > 0 && (
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs text-muted-foreground">Searching:</span>
                {MCP_SERVERS.filter(s => connectedServices.includes(s.id)).map(server => (
                  <button
                    key={server.id}
                    onClick={() => togglePlatform(server.id)}
                    className={cn(
                      "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs transition-all",
                      selectedPlatforms.includes(server.id)
                        ? "bg-primary/10 text-primary border border-primary/30"
                        : "bg-secondary/50 text-muted-foreground hover:bg-secondary"
                    )}
                  >
                    <server.icon className="w-3 h-3" />
                    {server.name}
                  </button>
                ))}
              </div>
            )}

            <div className="relative flex items-end gap-2 rounded-2xl border border-border/50 bg-card/50 p-2 focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/10 transition-all">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={connectedServices.length > 0 ? "Message RecallJump..." : "Connect a service to start..."}
                disabled={connectedServices.length === 0}
                rows={1}
                className="flex-1 resize-none bg-transparent px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none min-h-[44px] max-h-[200px] disabled:opacity-50"
                style={{ height: 'auto' }}
              />
              <Button
                onClick={() => handleSend()}
                disabled={!input.trim() || connectedServices.length === 0}
                size="icon"
                className={cn(
                  "shrink-0 w-10 h-10 rounded-xl transition-all",
                  input.trim() && connectedServices.length > 0
                    ? "bg-primary text-white hover:bg-primary/90"
                    : "bg-secondary text-muted-foreground"
                )}
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-xs text-center text-muted-foreground mt-2">
              {connectedServices.length > 0
                ? `Searching across ${connectedServices.join(', ')} • Powered by AI`
                : "Connect your accounts to start searching"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Chat;
