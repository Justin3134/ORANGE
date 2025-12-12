import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, FileText, Scale, AlertTriangle, CheckCircle, XCircle, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import logo from "@/assets/logo.png";

const Terms = () => {
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
              <FileText className="w-4 h-4" />
              <span className="text-sm font-medium">Terms of Service</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-display font-medium mb-4">
              Terms of Service
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
                  <Scale className="w-5 h-5 text-blue-500" />
                </div>
                <h2 className="text-2xl font-semibold m-0">Agreement to Terms</h2>
              </div>
              <p className="text-muted-foreground leading-relaxed">
                By accessing or using RecallJump ("Service"), you agree to be bound by these Terms of Service. If you disagree with any part of these terms, you may not access the Service.
              </p>
            </section>

            <section className="mb-10">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-green-500/10">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                </div>
                <h2 className="text-2xl font-semibold m-0">Description of Service</h2>
              </div>
              <p className="text-muted-foreground leading-relaxed mb-4">
                RecallJump provides an AI-powered search service that allows users to search across their connected messaging platforms including:
              </p>
              <ul className="space-y-3 text-muted-foreground">
                <li className="flex items-start gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                  <span>Gmail - Search your email messages and conversations</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                  <span>Discord - Search server messages where our bot is present</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                  <span>Slack - Search workspace conversations you have access to</span>
                </li>
              </ul>
            </section>

            <section className="mb-10">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-purple-500/10">
                  <FileText className="w-5 h-5 text-purple-500" />
                </div>
                <h2 className="text-2xl font-semibold m-0">User Responsibilities</h2>
              </div>
              <div className="space-y-4 text-muted-foreground">
                <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                  <h3 className="font-semibold text-foreground mb-2">Account Security</h3>
                  <p className="m-0">You are responsible for maintaining the confidentiality of your connected accounts. Any activities that occur under your accounts are your responsibility.</p>
                </div>
                <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                  <h3 className="font-semibold text-foreground mb-2">Authorized Use</h3>
                  <p className="m-0">You may only connect accounts that you own or have explicit permission to access. You must not use RecallJump to access data you are not authorized to view.</p>
                </div>
                <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                  <h3 className="font-semibold text-foreground mb-2">Compliance</h3>
                  <p className="m-0">You agree to comply with all applicable laws and regulations while using our Service, including data protection and privacy laws.</p>
                </div>
              </div>
            </section>

            <section className="mb-10">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-red-500/10">
                  <XCircle className="w-5 h-5 text-red-500" />
                </div>
                <h2 className="text-2xl font-semibold m-0">Prohibited Activities</h2>
              </div>
              <p className="text-muted-foreground leading-relaxed mb-4">
                You agree not to:
              </p>
              <ul className="space-y-3 text-muted-foreground">
                <li className="flex items-start gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 mt-2 flex-shrink-0" />
                  <span>Use the Service for any illegal or unauthorized purpose</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 mt-2 flex-shrink-0" />
                  <span>Attempt to access accounts or data that don't belong to you</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 mt-2 flex-shrink-0" />
                  <span>Interfere with or disrupt the Service or its servers</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 mt-2 flex-shrink-0" />
                  <span>Reverse engineer or attempt to extract source code</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 mt-2 flex-shrink-0" />
                  <span>Use automated tools to access the Service without permission</span>
                </li>
              </ul>
            </section>

            <section className="mb-10">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-orange-500/10">
                  <AlertTriangle className="w-5 h-5 text-orange-500" />
                </div>
                <h2 className="text-2xl font-semibold m-0">Disclaimer of Warranties</h2>
              </div>
              <div className="p-4 rounded-lg bg-orange-50 border border-orange-200 text-muted-foreground">
                <p className="m-0">
                  THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED. WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, SECURE, OR ERROR-FREE. AI-GENERATED SEARCH RESULTS MAY NOT ALWAYS BE ACCURATE OR COMPLETE.
                </p>
              </div>
            </section>

            <section className="mb-10">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-indigo-500/10">
                  <Scale className="w-5 h-5 text-indigo-500" />
                </div>
                <h2 className="text-2xl font-semibold m-0">Limitation of Liability</h2>
              </div>
              <p className="text-muted-foreground leading-relaxed">
                To the maximum extent permitted by law, RecallJump shall not be liable for any indirect, incidental, special, consequential, or punitive damages, or any loss of profits or revenues, whether incurred directly or indirectly, or any loss of data, use, goodwill, or other intangible losses resulting from your use of the Service.
              </p>
            </section>

            <section className="mb-10">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-slate-500/10">
                  <FileText className="w-5 h-5 text-slate-500" />
                </div>
                <h2 className="text-2xl font-semibold m-0">Termination</h2>
              </div>
              <p className="text-muted-foreground leading-relaxed">
                We may terminate or suspend your access to the Service immediately, without prior notice or liability, for any reason, including if you breach these Terms. Upon termination, your right to use the Service will immediately cease.
              </p>
            </section>

            <section className="mb-10">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-teal-500/10">
                  <HelpCircle className="w-5 h-5 text-teal-500" />
                </div>
                <h2 className="text-2xl font-semibold m-0">Changes to Terms</h2>
              </div>
              <p className="text-muted-foreground leading-relaxed">
                We reserve the right to modify or replace these Terms at any time. If a revision is material, we will provide at least 30 days notice prior to any new terms taking effect. What constitutes a material change will be determined at our sole discretion.
              </p>
            </section>

            <section className="mb-10">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <Scale className="w-5 h-5 text-blue-500" />
                </div>
                <h2 className="text-2xl font-semibold m-0">Contact Information</h2>
              </div>
              <p className="text-muted-foreground leading-relaxed">
                If you have any questions about these Terms, please contact us at:
              </p>
              <div className="mt-4 p-4 rounded-lg bg-slate-50 border border-slate-200">
                <p className="font-semibold text-foreground m-0">RecallJump Legal</p>
                <p className="text-muted-foreground m-0">Email: legal@recalljump.com</p>
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

export default Terms;
