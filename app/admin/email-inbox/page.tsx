'use client';

/**
 * Email Inbox Admin Dashboard
 * ===========================
 * View and manage incoming emails for info@ringdom.org
 */

import React, { useState, useEffect } from 'react';
import { 
  Mail, Search, Filter, RefreshCw, Eye, Send, Archive, Trash2,
  AlertTriangle, CheckCircle, Clock, User, Building, Tag
} from 'lucide-react';

interface EmailThread {
  id: string;
  subject: string;
  fromEmail: string;
  fromName: string | null;
  status: 'new' | 'ongoing' | 'waiting' | 'resolved';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  intent: string;
  sentiment: string;
  messageCount: number;
  hasDraft: boolean;
  lastMessageAt: string;
  createdAt: string;
  contact: {
    type: string;
    company: string | null;
    interactions: number;
  };
}

// Mock data for demo
const MOCK_THREADS: EmailThread[] = [
  {
    id: 'thread_1',
    subject: 'Enterprise inquiry about Ring Platform deployment',
    fromEmail: 'john@bigcorp.com',
    fromName: 'John Smith',
    status: 'new',
    priority: 'urgent',
    intent: 'enterprise_inquiry',
    sentiment: 'neutral',
    messageCount: 1,
    hasDraft: true,
    lastMessageAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    contact: { type: 'lead', company: 'BigCorp Inc', interactions: 1 },
  },
  {
    id: 'thread_2',
    subject: 'Help with authentication setup',
    fromEmail: 'dev@startup.io',
    fromName: 'Sarah Developer',
    status: 'ongoing',
    priority: 'normal',
    intent: 'technical_support',
    sentiment: 'frustrated',
    messageCount: 3,
    hasDraft: true,
    lastMessageAt: new Date(Date.now() - 3600000).toISOString(),
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    contact: { type: 'customer', company: 'Startup.io', interactions: 5 },
  },
  {
    id: 'thread_3',
    subject: 'Feature request: Dark mode support',
    fromEmail: 'user@example.com',
    fromName: null,
    status: 'waiting',
    priority: 'low',
    intent: 'feature_request',
    sentiment: 'positive',
    messageCount: 2,
    hasDraft: false,
    lastMessageAt: new Date(Date.now() - 7200000).toISOString(),
    createdAt: new Date(Date.now() - 172800000).toISOString(),
    contact: { type: 'lead', company: null, interactions: 2 },
  },
];

const statusColors = {
  new: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  ongoing: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  waiting: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  resolved: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
};

const priorityColors = {
  low: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
  normal: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  high: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  urgent: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
};

const sentimentColors = {
  positive: 'text-green-600 dark:text-green-400',
  neutral: 'text-gray-600 dark:text-gray-400',
  negative: 'text-red-600 dark:text-red-400',
  frustrated: 'text-orange-600 dark:text-orange-400',
};

export default function EmailInboxPage() {
  const [threads, setThreads] = useState<EmailThread[]>(MOCK_THREADS);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedThread, setSelectedThread] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const filteredThreads = threads.filter(thread => {
    const matchesSearch = 
      thread.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      thread.fromEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (thread.fromName?.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesStatus = statusFilter === 'all' || thread.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const handleRefresh = () => {
    setIsLoading(true);
    // Simulate API call
    setTimeout(() => setIsLoading(false), 1000);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    if (diff < 3600000) {
      const mins = Math.floor(diff / 60000);
      return `${mins}m ago`;
    } else if (diff < 86400000) {
      const hours = Math.floor(diff / 3600000);
      return `${hours}h ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Mail className="h-8 w-8 text-blue-600 dark:text-blue-400" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Email Inbox</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                info@ringdom.org • {threads.filter(t => t.status === 'new').length} new
              </p>
            </div>
          </div>
          
          <button
            onClick={handleRefresh}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search emails..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Status</option>
            <option value="new">New</option>
            <option value="ongoing">Ongoing</option>
            <option value="waiting">Waiting</option>
            <option value="resolved">Resolved</option>
          </select>
        </div>

        {/* Email List */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {filteredThreads.length === 0 ? (
              <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                No emails found
              </div>
            ) : (
              filteredThreads.map((thread) => (
                <div
                  key={thread.id}
                  className={`p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors ${
                    selectedThread === thread.id ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                  }`}
                  onClick={() => setSelectedThread(thread.id === selectedThread ? null : thread.id)}
                >
                  <div className="flex items-start gap-4">
                    {/* Priority indicator */}
                    <div className={`w-1 h-16 rounded-full ${
                      thread.priority === 'urgent' ? 'bg-red-500' :
                      thread.priority === 'high' ? 'bg-orange-500' :
                      thread.priority === 'normal' ? 'bg-blue-500' : 'bg-gray-300'
                    }`} />
                    
                    {/* Main content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-gray-900 dark:text-white truncate">
                          {thread.fromName || thread.fromEmail}
                        </span>
                        {thread.contact.company && (
                          <span className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400">
                            <Building className="h-3 w-3" />
                            {thread.contact.company}
                          </span>
                        )}
                        <span className={`text-xs px-2 py-0.5 rounded-full ${statusColors[thread.status]}`}>
                          {thread.status}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${priorityColors[thread.priority]}`}>
                          {thread.priority}
                        </span>
                      </div>
                      
                      <h3 className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-1">
                        {thread.subject}
                      </h3>
                      
                      <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                        <span className="flex items-center gap-1">
                          <Tag className="h-3 w-3" />
                          {thread.intent.replace('_', ' ')}
                        </span>
                        <span className={`flex items-center gap-1 ${sentimentColors[thread.sentiment as keyof typeof sentimentColors] || 'text-gray-500'}`}>
                          {thread.sentiment}
                        </span>
                        <span className="flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {thread.messageCount} messages
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDate(thread.lastMessageAt)}
                        </span>
                      </div>
                    </div>
                    
                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      {thread.hasDraft && (
                        <span className="px-2 py-1 text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 rounded-full">
                          Draft Ready
                        </span>
                      )}
                      <button className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                        <Eye className="h-4 w-4" />
                      </button>
                      <button className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors">
                        <Send className="h-4 w-4" />
                      </button>
                      <button className="p-2 text-gray-400 hover:text-yellow-600 hover:bg-yellow-50 rounded-lg transition-colors">
                        <Archive className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Stats bar */}
        <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {threads.filter(t => t.status === 'new').length}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">New Emails</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {threads.filter(t => t.hasDraft).length}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Drafts Ready</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
            <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
              {threads.filter(t => t.priority === 'urgent' || t.priority === 'high').length}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">High Priority</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
            <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
              {threads.filter(t => t.sentiment === 'frustrated' || t.sentiment === 'negative').length}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Needs Attention</div>
          </div>
        </div>
      </div>
    </div>
  );
}
