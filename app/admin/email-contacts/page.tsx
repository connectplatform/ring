'use client';

/**
 * Email Contacts CRM Dashboard
 * ============================
 * Manage email contacts and view interaction history
 */

import React, { useState } from 'react';
import { 
  Users, Search, Filter, Plus, Eye, Edit, Trash2,
  Building, Mail, Clock, TrendingUp, TrendingDown, Minus,
  Tag, ExternalLink, UserCheck
} from 'lucide-react';

interface Contact {
  id: string;
  email: string;
  name: string | null;
  company: string | null;
  type: 'lead' | 'customer' | 'partner' | 'vendor' | 'spam';
  tags: string[];
  ringUserId: string | null;
  firstContact: string;
  lastContact: string;
  totalInteractions: number;
  sentimentTrend: 'improving' | 'stable' | 'declining' | 'unknown';
  recentSentiment: string;
}

// Mock data
const MOCK_CONTACTS: Contact[] = [
  {
    id: 'contact_1',
    email: 'john@bigcorp.com',
    name: 'John Smith',
    company: 'BigCorp Inc',
    type: 'lead',
    tags: ['enterprise', 'priority'],
    ringUserId: null,
    firstContact: new Date().toISOString(),
    lastContact: new Date().toISOString(),
    totalInteractions: 1,
    sentimentTrend: 'unknown',
    recentSentiment: 'neutral',
  },
  {
    id: 'contact_2',
    email: 'dev@startup.io',
    name: 'Sarah Developer',
    company: 'Startup.io',
    type: 'customer',
    tags: ['technical', 'active'],
    ringUserId: 'user_12345',
    firstContact: new Date(Date.now() - 30 * 86400000).toISOString(),
    lastContact: new Date(Date.now() - 3600000).toISOString(),
    totalInteractions: 15,
    sentimentTrend: 'improving',
    recentSentiment: 'positive',
  },
  {
    id: 'contact_3',
    email: 'cto@enterprise.co',
    name: 'Michael Chen',
    company: 'Enterprise Co',
    type: 'partner',
    tags: ['partner', 'vip'],
    ringUserId: 'user_67890',
    firstContact: new Date(Date.now() - 90 * 86400000).toISOString(),
    lastContact: new Date(Date.now() - 172800000).toISOString(),
    totalInteractions: 42,
    sentimentTrend: 'stable',
    recentSentiment: 'positive',
  },
  {
    id: 'contact_4',
    email: 'user@example.com',
    name: null,
    company: null,
    type: 'lead',
    tags: [],
    ringUserId: null,
    firstContact: new Date(Date.now() - 172800000).toISOString(),
    lastContact: new Date(Date.now() - 7200000).toISOString(),
    totalInteractions: 2,
    sentimentTrend: 'unknown',
    recentSentiment: 'positive',
  },
];

const typeColors = {
  lead: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  customer: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  partner: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  vendor: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  spam: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
};

const sentimentColors = {
  positive: 'text-green-600 dark:text-green-400',
  neutral: 'text-gray-600 dark:text-gray-400',
  negative: 'text-red-600 dark:text-red-400',
  frustrated: 'text-orange-600 dark:text-orange-400',
};

const TrendIcon = ({ trend }: { trend: string }) => {
  switch (trend) {
    case 'improving':
      return <TrendingUp className="h-4 w-4 text-green-500" />;
    case 'declining':
      return <TrendingDown className="h-4 w-4 text-red-500" />;
    case 'stable':
      return <Minus className="h-4 w-4 text-gray-500" />;
    default:
      return null;
  }
};

export default function EmailContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>(MOCK_CONTACTS);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);

  const filteredContacts = contacts.filter(contact => {
    const matchesSearch = 
      contact.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (contact.name?.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (contact.company?.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesType = typeFilter === 'all' || contact.type === typeFilter;
    
    return matchesSearch && matchesType;
  });

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const getDaysSince = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    return Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Users className="h-8 w-8 text-green-600 dark:text-green-400" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Email Contacts</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {contacts.length} contacts • {contacts.filter(c => c.type === 'customer').length} customers
              </p>
            </div>
          </div>
          
          <button className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
            <Plus className="h-4 w-4" />
            Add Contact
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {contacts.filter(c => c.type === 'lead').length}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Leads</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {contacts.filter(c => c.type === 'customer').length}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Customers</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
            <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
              {contacts.filter(c => c.ringUserId).length}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Ring Users</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
            <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
              {contacts.filter(c => c.sentimentTrend === 'declining').length}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">At Risk</div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search contacts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>
          
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500"
          >
            <option value="all">All Types</option>
            <option value="lead">Leads</option>
            <option value="customer">Customers</option>
            <option value="partner">Partners</option>
            <option value="vendor">Vendors</option>
            <option value="spam">Spam</option>
          </select>
        </div>

        {/* Contacts Table */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Contact
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Interactions
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Sentiment
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Last Contact
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredContacts.map((contact) => (
                  <tr 
                    key={contact.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer"
                    onClick={() => setSelectedContact(contact)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10 bg-gray-200 dark:bg-gray-600 rounded-full flex items-center justify-center">
                          <span className="text-gray-600 dark:text-gray-300 font-medium">
                            {contact.name ? contact.name[0].toUpperCase() : contact.email[0].toUpperCase()}
                          </span>
                        </div>
                        <div className="ml-4">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-900 dark:text-white">
                              {contact.name || contact.email}
                            </span>
                            {contact.ringUserId && (
                              <span title="Ring Platform User">
                                <UserCheck className="h-4 w-4 text-green-500" />
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                            <Mail className="h-3 w-3" />
                            {contact.email}
                          </div>
                          {contact.company && (
                            <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                              <Building className="h-3 w-3" />
                              {contact.company}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs rounded-full ${typeColors[contact.type]}`}>
                        {contact.type}
                      </span>
                      <div className="flex gap-1 mt-1">
                        {contact.tags.slice(0, 2).map((tag) => (
                          <span 
                            key={tag}
                            className="px-1.5 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded"
                          >
                            {tag}
                          </span>
                        ))}
                        {contact.tags.length > 2 && (
                          <span className="text-xs text-gray-500">+{contact.tags.length - 2}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {contact.totalInteractions}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <TrendIcon trend={contact.sentimentTrend} />
                        <span className={`text-sm ${sentimentColors[contact.recentSentiment as keyof typeof sentimentColors] || 'text-gray-500'}`}>
                          {contact.recentSentiment}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 dark:text-white">
                        {formatDate(contact.lastContact)}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {getDaysSince(contact.lastContact)} days ago
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                          <Eye className="h-4 w-4" />
                        </button>
                        <button className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors">
                          <Edit className="h-4 w-4" />
                        </button>
                        <button className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {filteredContacts.length === 0 && (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
              No contacts found
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
