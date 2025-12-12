import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Shield, Lock, Eye, Database, UserCheck, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import logo from "@/assets/logo.png";

const Privacy = () => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <img src={logo} alt="RecallJump" className="w-10 h-10 object-contain" />
            <span className="text-xl font-medium tracking-tight text-[#3473b3]/70 font-serif">Recall Jump</span>
          </Link>
          <Link to="/">
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Back to Home
            </Button>
          </Link>
        </div>
      </nav>

      {/* Content */}
      <div className="container mx-auto px-6 pt-28 pb-20 max-w-4xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          {/* Header */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary mb-6">
              <Shield className="w-4 h-4" />
              <span className="text-sm font-medium">Privacy Policy</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-display font-medium mb-4">
              Your Privacy Matters
            </h1>
            <p className="text-muted-foreground text-lg">
              Last updated: December 10, 2025
            </p>
          </div>

          {/* Content */}
          <div className="prose prose-slate max-w-none">
            <section className="mb-10">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <Eye className="w-5 h-5 text-blue-500" />
                </div>
                <h2 className="text-2xl font-semibold m-0">Overview</h2>
              </div>
              <p className="text-muted-foreground leading-relaxed">
                RecallJump ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our AI-powered memory search service.
              </p>
            </section>

            <section className="mb-10">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-green-500/10">
                  <Database className="w-5 h-5 text-green-500" />
                </div>
                <h2 className="text-2xl font-semibold m-0">Information We Collect</h2>
              </div>
              <div className="space-y-4 text-muted-foreground">
                <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                  <h3 className="font-semibold text-foreground mb-2">Account Information</h3>
                  <p className="m-0">When you connect your accounts, we receive your email address, name, and profile information from the respective platforms (Gmail, Discord, Slack).</p>
                </div>
                <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                  <h3 className="font-semibold text-foreground mb-2">Message Data</h3>
                  <p className="m-0">We access and process messages from your connected platforms to enable AI-powered search. This data is used solely to provide you with search results and is processed in real-time.</p>
                </div>
                <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                  <h3 className="font-semibold text-foreground mb-2">Usage Data</h3>
                  <p className="m-0">We collect information about how you interact with RecallJump, including search queries and feature usage, to improve our service.</p>
                </div>
              </div>
            </section>

            <section className="mb-10">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-purple-500/10">
                  <Lock className="w-5 h-5 text-purple-500" />
                </div>
                <h2 className="text-2xl font-semibold m-0">How We Use Your Information</h2>
              </div>
              <ul className="space-y-3 text-muted-foreground">
                <li className="flex items-start gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                  <span>To provide AI-powered search across your connected messaging platforms</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                  <span>To authenticate your identity and maintain your session</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                  <span>To improve and optimize our service</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                  <span>To communicate with you about service updates and support</span>
                </li>
              </ul>
            </section>

            <section className="mb-10">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-orange-500/10">
                  <Shield className="w-5 h-5 text-orange-500" />
                </div>
                <h2 className="text-2xl font-semibold m-0">Data Security</h2>
              </div>
              <p className="text-muted-foreground leading-relaxed mb-4">
                We implement industry-standard security measures to protect your data:
              </p>
              <ul className="space-y-3 text-muted-foreground">
                <li className="flex items-start gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                  <span>All data transmission is encrypted using TLS/SSL</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                  <span>OAuth tokens are securely stored and never shared</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                  <span>We do not permanently store your message content</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                  <span>You can disconnect your accounts and delete your data at any time</span>
                </li>
              </ul>
            </section>

            <section className="mb-10">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-indigo-500/10">
                  <UserCheck className="w-5 h-5 text-indigo-500" />
                </div>
                <h2 className="text-2xl font-semibold m-0">Your Rights</h2>
              </div>
              <p className="text-muted-foreground leading-relaxed mb-4">
                You have the right to:
              </p>
              <ul className="space-y-3 text-muted-foreground">
                <li className="flex items-start gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                  <span>Access and review your personal data</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                  <span>Disconnect any connected platform at any time</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                  <span>Request deletion of your account and associated data</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                  <span>Opt out of non-essential communications</span>
                </li>
              </ul>
            </section>

            <section className="mb-10">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-red-500/10">
                  <Mail className="w-5 h-5 text-red-500" />
                </div>
                <h2 className="text-2xl font-semibold m-0">Contact Us</h2>
              </div>
              <p className="text-muted-foreground leading-relaxed">
                If you have any questions about this Privacy Policy or our data practices, please contact us at:
              </p>
              <div className="mt-4 p-4 rounded-lg bg-slate-50 border border-slate-200">
                <p className="font-semibold text-foreground m-0">RecallJump Support</p>
                <p className="text-muted-foreground m-0">Email: support@recalljump.com</p>
              </div>
            </section>
          </div>
        </motion.div>
      </div>

      {/* Footer */}
      <footer className="border-t border-slate-200 py-8">
        <div className="container mx-auto px-6 text-center text-muted-foreground text-sm">
          © {new Date().getFullYear()} RecallJump. All rights reserved.
        </div>
      </footer>
    </div>
  );
};

export default Privacy;
