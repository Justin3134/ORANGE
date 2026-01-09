import {
    Brain,
    Navigation,
    Mail,
    Zap,
    MessageSquare,
    FileText,
    Home,
    Search,
    RefreshCw,
    Settings,
    Moon,
    Bell,
    Shield,
    LogOut,
    Cloud,
    Check,
} from "lucide-react";// Animation variants
export const fadeUpVariants = {
    hidden: { opacity: 0, y: 40 },
    visible: (i: number) => ({
        opacity: 1,
        y: 0,
        transition: {
            delay: i * 0.1,
            duration: 0.6,
            ease: "easeOut" as const,
        },
    }),
};

export const slideInVariants = {
    hidden: { x: -100, opacity: 0 },
    visible: { x: 0, opacity: 1, transition: { duration: 0.5 } },
};

export const headerVariants = {
    hidden: { y: -20, opacity: 0 },
    visible: { y: 0, opacity: 1 },
};

// Landing page features
export const FEATURES = [
    {
        icon: Brain,
        title: "AI Semantic Search",
        description:
            "Find anything using natural language. Our AI understands context and meaning, not just keywords.",
    },
    {
        icon: Navigation,
        title: "Conversation Jump",
        description:
            "Navigate directly to the exact moment in any conversation. Never lose context again.",
    },
    {
        icon: Mail,
        title: "Email Recall",
        description: "Search through years of emails instantly. Find that important message in seconds.",
    },
    {
        icon: Zap,
        title: "Lightning Fast",
        description: "Results in milliseconds. Our indexed search works at the speed of thought.",
    },
    {
        icon: MessageSquare,
        title: "Chat Integration",
        description: "Connect your messaging apps and search across all conversations seamlessly.",
    },
    {
        icon: FileText,
        title: "Notes & Docs",
        description: "Your notes, documents, and files all searchable from one unified interface.",
    },
];

export const ONBOARDING_STEPS = [
    {
        number: "01",
        title: "Connect Your Accounts",
        description: "Link your email, chat apps, and cloud storage securely.",
    },
    {
        number: "02",
        title: "AI Indexes Everything",
        description: "Our AI processes and understands all your content.",
    },
    {
        number: "03",
        title: "Search & Recall",
        description: "Find anything instantly with natural language queries.",
    },
];

export const MOCK_SEARCH_RESULTS = [
    {
        type: "Email",
        title: "Q3 Budget Review - Sarah Chen",
        snippet: "Hi team, attached is the Q3 budget breakdown...",
        time: "2 days ago",
    },
    {
        type: "Chat",
        title: "Sarah Chen - Slack DM",
        snippet: "Can you review the budget doc I sent?",
        time: "3 days ago",
    },
];

// Dashboard items
export const SIDEBAR_ITEMS = [
    { icon: MessageSquare, label: "Memory", path: "/dashboard" },
    { icon: MessageSquare, label: "Chat", path: "/chat" },
    { icon: RefreshCw, label: "Sync", path: "/sync" },
    { icon: Settings, label: "Settings", path: "/settings" },
];

export const DASHBOARD_MOCK_RESULTS = [
    {
        id: 1,
        type: "Email",
        icon: Mail,
        title: "Project Update - Q4 Planning",
        snippet: "Hi team, here's the latest update on our Q4 planning meeting...",
        date: "Dec 5, 2024",
        source: "alex@company.com",
    },
    {
        id: 2,
        type: "Chat",
        icon: MessageSquare,
        title: "Design Review Discussion",
        snippet: "The new dashboard mockups look great! Can we schedule a follow-up...",
        date: "Dec 4, 2024",
        source: "Slack - #design",
    },
    {
        id: 3,
        type: "Note",
        icon: FileText,
        title: "Meeting Notes - Product Sync",
        snippet: "Key takeaways from today's sync: 1. Launch date confirmed for Jan 15th...",
        date: "Dec 3, 2024",
        source: "Notion",
    },
    {
        id: 4,
        type: "Email",
        icon: Mail,
        title: "Budget Approval Request",
        snippet: "Please review and approve the attached budget proposal...",
        date: "Dec 2, 2024",
        source: "finance@company.com",
    },
    {
        id: 5,
        type: "Calendar",
        icon: null,
        title: "Weekly Team Standup",
        snippet: "Recurring meeting every Monday at 10 AM...",
        date: "Dec 2, 2024",
        source: "Google Calendar",
    },
];

export const TYPE_COLORS: Record<string, string> = {
    Email: "bg-primary/20 text-primary",
    gmail: "bg-red-500/20 text-red-500",
    Chat: "bg-[hsl(199,89%,48%)]/20 text-[hsl(199,89%,48%)]",
    discord: "bg-indigo-500/20 text-indigo-500",
    Note: "bg-amber-500/20 text-amber-500",
    Calendar: "bg-emerald-500/20 text-emerald-500",
};

// Chat suggestions
export const CHAT_SUGGESTIONS = [
    "What did Sarah say about the budget?",
    "Find emails from last week",
    "Show my notes from the meeting",
    "Search conversations about the project",
];

// Settings configuration
export const SETTINGS_GROUPS = [
    {
        title: "Preferences",
        items: [
            {
                icon: Moon,
                label: "Dark Mode",
                description: "Use dark theme",
                toggle: true,
                id: "darkMode",
            },
            {
                icon: RefreshCw,
                label: "Auto Sync",
                description: "Sync automatically every hour",
                toggle: true,
                id: "autoSync",
            },
            {
                icon: Bell,
                label: "Notifications",
                description: "Get notified about sync status",
                toggle: true,
                id: "notifications",
            },
        ],
    },
    {
        title: "Account",
        items: [
            {
                icon: Shield,
                label: "Privacy & Security",
                description: "Manage your data and permissions",
                link: true,
            },
            {
                icon: LogOut,
                label: "Sign Out",
                description: "Sign out of your account",
                danger: true,
            },
        ],
    },
];

export const SYNC_INTEGRATIONS = [
    {
        id: "gmail",
        name: "Gmail",
        description: "Sync your emails and attachments",
        icon: Mail,
        connected: true,
        lastSync: "5 minutes ago",
        itemCount: 12453,
    },
    {
        id: "discord",
        name: "Discord",
        description: "Search your Discord server messages",
        icon: MessageSquare,
        connected: false,
        lastSync: null,
        itemCount: 0,
    },
    {
        id: "slack",
        name: "Slack",
        description: "Index your workspace conversations",
        icon: MessageSquare,
        connected: true,
        lastSync: "2 hours ago",
        itemCount: 8234,
    },
    {
        id: "gdrive",
        name: "Google Drive",
        description: "Search through your documents",
        icon: Cloud,
        connected: false,
        lastSync: null,
        itemCount: 0,
    },
];

export const SYNC_STATS = [
    { label: "Total Items", value: "20,687" },
    { label: "Last Sync", value: "5 min ago" },
    { label: "Connected", value: "2 of 3" },
];

export const SYNC_ACTIVITY = [
    { service: "Gmail", action: "Synced 24 new emails", time: "5 minutes ago", status: "success" },
    { service: "Slack", action: "Synced 156 messages", time: "2 hours ago", status: "success" },
    { service: "Gmail", action: "Full sync completed", time: "Yesterday", status: "success" },
];