'use client'

import React, { useState, useCallback, useRef, useEffect } from 'react'
import { useFormatter, useTranslations } from 'next-intl'
import { useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Upload,
  FileText,
  Save,
  Download,
  X,
  CheckCircle,
  Loader2,
  FileUp,
  Sparkles,
  Send,
  RefreshCw,
  PenTool,
  BookOpen,
  Quote,
  AlertCircle,
  Settings,
  History
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ScientificEditor } from '@/components/editor'
import { VersionHistoryPanel } from '@/components/editor/version-history-panel'
import { useAutoSave } from '@/hooks/use-auto-save'

interface FileInfo {
  name: string
  size: number
  type: string
  content: string
  lastModified: Date
}

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

/**
 * Zemna.AI Scientific Editor Page
 * 
 * Phase 2 Implementation:
 * - Tiptap-powered rich text editor
 * - Professional toolbar with scientific formatting
 * - File import (PDF, DOC, TXT, MD) with processing
 * - AI Research Assistant sidebar
 * - Auto-save and version history (Phase 2.3)
 * - Export capabilities (coming soon)
 */
export default function EditorPage() {
  const t = useTranslations('editor.page')
  const tVersion = useTranslations('editor.versionHistory')
  const tTpl = useTranslations('editor.templates')
  const format = useFormatter()
  const searchParams = useSearchParams()
  const idFromUrl = searchParams.get('id')

  // Publication id: from URL or set after first save
  const [publicationId, setPublicationId] = useState<string | null>(null)
  const [loadIdApplied, setLoadIdApplied] = useState(false)

  const {
    save: saveToApi,
    isSaving,
    lastSaved: autoSaveLastSaved,
    lastError: autoSaveError,
    touch
  } = useAutoSave({
    delayMs: 30000,
    onFirstSave: (id) => setPublicationId(id)
  })

  // Editor state
  const [documentTitle, setDocumentTitle] = useState(() => t('untitledPublication'))
  const [editorContent, setEditorContent] = useState<string>('')
  const [editorJson, setEditorJson] = useState<object | null>(null)
  const [wordCount, setWordCount] = useState(0)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [showVersionHistory, setShowVersionHistory] = useState(false)
  
  // Import modal state
  const [showImportModal, setShowImportModal] = useState(false)
  const [uploadedFile, setUploadedFile] = useState<FileInfo | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  
  // AI Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      role: 'assistant',
      content: t('initialChat'),
      timestamp: new Date(),
    },
  ])
  const [chatInput, setChatInput] = useState('')
  const [isAiTyping, setIsAiTyping] = useState(false)
  
  const fileInputRef = useRef<HTMLInputElement>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)

  const defaultTemplate = tTpl('defaultDocument', {
    date: format.dateTime(new Date(), { dateStyle: 'medium' }),
  })

  // Load publication from URL ?id= or set default template
  useEffect(() => {
    if (loadIdApplied) return
    if (idFromUrl) {
      setLoadIdApplied(true)
      setPublicationId(idFromUrl)
      fetch(`/api/publications/${idFromUrl}`)
        .then((res) => {
          if (!res.ok) return
          return res.json()
        })
        .then((json) => {
          if (!json?.data?.data) return
          const d = json.data.data
          setDocumentTitle(d.title ?? documentTitle)
          setEditorJson(d.content ?? null)
          if (d.content && typeof d.content === 'object') {
            setEditorContent('')
          }
        })
        .catch(() => {})
    } else {
      if (!editorContent) {
        setEditorContent(defaultTemplate.trim())
      }
      setLoadIdApplied(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idFromUrl])

  // Debounced auto-save when content or title changes
  const currentPublicationId = publicationId ?? idFromUrl
  useEffect(() => {
    if (!loadIdApplied || !editorJson) return
    touch(currentPublicationId, {
      title: documentTitle,
      content: editorJson as Record<string, unknown>
    })
  }, [documentTitle, editorJson, currentPublicationId, loadIdApplied, touch])

  // Scroll to bottom of chat when new messages arrive
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  // Handle editor content change
  const handleEditorChange = useCallback((html: string, json: object) => {
    setEditorContent(html)
    setEditorJson(json)
    setHasUnsavedChanges(true)
  }, [])

  // Handle word count change
  const handleWordCountChange = useCallback((count: number) => {
    setWordCount(count)
  }, [])

  // File upload handler
  const handleFileUpload = useCallback(async (file: File) => {
    const reader = new FileReader()
    
    reader.onload = (e) => {
      const content = e.target?.result as string
      setUploadedFile({
        name: file.name,
        size: file.size,
        type: file.type,
        content,
        lastModified: new Date(file.lastModified)
      })
    }
    
    if (file.type === 'application/pdf') {
      // For PDF, we'd need a PDF parser - for now, show message
      setUploadedFile({
        name: file.name,
        size: file.size,
        type: file.type,
        content: `[PDF Content - ${file.name}]\n\nPDF processing requires server-side parsing. The file has been uploaded and is ready for processing.`,
        lastModified: new Date(file.lastModified)
      })
    } else {
      reader.readAsText(file)
    }
  }, [])

  // Drag and drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    
    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) {
      handleFileUpload(files[0])
    }
  }, [handleFileUpload])

  // Process imported file - convert to HTML for Tiptap
  const processFile = useCallback(() => {
    if (!uploadedFile) return
    
    setIsProcessing(true)
    
    setTimeout(() => {
      let processedContent = uploadedFile.content
      
      // Convert markdown-like content to HTML
      processedContent = processedContent
        // Headers
        .replace(/^### (.*$)/gim, '<h3>$1</h3>')
        .replace(/^## (.*$)/gim, '<h2>$1</h2>')
        .replace(/^# (.*$)/gim, '<h1>$1</h1>')
        // Bold and italic
        .replace(/\*\*\*(.*?)\*\*\*/gim, '<strong><em>$1</em></strong>')
        .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/gim, '<em>$1</em>')
        // Lists
        .replace(/^\* (.*$)/gim, '<li>$1</li>')
        .replace(/^- (.*$)/gim, '<li>$1</li>')
        // Paragraphs
        .replace(/\n\n/g, '</p><p>')
        .replace(/\n/g, '<br/>')
      
      // Wrap in title and metadata
      const importedHtml = `
<h1>${uploadedFile.name.replace(/\.[^/.]+$/, '')}</h1>
<p><em>Imported from: ${uploadedFile.name} • Date: ${new Date().toLocaleDateString()}</em></p>
<hr/>
<p>${processedContent}</p>
`.trim()
      
      setEditorContent(importedHtml)
      setDocumentTitle(uploadedFile.name.replace(/\.[^/.]+$/, ''))
      setIsProcessing(false)
      setShowImportModal(false)
      setUploadedFile(null)
      setHasUnsavedChanges(true)
    }, 1500)
  }, [uploadedFile])

  // Save document (manual save)
  const handleSave = useCallback(async () => {
    const id = await saveToApi(publicationId ?? idFromUrl, {
      title: documentTitle,
      content: (editorJson ?? {}) as Record<string, unknown>
    })
    if (id && !publicationId) setPublicationId(id)
    setHasUnsavedChanges(false)
  }, [publicationId, idFromUrl, documentTitle, editorJson, saveToApi])

  // Send chat message
  const handleSendMessage = useCallback(async () => {
    if (!chatInput.trim()) return
    
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: chatInput,
      timestamp: new Date()
    }
    
    setChatMessages(prev => [...prev, userMessage])
    setChatInput('')
    setIsAiTyping(true)
    
    // TODO: Integrate with actual AI API
    setTimeout(() => {
      const aiResponse: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: t('chatStubResponse'),
        timestamp: new Date()
      }
      setChatMessages(prev => [...prev, aiResponse])
      setIsAiTyping(false)
    }, 2000)
  }, [chatInput, t])

  // Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  return (
    <div className="h-[calc(100vh-80px)] flex flex-row bg-background overflow-hidden">
      {/* Main Editor Area */}
      <div className="flex-1 flex flex-col border-r border-border">
        {/* Editor Header */}
        <div className="px-6 py-4 border-b border-border bg-muted/30 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#1e3a5f] to-[#4a9b8c] flex items-center justify-center">
              <PenTool className="w-5 h-5 text-white" />
            </div>
            <div>
              <input
                type="text"
                value={documentTitle}
                onChange={(e) => {
                  setDocumentTitle(e.target.value)
                  setHasUnsavedChanges(true)
                }}
                className="text-xl font-semibold bg-transparent border-none outline-none focus:ring-0 text-foreground w-full"
                placeholder={t('documentTitlePlaceholder')}
              />
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Zemna.AI</span>
                <span>•</span>
                <span>{t('editor')}</span>
                {hasUnsavedChanges && (
                  <>
                    <span>•</span>
                    <span className="text-amber-500">
                      {t('unsavedChanges')}
                    </span>
                  </>
                )}
                {autoSaveLastSaved && !hasUnsavedChanges && (
                  <>
                    <span>•</span>
                    <span className="flex items-center gap-1 text-green-600">
                      <CheckCircle className="w-3 h-3" />
                      {t('saved')} {autoSaveLastSaved.toLocaleTimeString()}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Version History Button */}
            <Button
              variant="ghost"
              size="sm"
              className="gap-2"
              title={tVersion('title')}
              onClick={() => setShowVersionHistory(true)}
            >
              <History className="w-4 h-4" />
            </Button>
            
            {/* Import Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowImportModal(true)}
              className="gap-2"
            >
              <Upload className="w-4 h-4" />
              {t('import')}
            </Button>
            
            {/* Save Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleSave}
              disabled={isSaving}
              className="gap-2"
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {t('save')}
            </Button>
            
            {/* Export Button */}
            <Button
              size="sm"
              className="gap-2 bg-gradient-to-r from-[#1e3a5f] to-[#4a9b8c] hover:from-[#2d4a6f] hover:to-[#5aab9c]"
            >
              <Download className="w-4 h-4" />
              {t('export')}
            </Button>
          </div>
        </div>

        {/* Tiptap Scientific Editor */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <ScientificEditor
            content={(editorJson ?? editorContent) as string | Record<string, unknown>}
            placeholder={t('editorPlaceholder')}
            onChange={handleEditorChange}
            onWordCountChange={handleWordCountChange}
          />
        </div>

      </div>

      {/* Right Sidebar - AI Assistant */}
      <div className="w-[380px] flex flex-col bg-muted/20">
        {/* Chat Header */}
        <div className="px-6 py-4 border-b border-border bg-gradient-to-r from-[#1e3a5f]/10 to-[#4a9b8c]/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#1e3a5f] to-[#4a9b8c] flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">
                  {t('aiAssistant')}
                </h3>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <span className="w-2 h-2 rounded-full bg-green-500"></span>
                  {t('online')}
                </div>
              </div>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="px-4 py-3 border-b border-border flex gap-2 overflow-x-auto">
          <Badge variant="secondary" className="cursor-pointer hover:bg-[#1e3a5f]/20 whitespace-nowrap">
            <BookOpen className="w-3 h-3 mr-1" />
            {t('literature')}
          </Badge>
          <Badge variant="secondary" className="cursor-pointer hover:bg-[#1e3a5f]/20 whitespace-nowrap">
            <Quote className="w-3 h-3 mr-1" />
            {t('citations')}
          </Badge>
          <Badge variant="secondary" className="cursor-pointer hover:bg-[#1e3a5f]/20 whitespace-nowrap">
            <PenTool className="w-3 h-3 mr-1" />
            {t('edit')}
          </Badge>
        </div>

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {chatMessages.map((message) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex gap-3 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}
            >
              <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center ${
                message.role === 'assistant' 
                  ? 'bg-gradient-to-br from-[#1e3a5f] to-[#4a9b8c]' 
                  : 'bg-muted'
              }`}>
                {message.role === 'assistant' ? '🤖' : '👤'}
              </div>
              <div className={`flex-1 p-3 rounded-xl ${
                message.role === 'assistant'
                  ? 'bg-background border border-border'
                  : 'bg-[#1e3a5f] text-white'
              }`}>
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                <span className="text-xs opacity-60 mt-2 block">
                  {message.timestamp.toLocaleTimeString()}
                </span>
              </div>
            </motion.div>
          ))}
          
          {isAiTyping && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex gap-3"
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#1e3a5f] to-[#4a9b8c] flex items-center justify-center">
                🤖
              </div>
              <div className="bg-background border border-border p-3 rounded-xl">
                <div className="flex gap-1">
                  <span className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '0ms' }}></span>
                  <span className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '150ms' }}></span>
                  <span className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '300ms' }}></span>
                </div>
              </div>
            </motion.div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Chat Input */}
        <div className="p-4 border-t border-border bg-background">
          <div className="flex gap-2">
            <Input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder={t('askAboutResearch')}
              className="flex-1"
            />
            <Button
              onClick={handleSendMessage}
              disabled={!chatInput.trim() || isAiTyping}
              className="bg-gradient-to-r from-[#1e3a5f] to-[#4a9b8c] hover:from-[#2d4a6f] hover:to-[#5aab9c]"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Import Modal */}
      <Dialog open={showImportModal} onOpenChange={setShowImportModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5 text-[#1e3a5f]" />
              {t('importDocument')}
            </DialogTitle>
            <DialogDescription>
              {t('importDocumentDesc')}
            </DialogDescription>
          </DialogHeader>

          {!uploadedFile ? (
            // Upload Zone
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`
                border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors
                ${isDragging 
                  ? 'border-[#1e3a5f] bg-[#1e3a5f]/5' 
                  : 'border-border hover:border-[#1e3a5f]/50 hover:bg-muted/50'
                }
              `}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.doc,.docx,.txt,.md,.markdown"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) handleFileUpload(file)
                }}
                className="hidden"
              />
              <FileUp className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-foreground font-medium mb-1">
                {t('dragDrop')}
              </p>
              <p className="text-sm text-muted-foreground">
                PDF, DOC, DOCX, TXT, MD • Max 10MB
              </p>
            </div>
          ) : (
            // File Info
            <div className="space-y-4">
              <div className="flex items-start gap-4 p-4 rounded-xl bg-muted/50 border border-border">
                <div className="w-12 h-12 rounded-lg bg-[#1e3a5f]/10 flex items-center justify-center flex-shrink-0">
                  <FileText className="w-6 h-6 text-[#1e3a5f]" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-foreground truncate">{uploadedFile.name}</h4>
                  <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                    <span>{formatFileSize(uploadedFile.size)}</span>
                    <span>•</span>
                    <span>{uploadedFile.type || 'Unknown type'}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t('lastModified')}: {uploadedFile.lastModified.toLocaleString()}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setUploadedFile(null)}
                  className="h-8 w-8 flex-shrink-0"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>

              {/* Preview */}
              <div className="border border-border rounded-lg max-h-40 overflow-y-auto">
                <div className="p-3 bg-muted/30 border-b border-border text-xs font-medium text-muted-foreground">
                  {t('preview')}
                </div>
                <pre className="p-3 text-xs text-muted-foreground whitespace-pre-wrap">
                  {uploadedFile.content.slice(0, 500)}
                  {uploadedFile.content.length > 500 && '...'}
                </pre>
              </div>

              {/* Info Banner */}
              <div className="flex items-start gap-3 p-3 rounded-lg bg-[#d4a574]/10 border border-[#d4a574]/20">
                <AlertCircle className="w-5 h-5 text-[#d4a574] flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-foreground">
                    {t('readyToProcess')}
                  </p>
                  <p className="text-muted-foreground">
                    {t('readyToProcessDesc')}
                  </p>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowImportModal(false)
                setUploadedFile(null)
              }}
            >
              {t('cancel')}
            </Button>
            <Button
              onClick={processFile}
              disabled={!uploadedFile || isProcessing}
              className="bg-gradient-to-r from-[#1e3a5f] to-[#4a9b8c] hover:from-[#2d4a6f] hover:to-[#5aab9c]"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {t('processing')}
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  {t('process')}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <VersionHistoryPanel
        open={showVersionHistory}
        onOpenChange={setShowVersionHistory}
        publicationId={publicationId ?? idFromUrl}
        onRestore={async () => {
          const id = publicationId ?? idFromUrl
          if (!id) return
          const res = await fetch(`/api/publications/${id}`)
          if (!res.ok) return
          const json = await res.json()
          const d = json?.data?.data
          if (d) {
            setDocumentTitle(d.title ?? documentTitle)
            setEditorJson(d.content ?? null)
            if (d.content && typeof d.content === 'object') setEditorContent('')
          }
        }}
      />
    </div>
  )
}
