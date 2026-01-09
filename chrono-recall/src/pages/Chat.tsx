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
  ChevronLeft,
  ChevronRight,
  Mail,
  Hash,
  Loader2,
  CheckCircle,
  AlertCircle,
  Link2,
  PanelLeftClose,
  PanelLeft,
  Tag,
} from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import logo from "@/assets/logo.png";
import { sendChatMessage, getUserStatus, connectGmail, connectDiscord, connectSlack, labelEmails, getGmailStatus } from "@/lib/api";
import { useUser } from "@/contexts/UserContext";

interface Message {
  id: number;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  sources?: { platform: string; title: string; url?: string; accountEmail?: string }[];
  conversationId?: string; // Link message to conversation
}

interface Conversation {
  id: string;
  title: string;
  timestamp: Date;
  messageIds?: number[]; // Store message IDs for this conversation
}

interface ChatResponse {
  response: string;
  sources?: { platform: string; title: string; url?: string; accountEmail?: string }[];
  connectedServices?: string[];
  searchResults?: {
    gmail?: Array<{ id: string; subject: string; snippet?: string; accountEmail?: string }>;
    discord?: any[];
    slack?: any[];
  };
  totalGmailCount?: number;
  allGmailIds?: string[];
  allGmailEmails?: Array<{ id: string; accountEmail?: string; accountIndex?: number }>;
  hasRelevantSources?: boolean;
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
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(['gmail']);
  const [connectedServices, setConnectedServices] = useState<string[]>([]);
  const [showPlatformSelector, setShowPlatformSelector] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isLabeling, setIsLabeling] = useState(false);
  const [lastSearchQuery, setLastSearchQuery] = useState("");
  const [lastGmailIds, setLastGmailIds] = useState<string[]>([]);
  const [lastGmailEmails, setLastGmailEmails] = useState<Array<{ id: string; accountEmail?: string; accountIndex?: number }>>([]);
  const [lastTotalGmail, setLastTotalGmail] = useState(0);
  const [gmailAccounts, setGmailAccounts] = useState<Array<{ email: string; name: string; connectedAt: string }>>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Load chat history from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('chat_history');
      if (stored) {
        const parsed = JSON.parse(stored);
        // Restore conversations
        if (parsed.conversations && Array.isArray(parsed.conversations)) {
          setConversations(parsed.conversations);
        }
        // Restore all messages (we'll filter by conversation when needed)
        if (parsed.messages && Array.isArray(parsed.messages)) {
          // Convert timestamp strings back to Date objects
          const restoredMessages = parsed.messages.map((msg: any) => ({
            ...msg,
            timestamp: msg.timestamp ? new Date(msg.timestamp) : new Date()
          }));
          setMessages(restoredMessages);
        }
      }
    } catch (e) {
      console.error('Failed to load chat history:', e);
    }
  }, []);

  // Save chat history to localStorage whenever messages or conversations change
  useEffect(() => {
    if (messages.length > 0 || conversations.length > 0) {
      try {
        localStorage.setItem('chat_history', JSON.stringify({
          messages,
          conversations
        }));
      } catch (e) {
        console.error('Failed to save chat history:', e);
      }
    }
  }, [messages, conversations]);

  // Check user status on mount
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const status = await getUserStatus(userId);
        setConnectedServices(status.connectedServices || []);
        
        // Load Gmail accounts if Gmail is connected
        if (status.connectedServices?.includes('gmail')) {
          try {
            const { getGmailStatus } = await import('@/lib/api');
            const gmailStatus = await getGmailStatus(userId);
            setGmailAccounts(gmailStatus.accounts || []);
          } catch (err) {
            console.error("Failed to load Gmail accounts:", err);
          }
        }
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
      // Refresh status after OAuth
      setTimeout(() => checkStatus(), 500);
    }
    if (urlParams.get('discord_connected') === 'true') {
      setConnectedServices(prev => [...new Set([...prev, 'discord'])]);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
    if (urlParams.get('slack_connected') === 'true') {
      setConnectedServices(prev => [...new Set([...prev, 'slack'])]);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [userId]);

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

    // Create or get conversation ID
    const conversationId = currentConversationId || Date.now().toString();
    if (!currentConversationId) {
      setCurrentConversationId(conversationId);
    }

    const userMessage: Message = {
      id: Date.now(),
      role: "user",
      content: messageText,
      timestamp: new Date(),
      conversationId: conversationId
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsTyping(true);

    try {
      // Call the actual backend API
      const response: ChatResponse = await sendChatMessage(userId, messageText, selectedPlatforms);

      // Debug: Log response to see what we're getting
      console.log('Chat response:', {
        totalGmailCount: response.totalGmailCount,
        allGmailIds: response.allGmailIds,
        allGmailIdsLength: response.allGmailIds?.length,
        hasGmail: selectedPlatforms.includes('gmail')
      });

      const aiMessage: Message = {
        id: Date.now() + 1,
        role: "assistant",
        content: response.response,
        timestamp: new Date(),
        sources: response.sources || [],
        conversationId: conversationId
      };

      setMessages((prev) => [...prev, aiMessage]);

      // Create or update conversation
      if (!currentConversationId) {
        const newConversation: Conversation = {
          id: conversationId,
          title: messageText.substring(0, 30) + (messageText.length > 30 ? '...' : ''),
          timestamp: new Date(),
          messageIds: [userMessage.id, aiMessage.id]
        };
        setConversations(prev => [newConversation, ...prev]);
      } else {
        // Update existing conversation
        setConversations(prev => prev.map(conv => 
          conv.id === conversationId 
            ? { ...conv, messageIds: [...(conv.messageIds || []), userMessage.id, aiMessage.id] }
            : conv
        ));
      }

      // Store search results for labeling (only if more than 5 Gmail results and Gmail is selected)
      // Check both new fields and fallback to searchResults if needed
      const gmailCount = response.totalGmailCount || response.searchResults?.gmail?.length || 0;
      const gmailIds = response.allGmailIds || response.searchResults?.gmail?.map((m: any) => m.id) || [];
      const gmailEmails = response.allGmailEmails || response.searchResults?.gmail?.map((m: any) => ({ 
        id: m.id, 
        accountEmail: m.accountEmail, 
        accountIndex: m.accountIndex 
      })) || [];
      
      if (selectedPlatforms.includes('gmail') && gmailCount > 5 && gmailEmails.length > 5) {
        console.log('✅ Setting label state:', {
          totalGmailCount: gmailCount,
          allGmailEmailsLength: gmailEmails.length,
          searchQuery: messageText
        });
        setLastSearchQuery(messageText);
        setLastGmailIds(gmailIds);
        setLastGmailEmails(gmailEmails);
        setLastTotalGmail(gmailCount);
      } else {
        console.log('❌ Clearing label state:', {
          hasGmail: selectedPlatforms.includes('gmail'),
          totalGmailCount: gmailCount,
          allGmailEmailsLength: gmailEmails.length,
          reason: !selectedPlatforms.includes('gmail') ? 'Gmail not selected' : 
                  gmailCount <= 5 ? 'Count <= 5' : 
                  gmailEmails.length <= 5 ? 'Emails length <= 5' : 'Unknown'
        });
        // Clear if 5 or fewer results
        setLastGmailIds([]);
        setLastGmailEmails([]);
        setLastTotalGmail(0);
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

  // Handle labeling emails
  const handleLabelEmails = async () => {
    if (lastGmailEmails.length === 0 && lastGmailIds.length === 0) return;

    setIsLabeling(true);
    try {
      // Generate label name from search query (max 30 chars)
      const labelName = lastSearchQuery.length > 30 
        ? lastSearchQuery.substring(0, 27) + "..."
        : lastSearchQuery;
      
      // Use new format with allGmailEmails if available, otherwise fallback to old format
      const result: any = await labelEmails(userId, labelName, lastGmailIds, lastGmailEmails.length > 0 ? lastGmailEmails : undefined);
      
      // Show success message with account breakdown if available
      let message = `✅ Successfully labeled ${result.results?.success || 0} email(s) with "${labelName}" in Gmail!`;
      if (result.byAccount) {
        const accountDetails = Object.entries(result.byAccount)
          .map(([email, stats]: [string, any]) => `${stats.success} in ${email}`)
          .join(', ');
        message += ` (${accountDetails})`;
      }
      
      setMessages(prev => [...prev, {
        id: Date.now(),
        role: "assistant",
        content: message,
        timestamp: new Date()
      }]);
    } catch (error: any) {
      setMessages(prev => [...prev, {
        id: Date.now(),
        role: "assistant",
        content: `❌ Failed to label emails: ${error.message}`,
        timestamp: new Date()
      }]);
    } finally {
      setIsLabeling(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const startNewChat = () => {
    setMessages([]);
    setInput("");
    setCurrentConversationId(null);
  };

  const loadConversation = (conversationId: string) => {
    // Load messages for this conversation from localStorage
    try {
      const stored = localStorage.getItem('chat_history');
      if (stored) {
        const parsed = JSON.parse(stored);
        const allMessages = parsed.messages || [];
        // Filter messages by conversationId
        const conversationMessages = allMessages
          .filter((msg: any) => msg.conversationId === conversationId)
          .map((msg: any) => ({
            ...msg,
            timestamp: msg.timestamp ? new Date(msg.timestamp) : new Date()
          }));
        
        if (conversationMessages.length > 0) {
          setMessages(conversationMessages);
          setCurrentConversationId(conversationId);
        } else {
          console.warn('No messages found for conversation:', conversationId);
        }
      }
    } catch (e) {
      console.error('Failed to load conversation:', e);
    }
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
    <div className="h-screen flex bg-background overflow-hidden">
      {/* Sidebar Overlay for mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <motion.aside
        initial={false}
        animate={{
          width: sidebarOpen ? 280 : 0,
          opacity: sidebarOpen ? 1 : 0
        }}
        transition={{ duration: 0.2, ease: "easeInOut" }}
        className={cn(
          "border-r border-border/50 flex flex-col bg-card/30 backdrop-blur-sm h-full z-40 overflow-hidden",
          "fixed lg:relative",
          !sidebarOpen && "border-r-0"
        )}
        style={{ minWidth: sidebarOpen ? 280 : 0 }}
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
                  onClick={() => loadConversation(conv.id)}
                  className={cn(
                    "w-full text-left px-3 py-2.5 rounded-lg hover:bg-secondary/50 transition-colors group",
                    currentConversationId === conv.id && "bg-secondary/30"
                  )}
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
      <div className="flex-1 flex flex-col min-w-0 w-full">
        {/* Header */}
        <header className="h-14 border-b border-border/50 flex items-center justify-between px-4 bg-background/80 backdrop-blur-sm shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 hover:bg-secondary/50 rounded-lg transition-colors"
              title={sidebarOpen ? "Close sidebar" : "Open sidebar"}
            >
              {sidebarOpen ? (
                <PanelLeftClose className="w-5 h-5" />
              ) : (
                <PanelLeft className="w-5 h-5" />
              )}
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
                                  {source.accountEmail && (
                                    <span className="text-xs text-muted-foreground/70">({source.accountEmail})</span>
                                  )}
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
            {/* Connected Accounts Display */}
            {connectedServices.length > 0 && (
              <div className="mb-3 flex items-center gap-2 flex-wrap">
                <span className="text-xs text-muted-foreground">Searching in:</span>
                {connectedServices.includes('gmail') && gmailAccounts.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap">
                    {gmailAccounts.map((account, idx) => (
                      <div
                        key={account.email}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs"
                      >
                        <Mail className="w-3 h-3" />
                        <span className="truncate max-w-[150px]">{account.email}</span>
                      </div>
                    ))}
                  </div>
                )}
                {connectedServices.includes('discord') && (
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-500/10 text-indigo-500 text-xs">
                    <MessageSquare className="w-3 h-3" />
                    <span>Discord</span>
                  </div>
                )}
                {connectedServices.includes('slack') && (
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-500/10 text-purple-500 text-xs">
                    <Hash className="w-3 h-3" />
                    <span>Slack</span>
                  </div>
                )}
              </div>
            )}
            
            {/* Label Button - Show when there are more than 5 Gmail results */}
            {lastTotalGmail > 5 && lastGmailEmails.length > 0 && (
              <div className="mb-3 flex items-center justify-end">
                <Button
                  onClick={handleLabelEmails}
                  disabled={isLabeling}
                  className={cn(
                    "gap-2 text-white",
                    "bg-blue-500 hover:bg-blue-600",
                    "transition-colors duration-200",
                    "shadow hover:shadow-md"
                  )}
                  size="sm"
                >
                  {isLabeling ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Labeling...
                    </>
                  ) : (
                    <>
                      <Tag className="w-4 h-4" />
                      Label {lastTotalGmail - 5}+ emails
                    </>
                  )}
                </Button>
              </div>
            )}

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
