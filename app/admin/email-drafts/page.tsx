'use client';

/**
 * Email Drafts Review Dashboard
 * =============================
 * Review, edit, and approve AI-generated email responses
 */

import React, { useState } from 'react';
import { 
  FileText, Check, X, Edit, Send, Eye, Clock, Sparkles,
  AlertTriangle, ChevronDown, ChevronUp, Zap
} from 'lucide-react';

interface Draft {
  id: string;
  threadId: string;
  originalSubject: string;
  originalFrom: string;
  originalBody: string;
  draftContent: string;
  confidenceScore: number;
  modelUsed: string;
  status: 'pending' | 'approved' | 'edited' | 'sent' | 'rejected' | 'auto_sent';
  toolsUsed: string[];
  securityPassed: boolean;
  createdAt: string;
  intent: string;
  canAutoSend: boolean;
}

// Mock data
const MOCK_DRAFTS: Draft[] = [
  {
    id: 'draft_1',
    threadId: 'thread_1',
    originalSubject: 'Enterprise inquiry about Ring Platform deployment',
    originalFrom: 'john@bigcorp.com',
    originalBody: 'Hi, we are considering Ring Platform for our enterprise deployment. Can you tell us more about pricing and support options for 500+ users?',
    draftContent: `Dear John,

Thank you for your interest in Ring Platform for your enterprise deployment!

Ring Platform is indeed well-suited for large-scale deployments like yours. For organizations with 500+ users, we offer:

**Enterprise Features:**
- Dedicated support with guaranteed response times
- Custom SLA agreements
- On-premise deployment options
- Priority feature development
- Training and onboarding assistance

**Pricing:**
Enterprise pricing is customized based on your specific needs. I'd love to schedule a call to discuss your requirements in detail and provide a tailored proposal.

Would you be available for a 30-minute call this week? Please let me know your preferred times, and I'll send a calendar invite.

Best regards,
Ring Platform Team`,
    confidenceScore: 0.87,
    modelUsed: 'claude-sonnet-4-20250514',
    status: 'pending',
    toolsUsed: ['search_knowledge_base', 'create_task'],
    securityPassed: true,
    createdAt: new Date().toISOString(),
    intent: 'enterprise_inquiry',
    canAutoSend: false,
  },
  {
    id: 'draft_2',
    threadId: 'thread_2',
    originalSubject: 'Help with authentication setup',
    originalFrom: 'dev@startup.io',
    originalBody: 'I\'ve been trying to set up Auth.js with Ring Platform but keep getting a callback URL error. Can you help?',
    draftContent: `Hi Sarah,

I'm sorry to hear you're running into issues with the Auth.js setup. The callback URL error is a common configuration issue that's usually quick to fix.

**Here's what to check:**

1. **Environment Variables:** Ensure your \`.env.local\` file has:
\`\`\`
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-here
\`\`\`

2. **Auth Provider Config:** Your callback URL in your OAuth provider (Google, GitHub, etc.) should be:
\`\`\`
http://localhost:3000/api/auth/callback/[provider]
\`\`\`

3. **Production URLs:** If deploying, update both the environment variable and OAuth provider callback URL to your production domain.

For detailed documentation, see: https://docs.ringdom.org/auth/setup

If you're still having trouble, could you share the specific error message? That will help me pinpoint the issue.

Best,
Ring Platform Support`,
    confidenceScore: 0.93,
    modelUsed: 'claude-sonnet-4-20250514',
    status: 'pending',
    toolsUsed: ['search_knowledge_base'],
    securityPassed: true,
    createdAt: new Date(Date.now() - 1800000).toISOString(),
    intent: 'technical_support',
    canAutoSend: false,
  },
  {
    id: 'draft_3',
    threadId: 'thread_3',
    originalSubject: 'Feature request: Dark mode support',
    originalFrom: 'user@example.com',
    originalBody: 'Would love to see dark mode added to the dashboard. Eyes hurt after long coding sessions!',
    draftContent: `Hello!

Thank you for the feature suggestion! Dark mode is definitely on our radar - your eyes will thank you soon!

We're currently planning our Q2 roadmap, and UI themes including dark mode are being considered. Your feedback helps us prioritize!

I've added your request to our feature tracking system. You can follow the progress on our public roadmap: https://ringdom.org/roadmap

In the meantime, you might find browser extensions like Dark Reader helpful for reducing eye strain.

Thanks for being part of the Ring Platform community!

Cheers,
Ring Platform Team`,
    confidenceScore: 0.96,
    modelUsed: 'claude-haiku-4-5-20250514',
    status: 'pending',
    toolsUsed: ['create_task'],
    securityPassed: true,
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    intent: 'feature_request',
    canAutoSend: true,
  },
];

const statusColors = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  approved: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  edited: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  sent: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  auto_sent: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
};

export default function EmailDraftsPage() {
  const [drafts, setDrafts] = useState<Draft[]>(MOCK_DRAFTS);
  const [expandedDraft, setExpandedDraft] = useState<string | null>(null);
  const [editingDraft, setEditingDraft] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');

  const handleApprove = (draftId: string) => {
    setDrafts(prev => prev.map(d => 
      d.id === draftId ? { ...d, status: 'approved' as const } : d
    ));
  };

  const handleReject = (draftId: string) => {
    setDrafts(prev => prev.map(d => 
      d.id === draftId ? { ...d, status: 'rejected' as const } : d
    ));
  };

  const handleEdit = (draft: Draft) => {
    setEditingDraft(draft.id);
    setEditContent(draft.draftContent);
  };

  const handleSaveEdit = (draftId: string) => {
    setDrafts(prev => prev.map(d => 
      d.id === draftId ? { ...d, draftContent: editContent, status: 'edited' as const } : d
    ));
    setEditingDraft(null);
    setEditContent('');
  };

  const handleAutoSend = (draftId: string) => {
    setDrafts(prev => prev.map(d => 
      d.id === draftId ? { ...d, status: 'auto_sent' as const } : d
    ));
  };

  const getConfidenceColor = (score: number) => {
    if (score >= 0.9) return 'text-green-600 dark:text-green-400';
    if (score >= 0.8) return 'text-blue-600 dark:text-blue-400';
    if (score >= 0.7) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  const pendingDrafts = drafts.filter(d => d.status === 'pending');
  const processedDrafts = drafts.filter(d => d.status !== 'pending');

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <FileText className="h-8 w-8 text-purple-600 dark:text-purple-400" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Draft Review Queue</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {pendingDrafts.length} drafts awaiting review
              </p>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
            <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
              {pendingDrafts.length}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Pending Review</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {drafts.filter(d => d.confidenceScore >= 0.9).length}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">High Confidence</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
            <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
              {drafts.filter(d => d.status === 'auto_sent').length}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Auto-Sent Today</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {Math.round(drafts.reduce((acc, d) => acc + d.confidenceScore, 0) / drafts.length * 100)}%
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Avg Confidence</div>
          </div>
        </div>

        {/* Pending Drafts */}
        {pendingDrafts.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Pending Review
            </h2>
            <div className="space-y-4">
              {pendingDrafts.map((draft) => (
                <div
                  key={draft.id}
                  className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden"
                >
                  {/* Header */}
                  <div 
                    className="p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50"
                    onClick={() => setExpandedDraft(expandedDraft === draft.id ? null : draft.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <Sparkles className={`h-5 w-5 ${getConfidenceColor(draft.confidenceScore)}`} />
                          <span className={`font-medium ${getConfidenceColor(draft.confidenceScore)}`}>
                            {Math.round(draft.confidenceScore * 100)}%
                          </span>
                        </div>
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          Re: {draft.originalSubject}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${statusColors[draft.status]}`}>
                          {draft.status}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {draft.canAutoSend && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleAutoSend(draft.id); }}
                            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                          >
                            <Zap className="h-4 w-4" />
                            Auto-Send
                          </button>
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); handleApprove(draft.id); }}
                          className="flex items-center gap-1 px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700"
                        >
                          <Check className="h-4 w-4" />
                          Approve
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleEdit(draft); }}
                          className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                        >
                          <Edit className="h-4 w-4" />
                          Edit
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleReject(draft.id); }}
                          className="flex items-center gap-1 px-3 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700"
                        >
                          <X className="h-4 w-4" />
                          Reject
                        </button>
                        {expandedDraft === draft.id ? (
                          <ChevronUp className="h-5 w-5 text-gray-400" />
                        ) : (
                          <ChevronDown className="h-5 w-5 text-gray-400" />
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-500 dark:text-gray-400">
                      <span>From: {draft.originalFrom}</span>
                      <span>Model: {draft.modelUsed.split('-').slice(1, 3).join(' ')}</span>
                      <span>Tools: {draft.toolsUsed.join(', ') || 'None'}</span>
                      {!draft.securityPassed && (
                        <span className="flex items-center gap-1 text-orange-600">
                          <AlertTriangle className="h-3 w-3" />
                          Security flagged
                        </span>
                      )}
                    </div>
                  </div>
                  
                  {/* Expanded content */}
                  {expandedDraft === draft.id && (
                    <div className="border-t border-gray-200 dark:border-gray-700 p-4">
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {/* Original email */}
                        <div>
                          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Original Email
                          </h4>
                          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 text-sm text-gray-600 dark:text-gray-300">
                            {draft.originalBody}
                          </div>
                        </div>
                        
                        {/* Draft response */}
                        <div>
                          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            AI Draft Response
                          </h4>
                          {editingDraft === draft.id ? (
                            <div>
                              <textarea
                                value={editContent}
                                onChange={(e) => setEditContent(e.target.value)}
                                className="w-full h-64 p-4 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                              />
                              <div className="flex justify-end gap-2 mt-2">
                                <button
                                  onClick={() => setEditingDraft(null)}
                                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
                                >
                                  Cancel
                                </button>
                                <button
                                  onClick={() => handleSaveEdit(draft.id)}
                                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                                >
                                  Save & Approve
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 text-sm text-gray-700 dark:text-gray-200 whitespace-pre-wrap">
                              {draft.draftContent}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Processed Drafts */}
        {processedDrafts.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Recently Processed
            </h2>
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {processedDrafts.slice(0, 5).map((draft) => (
                  <div key={draft.id} className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${statusColors[draft.status]}`}>
                          {draft.status.replace('_', ' ')}
                        </span>
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          {draft.originalSubject}
                        </span>
                      </div>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {Math.round(draft.confidenceScore * 100)}% confidence
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
