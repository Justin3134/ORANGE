import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Brain, Mail, MessageSquare, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUser } from "@/contexts/UserContext";
import { connectGmail, connectDiscord } from "@/lib/api";
import { toast } from "sonner";

const Login = () => {
  const [isConnecting, setIsConnecting] = useState<string | null>(null);
  const { login, isAuthenticated } = useUser();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Handle OAuth callback
  useEffect(() => {
    const gmailConnected = searchParams.get('gmail_connected');
    const discordConnected = searchParams.get('discord_connected');
    const userEmail = searchParams.get('email');
    const userName = searchParams.get('name');

    if (gmailConnected === 'true' && userEmail) {
      // User successfully connected Gmail - log them in
      login(userEmail, userName || undefined);
      toast.success("Successfully signed in with Gmail!");
      navigate("/dashboard");
    } else if (discordConnected === 'true' && userEmail) {
      // User successfully connected Discord - log them in
      login(userEmail, userName || undefined);
      toast.success("Successfully signed in with Discord!");
      navigate("/dashboard");
    }
  }, [searchParams, login, navigate]);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate("/dashboard");
    }
  }, [isAuthenticated, navigate]);

  const handleGmailLogin = () => {
    setIsConnecting('gmail');
    // Use a temporary guest ID - backend will create real user after OAuth
    connectGmail('new_user');
  };

  const handleDiscordLogin = () => {
    setIsConnecting('discord');
    // Use a temporary guest ID - backend will create real user after OAuth
    connectDiscord('new_user');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
      {/* Background effects */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl mb-4">
            <Brain className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Recall Jump</h1>
          <p className="text-gray-400">Your AI-powered memory assistant</p>
        </div>

        {/* Login Card */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20">
          <div className="flex items-center gap-2 mb-6">
            <Sparkles className="w-5 h-5 text-purple-400" />
            <h2 className="text-xl font-semibold text-white">Sign In</h2>
          </div>

          <p className="text-gray-300 mb-6">
            Connect your email or messaging platform to get started. This will be your login and allow AI to search your messages.
          </p>

          <div className="space-y-4">
            {/* Gmail Login */}
            <Button
              onClick={handleGmailLogin}
              disabled={isConnecting !== null}
              className="w-full bg-white hover:bg-gray-100 text-gray-900 py-6 text-lg"
            >
              {isConnecting === 'gmail' ? (
                <Loader2 className="w-5 h-5 mr-3 animate-spin" />
              ) : (
                <Mail className="w-5 h-5 mr-3 text-red-500" />
              )}
              Continue with Gmail
            </Button>

            {/* Discord Login */}
            <Button
              onClick={handleDiscordLogin}
              disabled={isConnecting !== null}
              className="w-full bg-[#5865F2] hover:bg-[#4752C4] text-white py-6 text-lg"
            >
              {isConnecting === 'discord' ? (
                <Loader2 className="w-5 h-5 mr-3 animate-spin" />
              ) : (
                <MessageSquare className="w-5 h-5 mr-3" />
              )}
              Continue with Discord
            </Button>
          </div>

          <p className="text-center text-gray-400 text-sm mt-6">
            By signing in, you authorize RecallJump to access your messages for AI-powered search.
          </p>
        </div>

        {/* Features preview */}
        <div className="mt-8 grid grid-cols-3 gap-4 text-center">
          <div className="text-gray-400">
            <div className="text-2xl mb-1">📧</div>
            <div className="text-xs">Gmail</div>
          </div>
          <div className="text-gray-400">
            <div className="text-2xl mb-1">💬</div>
            <div className="text-xs">Discord</div>
          </div>
          <div className="text-gray-400">
            <div className="text-2xl mb-1">🔍</div>
            <div className="text-xs">AI Search</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
