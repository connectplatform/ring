'use client'

import React, { useState } from 'react'
import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { NewsArticle, NewsStatus, NewsVisibility, NewsCategory } from '@/features/news/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { 
  CheckSquare, 
  Square, 
  Loader2, 
  Trash2, 
  Archive, 
  Upload, 
  Tag,
  Search,
  Filter,
  AlertCircle,
  CheckCircle,
  X
} from 'lucide-react'
import { formatDistanceToNow, format } from 'date-fns'
import Link from 'next/link'

interface BulkOperationsManagerProps {
  initialArticles: NewsArticle[]
  locale: string
  translations: any
}

interface BulkOperationState {
  success?: boolean
  error?: string
  message?: string
  progress?: number
  completed?: number
  total?: number
}

// Mock bulk operation actions
async function bulkPublishAction(
  prevState: BulkOperationState | null,
  formData: FormData
): Promise<BulkOperationState> {
  const articleIds = JSON.parse(formData.get('articleIds') as string)
  
  try {
    // Simulate batch processing with progress
    for (let i = 0; i < articleIds.length; i++) {
      await new Promise(resolve => setTimeout(resolve, 500)) // Simulate API call
      // Progress update would be handled via streaming or websockets in real implementation
    }
    
    return {
      success: true,
      message: `Successfully published ${articleIds.length} articles`,
      completed: articleIds.length,
      total: articleIds.length,
      progress: 100
    }
  } catch (error) {
    return { error: 'Failed to publish articles' }
  }
}

async function bulkArchiveAction(
  prevState: BulkOperationState | null,
  formData: FormData
): Promise<BulkOperationState> {
  const articleIds = JSON.parse(formData.get('articleIds') as string)
  
  try {
    for (let i = 0; i < articleIds.length; i++) {
      await new Promise(resolve => setTimeout(resolve, 300))
    }
    
    return {
      success: true,
      message: `Successfully archived ${articleIds.length} articles`,
      completed: articleIds.length,
      total: articleIds.length,
      progress: 100
    }
  } catch (error) {
    return { error: 'Failed to archive articles' }
  }
}

async function bulkDeleteAction(
  prevState: BulkOperationState | null,
  formData: FormData
): Promise<BulkOperationState> {
  const articleIds = JSON.parse(formData.get('articleIds') as string)
  
  try {
    for (let i = 0; i < articleIds.length; i++) {
      await new Promise(resolve => setTimeout(resolve, 200))
    }
    
    return {
      success: true,
      message: `Successfully deleted ${articleIds.length} articles`,
      completed: articleIds.length,
      total: articleIds.length,
      progress: 100
    }
  } catch (error) {
    return { error: 'Failed to delete articles' }
  }
}

async function bulkUpdateCategoryAction(
  prevState: BulkOperationState | null,
  formData: FormData
): Promise<BulkOperationState> {
  const articleIds = JSON.parse(formData.get('articleIds') as string)
  const newCategory = formData.get('newCategory') as NewsCategory
  
  try {
    for (let i = 0; i < articleIds.length; i++) {
      await new Promise(resolve => setTimeout(resolve, 300))
    }
    
    return {
      success: true,
      message: `Successfully updated category for ${articleIds.length} articles to "${newCategory}"`,
      completed: articleIds.length,
      total: articleIds.length,
      progress: 100
    }
  } catch (error) {
    return { error: 'Failed to update categories' }
  }
}

function BulkActionButton({ 
  action, 
  children, 
  selectedCount,
  variant = "default",
  disabled = false
}: {
  action: any
  children: React.ReactNode
  selectedCount: number
  variant?: "default" | "destructive" | "outline"
  disabled?: boolean
}) {
  const { pending } = useFormStatus()
  
  return (
    <Button
      formAction={action}
      variant={variant}
      disabled={disabled || selectedCount === 0 || pending}
      className="w-full"
    >
      {pending ? (
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
      ) : (
        children
      )}
    </Button>
  )
}

export function BulkOperationsManager({ 
  initialArticles, 
  locale, 
  translations 
}: BulkOperationsManagerProps) {
  const [articles, setArticles] = useState<NewsArticle[]>(initialArticles)
  const [selectedArticles, setSelectedArticles] = useState<Set<string>>(new Set())
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<NewsStatus | 'all'>('all')
  const [categoryFilter, setCategoryFilter] = useState<NewsCategory | 'all'>('all')

  // Bulk operation states
  const [publishState, publishAction] = useActionState(bulkPublishAction, null)
  const [archiveState, archiveAction] = useActionState(bulkArchiveAction, null)
  const [deleteState, deleteAction] = useActionState(bulkDeleteAction, null)
  const [categoryUpdateState, categoryUpdateAction] = useActionState(bulkUpdateCategoryAction, null)

  // Get current operation state
  const currentState = publishState || archiveState || deleteState || categoryUpdateState

  // Filter articles
  const filteredArticles = articles.filter(article => {
    const matchesSearch = searchTerm === '' || 
      article.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      article.excerpt.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesStatus = statusFilter === 'all' || article.status === statusFilter
    const matchesCategory = categoryFilter === 'all' || article.category === categoryFilter

    return matchesSearch && matchesStatus && matchesCategory
  })

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedArticles(new Set(filteredArticles.map(article => article.id)))
    } else {
      setSelectedArticles(new Set())
    }
  }

  const handleSelectArticle = (articleId: string, checked: boolean) => {
    const newSelected = new Set(selectedArticles)
    if (checked) {
      newSelected.add(articleId)
    } else {
      newSelected.delete(articleId)
    }
    setSelectedArticles(newSelected)
  }

  const allSelected = filteredArticles.length > 0 && 
    filteredArticles.every(article => selectedArticles.has(article.id))
  const someSelected = filteredArticles.some(article => selectedArticles.has(article.id))

  const selectedCount = selectedArticles.size

  return (
    <div className="space-y-6">
      {/* Selection Summary & Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Bulk Operations</span>
            <Badge variant="outline" className="text-sm">
              {selectedCount} selected
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Operation Status */}
          {currentState && (
            <div className="space-y-2">
              {currentState.success && (
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>{currentState.message}</AlertDescription>
                </Alert>
              )}
              
              {currentState.error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{currentState.error}</AlertDescription>
                </Alert>
              )}

              {currentState.progress !== undefined && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>Processing...</span>
                    <span>{currentState.completed || 0}/{currentState.total || 0}</span>
                  </div>
                  <Progress value={currentState.progress} className="w-full" />
                </div>
              )}
            </div>
          )}

          {/* Quick Actions */}
          <form className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <input 
              type="hidden" 
              name="articleIds" 
              value={JSON.stringify(Array.from(selectedArticles))}
            />
            
            <BulkActionButton
              action={publishAction}
              selectedCount={selectedCount}
              variant="default"
            >
              <Upload className="h-4 w-4 mr-2" />
              Publish
            </BulkActionButton>

            <BulkActionButton
              action={archiveAction}
              selectedCount={selectedCount}
              variant="outline"
            >
              <Archive className="h-4 w-4 mr-2" />
              Archive
            </BulkActionButton>

            <div className="flex gap-2">
              <Select name="newCategory" defaultValue="platform-updates">
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="platform-updates">Platform Updates</SelectItem>
                  <SelectItem value="community">Community</SelectItem>
                  <SelectItem value="partnerships">Partnerships</SelectItem>
                  <SelectItem value="industry-news">Industry News</SelectItem>
                  <SelectItem value="events">Events</SelectItem>
                  <SelectItem value="announcements">Announcements</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
              <BulkActionButton
                action={categoryUpdateAction}
                selectedCount={selectedCount}
                variant="outline"
              >
                <Tag className="h-4 w-4" />
              </BulkActionButton>
            </div>

            <BulkActionButton
              action={deleteAction}
              selectedCount={selectedCount}
              variant="destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </BulkActionButton>
          </form>
        </CardContent>
      </Card>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters & Search
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search articles..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select value={statusFilter} onValueChange={(value: any) => setStatusFilter(value)}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="published">Published</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>

            <Select value={categoryFilter} onValueChange={(value: any) => setCategoryFilter(value)}>
              <SelectTrigger>
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="platform-updates">Platform Updates</SelectItem>
                <SelectItem value="community">Community</SelectItem>
                <SelectItem value="partnerships">Partnerships</SelectItem>
                <SelectItem value="industry-news">Industry News</SelectItem>
                <SelectItem value="events">Events</SelectItem>
                <SelectItem value="announcements">Announcements</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>

            <Button 
              variant="outline" 
              onClick={() => {
                setSearchTerm('')
                setStatusFilter('all')
                setCategoryFilter('all')
                setSelectedArticles(new Set())
              }}
            >
              <X className="h-4 w-4 mr-2" />
              Clear
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Articles Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Articles ({filteredArticles.length})</span>
            <div className="flex items-center gap-2">
              <Checkbox
                checked={allSelected}
                onCheckedChange={handleSelectAll}
                className="mr-2"
              />
              <span className="text-sm text-gray-600">Select All</span>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredArticles.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No articles match your criteria.</p>
              <p className="text-sm">Adjust your filters or search terms.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={allSelected}
                        onCheckedChange={handleSelectAll}
                      />
                    </TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Views</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredArticles.map((article) => (
                    <TableRow 
                      key={article.id}
                      className={selectedArticles.has(article.id) ? 'bg-blue-50' : ''}
                    >
                      <TableCell>
                        <Checkbox
                          checked={selectedArticles.has(article.id)}
                          onCheckedChange={(checked) => 
                            handleSelectArticle(article.id, checked as boolean)
                          }
                        />
                      </TableCell>
                      <TableCell className="max-w-xs">
                        <div className="space-y-1">
                          <Link 
                            href={`/${locale}/admin/news/edit/${article.id}`}
                            className="font-medium hover:text-blue-600 line-clamp-1"
                          >
                            {article.title}
                          </Link>
                          <p className="text-sm text-gray-600 line-clamp-1">
                            {article.excerpt}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={
                          article.status === 'published' ? 'default' :
                          article.status === 'draft' ? 'secondary' : 'outline'
                        }>
                          {article.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {article.category.replace('-', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{article.views || 0}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-gray-600">
                          {format(article.createdAt.toDate(), 'MMM dd, yyyy')}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
} 