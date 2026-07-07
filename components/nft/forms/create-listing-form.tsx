'use client'

import React from 'react'
import { useFormStatus } from 'react-dom'
import { motion } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'

// Submit button driven by react-dom's useFormStatus
function SubmitBtn() {
  const { pending } = useFormStatus()
  return (
    <Button
      type="submit"
      disabled={pending}
      className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm hover:shadow-md transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed w-full"
    >
      {pending ? 'Creating Listing...' : 'Create NFT Listing'}
    </Button>
  )
}

export default function CreateListingForm({ username }: { username: string }) {
  // Store any error or success status for UI feedback
  const [error, setError] = React.useState<string | null>(null)
  const [success, setSuccess] = React.useState<string | null>(null)

  // Handles form submission for creating and activating NFT listing
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    // Clear previous state
    setError(null)
    setSuccess(null)

    const form = e.currentTarget
    const formData = new FormData(form)

    // Get standard, defaulting to ERC721 for safety
    const selectedStandard = String(formData.get('standard') || 'ERC721')
    const standard: 'ERC721' | 'ERC1155' = selectedStandard === 'ERC1155' ? 'ERC1155' : 'ERC721'

    // Build the item object for the API request; default chainId to 137 (Polygon)
    const item: { address: string; tokenId: string; standard: 'ERC721' | 'ERC1155'; chainId: number } = {
      address: String(formData.get('address') || ''),
      tokenId: String(formData.get('tokenId') || ''),
      standard,
      chainId: Number(formData.get('chainId') || '137')
    }

    // Construct the whole request payload including seller username and pricing
    const payload = {
      sellerUsername: username,
      item,
      price: { amount: String(formData.get('amount') || ''), currency: String(formData.get('currency') || 'NATIVE') }
    }

    try {
      // POST the draft listing to the marketplace API
      const res = await fetch('/api/nft-market/listings', {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: { 'Content-Type': 'application/json' }
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Failed to create draft')
      const draftId = json.id as string

      // Dynamically load client code to execute on-chain and activate
      // TODO: Consider using React 19 useAction or server actions with formAction for submission and progressive enhancement.
      const mod = await import('@/features/nft-market/client/create-listing')
      await mod.createListingOnChainAndActivateClient(draftId, payload.item, payload.price.amount)
      setSuccess('Listing created and activated.')
      form.reset()
    } catch (e: any) {
      setError(e?.message || 'Failed to create listing')
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
    >
      <Card className="border-border shadow-lg">
        <CardHeader className="bg-gradient-to-br from-purple-500/5 via-blue-500/5 to-cyan-500/5">
          <CardTitle className="text-lg">Create NFT Listing</CardTitle>
          <p className="text-sm text-muted-foreground">
            List your NFT for sale on the marketplace
          </p>
        </CardHeader>
        <CardContent className="pt-6">
          {/* Step progress indicator. Could be a separate Stepper UI component. */}
          <motion.div
            className="flex items-center justify-center space-x-4 mb-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <div className="flex items-center space-x-2">
              <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-semibold text-xs">
                1
              </div>
              <span className="text-xs font-medium text-foreground">NFT Details</span>
            </div>
            <div className="w-8 h-px bg-border"></div>
            <div className="flex items-center space-x-2">
              <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-muted-foreground font-semibold text-xs">
                2
              </div>
              <span className="text-xs font-medium text-muted-foreground">Pricing</span>
            </div>
            <div className="w-8 h-px bg-border"></div>
            <div className="flex items-center space-x-2">
              <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-muted-foreground font-semibold text-xs">
                3
              </div>
              <span className="text-xs font-medium text-muted-foreground">List</span>
            </div>
          </motion.div>

          {/* NFT creation form */}
          <form onSubmit={onSubmit} className="space-y-4">
            {/* Display any error or success messages */}
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            {success && (
              <Alert className="border-green-200 bg-green-50 text-green-800">
                <AlertDescription>{success}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-4">
              {/* NFT contract address input */}
              <div>
                <Label htmlFor="address">NFT Contract Address *</Label>
                <Input
                  id="address"
                  name="address"
                  placeholder="0x..."
                  required
                  className="mt-1"
                />
              </div>
              {/* Token ID and Standard selector */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="tokenId">Token ID *</Label>
                  <Input
                    id="tokenId"
                    name="tokenId"
                    placeholder="123"
                    required
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="standard">Standard *</Label>
                  <Select name="standard" defaultValue="ERC721" required>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select standard" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ERC721">ERC721</SelectItem>
                      <SelectItem value="ERC1155">ERC1155</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {/* Chain ID and Currency selector */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="chainId">Chain ID</Label>
                  <Input
                    id="chainId"
                    name="chainId"
                    defaultValue="137"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="currency">Currency *</Label>
                  <Select name="currency" defaultValue="NATIVE" required>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select currency" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NATIVE">NATIVE</SelectItem>
                      <SelectItem value="DAAR">DAAR</SelectItem>
                      <SelectItem value="DAARION">DAARION</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {/* Amount (Listing Price) */}
              <div>
                <Label htmlFor="amount">Price Amount *</Label>
                <Input
                  id="amount"
                  name="amount"
                  type="number"
                  step="0.01"
                  placeholder="0.1"
                  required
                  className="mt-1"
                />
              </div>
              {/* Submission button */}
              <SubmitBtn />
              {/* TODO: Use React 19's useFormState/useFormStatus and Next.js 16 formAction for server-driven, progressively enhanced form experience. */}
            </div>
          </form>
        </CardContent>
      </Card>
    </motion.div>
  )
}
