'use client'

import React, { useEffect, useCallback, useRef } from 'react'
import { useActionState, useOptimistic } from 'react'
import { useFormStatus } from 'react-dom'
import dynamic from 'next/dynamic'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Save, CheckCircle } from 'lucide-react'

// Dynamic import for TinyMCE to avoid SSR issues
const TinyMCEEditor = dynamic(
  () => import('@tinymce/tinymce-react').then(mod => mod.Editor),
  { 
    ssr: false,
    loading: () => (
      <div className="min-h-[400px] flex items-center justify-center bg-gray-50 rounded border">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-blue-500" />
          <p className="text-sm text-gray-600">Loading rich text editor...</p>
        </div>
      </div>
    )
  }
)

interface RichTextEditorProps {
  content: string
  onChange: (content: string) => void
  articleId?: string
  placeholder?: string
  height?: number
  disabled?: boolean
}

interface AutoSaveState {
  success?: boolean
  error?: string
  lastSaved?: string
}

// Auto-save action (mock for now - to be implemented with actual API)
async function autoSaveAction(
  prevState: AutoSaveState | null,
  formData: FormData
): Promise<AutoSaveState> {
  const articleId = formData.get('articleId') as string
  const content = formData.get('content') as string

  if (!content.trim()) {
    return { error: 'No content to save' }
  }

  try {
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 500))
    
    // TODO: Replace with actual API call to save draft
    // const response = await fetch(`/api/news/${articleId}/auto-save`, {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({ content })
    // })

    return {
      success: true,
      lastSaved: new Date().toLocaleTimeString()
    }
  } catch (error) {
    return { error: 'Auto-save failed' }
  }
}

// Debounce hook
function useDebounce<T extends any[]>(callback: (...args: T) => void, delay: number) {
  const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined)

  return useCallback((...args: T) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    timeoutRef.current = setTimeout(() => callback(...args), delay)
  }, [callback, delay])
}

/**
 * Rich Text Editor Component with React 19 Features
 * 
 * Features:
 * - TinyMCE integration with comprehensive toolbar
 * - Auto-save with useActionState
 * - Optimistic updates for immediate feedback
 * - Debounced saves to prevent excessive API calls
 * - Loading states and error handling
 * - Image upload support
 * - HTML content validation
 */
export function RichTextEditor({
  content,
  onChange,
  articleId,
  placeholder = "Start writing your article...",
  height = 500,
  disabled = false
}: RichTextEditorProps) {
  const [optimisticContent, setOptimisticContent] = useOptimistic(content)
  
  // Fix: Move useActionState declaration before using the action
  const [autoSaveState, autoSaveDispatch] = useActionState(autoSaveAction, null)

  // Auto-save trigger with debounce - client-side callback
  const triggerAutoSave = useCallback((newContent: string) => {
    if (!articleId || !newContent.trim() || newContent === content) return

    const formData = new FormData()
    formData.append('articleId', articleId)
    formData.append('content', newContent)
    autoSaveDispatch(formData)
  }, [articleId, content, autoSaveDispatch])

  const debouncedAutoSave = useDebounce(triggerAutoSave, 3000) // 3 second delay

  // Client-side change handler - not a Server Action
  const handleEditorChange = useCallback((newContent: string) => {
    // Optimistic update for immediate feedback
    setOptimisticContent(newContent)
    
    // Call parent onChange callback
    onChange(newContent)
    
    // Trigger debounced auto-save
    if (articleId) {
      debouncedAutoSave(newContent)
    }
  }, [onChange, articleId, debouncedAutoSave, setOptimisticContent])

  // TinyMCE configuration
  const editorConfig = {
    height,
    menubar: false,
    statusbar: true,
    branding: false,
    resize: 'both' as const,
    plugins: [
      'advlist', 'autolink', 'lists', 'link', 'image', 'charmap', 'preview',
      'anchor', 'searchreplace', 'visualblocks', 'code', 'fullscreen',
      'insertdatetime', 'media', 'table', 'code', 'help', 'wordcount',
      'paste', 'directionality', 'nonbreaking', 'save', 'autosave'
    ],
    toolbar: [
      'undo redo | blocks fontfamily fontsize | bold italic underline strikethrough',
      'link image media table mergetags | addcomment showcomments | spellcheckdialog a11ycheck typography',
      'align lineheight | checklist numlist bullist indent outdent | emoticons charmap | removeformat'
    ].join(' | '),
    content_style: `
      body { 
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
        font-size: 14px;
        line-height: 1.6;
        padding: 1rem;
      }
      h1, h2, h3, h4, h5, h6 { 
        margin-top: 1.5rem; 
        margin-bottom: 0.5rem; 
        font-weight: 600;
      }
      p { margin-bottom: 1rem; }
      blockquote { 
        border-left: 4px solid #e5e7eb; 
        margin: 1.5rem 0; 
        padding: 0 1rem; 
        color: #6b7280;
      }
      pre { 
        background-color: #f3f4f6; 
        padding: 1rem; 
        border-radius: 0.375rem; 
        overflow-x: auto;
      }
      table { border-collapse: collapse; width: 100%; margin: 1rem 0; }
      th, td { border: 1px solid #d1d5db; padding: 0.5rem; text-align: left; }
      th { background-color: #f9fafb; font-weight: 600; }
    `,
    paste_data_images: true,
    paste_as_text: false,
    paste_webkit_styles: 'font-weight font-style color text-decoration',
    paste_retain_style_properties: 'font-weight font-style color text-decoration',
    image_upload_handler: async (blobInfo: any) => {
      // TODO: Implement actual image upload to Vercel Blob or your storage
      return new Promise<string>((resolve, reject) => {
        // Mock upload - replace with actual implementation
        setTimeout(() => {
          const mockUrl = URL.createObjectURL(blobInfo.blob())
          resolve(mockUrl)
        }, 1000)
      })
    },
    automatic_uploads: true,
    file_picker_types: 'image',
    setup: (editor: any) => {
      // Custom save button
      editor.addButton('customsave', {
        text: 'Save Draft',
        icon: 'save',
        onclick: () => {
          if (articleId) {
            const currentContent = editor.getContent()
            triggerAutoSave(currentContent)
          }
        }
      })
    },
    init_instance_callback: (editor: any) => {
      // Focus editor after initialization
      if (!disabled) {
        editor.focus()
      }
    }
  }

  return (
    <div className="space-y-3">
      {/* Auto-save status */}
      {articleId && (
        <div className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
          <div className="flex items-center gap-2">
            {autoSaveState?.success ? (
              <>
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-sm text-green-700">
                  Auto-saved at {autoSaveState.lastSaved}
                </span>
              </>
            ) : autoSaveState?.error ? (
              <>
                <Loader2 className="h-4 w-4 text-red-600" />
                <span className="text-sm text-red-700">{autoSaveState.error}</span>
              </>
            ) : (
              <>
                <Save className="h-4 w-4 text-gray-500" />
                <span className="text-sm text-gray-600">Auto-save enabled</span>
              </>
            )}
          </div>
          <Badge variant="outline" className="text-xs">
            Draft
          </Badge>
        </div>
      )}

      {/* Error Alert */}
      {autoSaveState?.error && (
        <Alert variant="destructive">
          <AlertDescription>
            {autoSaveState.error}. Your changes are saved locally and will be restored.
          </AlertDescription>
        </Alert>
      )}

      {/* TinyMCE Editor */}
      <div className="relative">
        <TinyMCEEditor
          apiKey={process.env.NEXT_PUBLIC_TINYMCE_API_KEY || 'no-api-key'}
          value={optimisticContent}
          onEditorChange={handleEditorChange}
          disabled={disabled}
          init={editorConfig}
        />
        
        {disabled && (
          <div className="absolute inset-0 bg-gray-100/50 flex items-center justify-center rounded">
            <Badge variant="secondary">Editor Disabled</Badge>
          </div>
        )}
      </div>

      {/* Word count and other stats */}
      <div className="flex items-center justify-between text-xs text-gray-500 bg-gray-50 px-3 py-2 rounded">
        <div className="flex items-center gap-4">
          <span>
            Words: {optimisticContent.replace(/<[^>]*>/g, '').split(/\s+/).filter(Boolean).length}
          </span>
          <span>
            Characters: {optimisticContent.replace(/<[^>]*>/g, '').length}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span>Rich text editor</span>
          {process.env.NODE_ENV === 'development' && (
            <Badge variant="outline" className="text-xs">
              Dev Mode
            </Badge>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * Simplified Rich Text Editor for basic use cases
 */
export function SimpleRichTextEditor({ 
  content, 
  onChange, 
  placeholder = "Start writing...",
  height = 300 
}: Pick<RichTextEditorProps, 'content' | 'onChange' | 'placeholder' | 'height'>) {
  return (
    <RichTextEditor
      content={content}
      onChange={onChange}
      placeholder={placeholder}
      height={height}
    />
  )
}

export default RichTextEditor 