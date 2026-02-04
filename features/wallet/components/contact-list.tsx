'use client'

import React, { useState, useEffect, useTransition, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Users,
  Plus,
  Search,
  Star,
  StarOff,
  Edit,
  Trash2,
  Copy,
  Check,
  AlertTriangle,
  UserPlus,
  Loader2
} from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import type { WalletContact } from '@/features/wallet/types'

interface ContactListProps {
  embedded?: boolean
  onContactSelect?: (contact: WalletContact) => void
  locale?: string
}

/**
 * ContactList component - Manages wallet contacts with check-if-exists functionality
 * Allows users to add, view, edit, and select contacts for transactions
 */
export default function ContactList({ embedded = false, onContactSelect }: ContactListProps) {
  const t = useTranslations('modules.wallet')
  const tCommon = useTranslations('common')
  const router = useRouter()
  const { data: session } = useSession()

  // React 19 useTransition for non-blocking search updates
  const [isPending, startTransition] = useTransition()

  const [contacts, setContacts] = useState<WalletContact[]>([])
  const [filteredContacts, setFilteredContacts] = useState<WalletContact[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isAddingContact, setIsAddingContact] = useState(false)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null)

  // Add contact form state
  const [newContact, setNewContact] = useState({
    name: '',
    address: '',
    notes: ''
  })
  const [addressError, setAddressError] = useState('')
  const [isCheckingAddress, setIsCheckingAddress] = useState(false)

  // Search change handler - wrapped in useTransition for non-blocking updates
  const handleSearchChange = useCallback((value: string) => {
    startTransition(() => {
      setSearchQuery(value)
    })
  }, [startTransition])

  // API call functions
  const apiCall = async (endpoint: string, options?: RequestInit) => {
    const response = await fetch(endpoint, {
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      ...options,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'API call failed');
    }

    return response.json();
  };

  // Load contacts on mount
  useEffect(() => {
    loadContacts()
  }, [session?.user?.id])

  // Filter contacts based on search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredContacts(contacts)
    } else {
      const filtered = contacts.filter(contact =>
        contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        contact.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (contact.notes && contact.notes.toLowerCase().includes(searchQuery.toLowerCase()))
      )
      setFilteredContacts(filtered)
    }
  }, [contacts, searchQuery])

  const loadContacts = async () => {
    if (!session?.user?.id) return

    try {
      setIsLoading(true)
      const response = await apiCall('/api/wallet/contacts')
      setContacts(response.contacts || [])
    } catch (error) {
      console.error('Failed to load contacts:', error)
      toast({
        title: tCommon('error'),
        description: 'Failed to load contacts',
        variant: 'destructive'
      })
    } finally {
      setIsLoading(false)
    }
  }

  const checkAddressExists = async (address: string): Promise<boolean> => {
    if (!session?.user?.id || !address.trim()) return false

    try {
      setIsCheckingAddress(true)
      const response = await apiCall('/api/wallet/contacts/exists', {
        method: 'POST',
        body: JSON.stringify({ address: address.trim() }),
      })
      return response.exists || false
    } catch (error) {
      console.error('Failed to check address existence:', error)
      return false
    } finally {
      setIsCheckingAddress(false)
    }
  }

  const handleAddressChange = async (address: string) => {
    setNewContact(prev => ({ ...prev, address }))

    if (address.trim()) {
      const exists = await checkAddressExists(address)
      if (exists) {
        setAddressError('This address is already in your contacts')
      } else {
        setAddressError('')
      }
    } else {
      setAddressError('')
    }
  }

  const handleAddContact = async () => {
    if (!session?.user?.id) return
    if (!newContact.name.trim() || !newContact.address.trim()) {
      toast({
        title: tCommon('error'),
        description: 'Name and address are required',
        variant: 'destructive'
      })
      return
    }

    if (addressError) {
      toast({
        title: tCommon('error'),
        description: 'Please fix the address error before adding',
        variant: 'destructive'
      })
      return
    }

    try {
      setIsAddingContact(true)
      await apiCall('/api/wallet/contacts', {
        method: 'POST',
        body: JSON.stringify({
          name: newContact.name.trim(),
          address: newContact.address.trim(),
          note: newContact.notes.trim() || undefined
        }),
      })

      toast({
        title: tCommon('success'),
        description: 'Contact added successfully'
      })

      setNewContact({ name: '', address: '', notes: '' })
      setShowAddDialog(false)
      await loadContacts()
    } catch (error) {
      console.error('Failed to add contact:', error)
      toast({
        title: tCommon('error'),
        description: 'Failed to add contact',
        variant: 'destructive'
      })
    } finally {
      setIsAddingContact(false)
    }
  }

  const handleRemoveContact = async (contactId: string) => {
    if (!session?.user?.id) return

    try {
      await apiCall(`/api/wallet/contacts/${contactId}`, {
        method: 'DELETE',
      })
      toast({
        title: tCommon('success'),
        description: 'Contact removed successfully'
      })
      await loadContacts()
    } catch (error) {
      console.error('Failed to remove contact:', error)
      toast({
        title: tCommon('error'),
        description: 'Failed to remove contact',
        variant: 'destructive'
      })
    }
  }

  const handleCopyAddress = async (address: string) => {
    try {
      await navigator.clipboard.writeText(address)
      setCopiedAddress(address)
      toast({
        title: tCommon('success'),
        description: 'Address copied to clipboard'
      })
      setTimeout(() => setCopiedAddress(null), 2000)
    } catch (error) {
      toast({
        title: tCommon('error'),
        description: 'Failed to copy address',
        variant: 'destructive'
      })
    }
  }

  const handleContactSelect = (contact: WalletContact) => {
    if (onContactSelect) {
      onContactSelect(contact)
    } else {
      // Default behavior - copy address for transactions
      handleCopyAddress(contact.address)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading contacts...</p>
        </div>
      </div>
    )
  }

  return (
    <div className={embedded ? "space-y-6" : "container mx-auto px-4 py-8"}>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-3">
            <Users className="h-8 w-8" />
            {t('contacts') || 'Contacts'}
          </h2>
          <p className="text-muted-foreground mt-2">
            Manage your wallet contacts for easy token transfers
          </p>
        </div>

        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Contact
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Add New Contact</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  placeholder="Contact name"
                  value={newContact.name}
                  onChange={(e) => setNewContact(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Wallet Address</Label>
                <Input
                  id="address"
                  placeholder="0x..."
                  value={newContact.address}
                  onChange={(e) => handleAddressChange(e.target.value)}
                />
                {isCheckingAddress && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Checking address...
                  </div>
                )}
                {addressError && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>{addressError}</AlertDescription>
                  </Alert>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes (Optional)</Label>
                <Textarea
                  id="notes"
                  placeholder="Additional notes about this contact"
                  value={newContact.notes}
                  onChange={(e) => setNewContact(prev => ({ ...prev, notes: e.target.value }))}
                />
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setShowAddDialog(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleAddContact}
                  disabled={isAddingContact || !newContact.name.trim() || !newContact.address.trim() || !!addressError}
                  className="flex-1"
                >
                  {isAddingContact ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    <>
                      <UserPlus className="h-4 w-4 mr-2" />
                      Add Contact
                    </>
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search contacts by name, address, or notes..."
          value={searchQuery}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Contact List */}
      <div className="space-y-4">
        {filteredContacts.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Users className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">
                {contacts.length === 0 ? 'No contacts yet' : 'No contacts found'}
              </h3>
              <p className="text-muted-foreground text-center mb-4">
                {contacts.length === 0
                  ? 'Add your first contact to make token transfers easier'
                  : 'Try adjusting your search terms'
                }
              </p>
              {contacts.length === 0 && (
                <Button onClick={() => setShowAddDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Your First Contact
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          filteredContacts.map((contact) => (
            <Card key={contact.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-medium">{contact.name}</h3>
                      {contact.isFavorite && (
                        <Star className="h-4 w-4 text-yellow-500 fill-current" />
                      )}
                      {contact.isDefault && (
                        <Badge variant="secondary">Default</Badge>
                      )}
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <code className="text-sm bg-muted px-2 py-1 rounded font-mono break-all">
                          {contact.address}
                        </code>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCopyAddress(contact.address)}
                        >
                          {copiedAddress === contact.address ? (
                            <Check className="h-4 w-4 text-green-500" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                      </div>

                      {contact.notes && (
                        <p className="text-sm text-muted-foreground">{contact.notes}</p>
                      )}

                      <p className="text-xs text-muted-foreground">
                        Added {new Date(contact.addedAt).toLocaleDateString()}
                        {contact.lastUsed && ` • Last used ${new Date(contact.lastUsed).toLocaleDateString()}`}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 ml-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleContactSelect(contact)}
                    >
                      {onContactSelect ? 'Select' : 'Use for Transfer'}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveContact(contact.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Summary */}
      <div className="text-sm text-muted-foreground text-center">
        {filteredContacts.length} of {contacts.length} contacts shown
      </div>
    </div>
  )
}
