import React from 'react'
import { Button } from '@/components/ui/button'
import { Twitter, Facebook, Linkedin, Link2, Send } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface SocialShareProps {
  title: string
  url: string
  description?: string
  hashtags?: string[]
  className?: string
}

export function SocialShare({ title, url, description, hashtags = [], className = '' }: SocialShareProps) {
  const { toast } = useToast()

  const encodedTitle = encodeURIComponent(title)
  const encodedUrl = encodeURIComponent(url)
  const encodedDescription = encodeURIComponent(description || '')
  const encodedHashtags = hashtags.map(tag => encodeURIComponent(tag)).join(',')

  const shareLinks = {
    twitter: `https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}&hashtags=${encodedHashtags}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
    telegram: `https://t.me/share/url?url=${encodedUrl}&text=${encodedTitle}`
  }

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(url)
      toast({
        title: "Link copied!",
        description: "Article link has been copied to your clipboard.",
      })
    } catch (err) {
      toast({
        title: "Failed to copy",
        description: "Please copy the URL manually.",
        variant: "destructive"
      })
    }
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span className="text-sm font-medium text-muted-foreground mr-2">Share:</span>

      <Button
        variant="outline"
        size="sm"
        onClick={() => window.open(shareLinks.twitter, '_blank', 'width=600,height=400')}
        className="hover:bg-blue-50 hover:border-blue-200"
      >
        <Twitter className="h-4 w-4 text-blue-500" />
        <span className="sr-only">Share on Twitter</span>
      </Button>

      <Button
        variant="outline"
        size="sm"
        onClick={() => window.open(shareLinks.facebook, '_blank', 'width=600,height=400')}
        className="hover:bg-blue-50 hover:border-blue-200"
      >
        <Facebook className="h-4 w-4 text-blue-600" />
        <span className="sr-only">Share on Facebook</span>
      </Button>

      <Button
        variant="outline"
        size="sm"
        onClick={() => window.open(shareLinks.linkedin, '_blank', 'width=600,height=400')}
        className="hover:bg-blue-50 hover:border-blue-200"
      >
        <Linkedin className="h-4 w-4 text-blue-700" />
        <span className="sr-only">Share on LinkedIn</span>
      </Button>

      <Button
        variant="outline"
        size="sm"
        onClick={() => window.open(shareLinks.telegram, '_blank', 'width=600,height=400')}
        className="hover:bg-blue-50 hover:border-blue-200"
      >
        <Send className="h-4 w-4 text-blue-500" />
        <span className="sr-only">Share on Telegram</span>
      </Button>

      <Button
        variant="outline"
        size="sm"
        onClick={copyToClipboard}
        className="hover:bg-gray-50 hover:border-gray-200"
      >
        <Link2 className="h-4 w-4 text-gray-600" />
        <span className="sr-only">Copy link</span>
      </Button>
    </div>
  )
}
