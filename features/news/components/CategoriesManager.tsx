'use client'

import React, { useState } from 'react'
import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { NewsCategoryInfo, NewsCategory } from '@/features/news/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Plus, 
  MoreHorizontal, 
  Edit, 
  Trash2, 
  Loader2,
  CheckCircle,
  AlertCircle,
  Palette,
  Tag
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

interface CategoriesManagerProps {
  initialCategories: NewsCategoryInfo[]
  locale: string
  translations: any
}

interface CategoryFormState {
  success?: boolean
  error?: string
  message?: string
}

// Mock actions - to be replaced with actual server actions
async function createCategoryAction(
  prevState: CategoryFormState | null,
  formData: FormData
): Promise<CategoryFormState> {
  const name = formData.get('name') as string
  const description = formData.get('description') as string
  const color = formData.get('color') as string
  const icon = formData.get('icon') as string

  if (!name?.trim()) {
    return { error: 'Category name is required' }
  }

  try {
    // TODO: Implement actual API call
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    return {
      success: true,
      message: `Category "${name}" created successfully`
    }
  } catch (error) {
    return { error: 'Failed to create category' }
  }
}

async function updateCategoryAction(
  prevState: CategoryFormState | null,
  formData: FormData
): Promise<CategoryFormState> {
  const id = formData.get('id') as string
  const name = formData.get('name') as string
  const description = formData.get('description') as string
  const color = formData.get('color') as string
  const icon = formData.get('icon') as string

  if (!id || !name?.trim()) {
    return { error: 'Category ID and name are required' }
  }

  try {
    // TODO: Implement actual API call
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    return {
      success: true,
      message: `Category "${name}" updated successfully`
    }
  } catch (error) {
    return { error: 'Failed to update category' }
  }
}

async function deleteCategoryAction(categoryId: string): Promise<CategoryFormState> {
  try {
    // TODO: Implement actual API call
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    return {
      success: true,
      message: 'Category deleted successfully'
    }
  } catch (error) {
    return { error: 'Failed to delete category' }
  }
}

// Color palette for categories
const CATEGORY_COLORS = [
  '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', 
  '#EC4899', '#14B8A6', '#F97316', '#6366F1', '#84CC16'
]

// Icon options
const CATEGORY_ICONS = [
  '📢', '🚀', '👥', '🤝', '📰', '🎉', '📊', '💼', '🔧', '⚡'
]

function CategoryForm({ 
  mode, 
  category, 
  onSuccess 
}: { 
  mode: 'create' | 'edit'
  category?: NewsCategoryInfo
  onSuccess?: () => void
}) {
  const [formData, setFormData] = useState({
    name: category?.name || '',
    description: category?.description || '',
    color: category?.color || CATEGORY_COLORS[0],
    icon: category?.icon || CATEGORY_ICONS[0]
  })

  const [createState, createAction] = useActionState(createCategoryAction, null)
  const [updateState, updateAction] = useActionState(updateCategoryAction, null)
  
  const currentState = mode === 'create' ? createState : updateState
  const currentAction = mode === 'create' ? createAction : updateAction

  const handleSubmit = async (formDataObj: FormData) => {
    if (mode === 'edit' && category?.id) {
      formDataObj.append('id', category.id)
    }
    
    // Server actions return void in form action context, but we can access state
    currentAction(formDataObj)
    
    // Success handling is managed through state updates in the component
    // The onSuccess callback will be triggered by state changes
    setTimeout(() => {
      if (currentState?.success) {
        onSuccess?.()
      }
    }, 100)
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      {/* Alerts */}
      {currentState?.success && (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>{currentState.message}</AlertDescription>
        </Alert>
      )}
      
      {currentState?.error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{currentState.error}</AlertDescription>
        </Alert>
      )}

      {/* Name */}
      <div className="space-y-2">
        <Label htmlFor="name">Category Name *</Label>
        <Input
          id="name"
          name="name"
          value={formData.name}
          onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
          placeholder="Enter category name..."
          required
        />
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          name="description"
          value={formData.description}
          onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
          placeholder="Describe this category..."
          rows={3}
        />
      </div>

      {/* Color Selection */}
      <div className="space-y-2">
        <Label>Category Color</Label>
        <div className="flex items-center gap-2">
          {CATEGORY_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              className={`w-8 h-8 rounded-full border-2 ${
                formData.color === color ? 'border-gray-800' : 'border-gray-300'
              }`}
              style={{ backgroundColor: color }}
              onClick={() => setFormData(prev => ({ ...prev, color }))}
            />
          ))}
          <input
            type="hidden"
            name="color"
            value={formData.color}
          />
        </div>
      </div>

      {/* Icon Selection */}
      <div className="space-y-2">
        <Label>Category Icon</Label>
        <div className="flex items-center gap-2 flex-wrap">
          {CATEGORY_ICONS.map((icon) => (
            <button
              key={icon}
              type="button"
              className={`w-10 h-10 rounded border-2 flex items-center justify-center text-lg ${
                formData.icon === icon ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
              }`}
              onClick={() => setFormData(prev => ({ ...prev, icon }))}
            >
              {icon}
            </button>
          ))}
          <input
            type="hidden"
            name="icon"
            value={formData.icon}
          />
        </div>
      </div>

      {/* Preview */}
      <div className="space-y-2">
        <Label>Preview</Label>
        <div className="flex items-center gap-2">
          <div 
            className="px-3 py-1 rounded text-white text-sm font-medium"
            style={{ backgroundColor: formData.color }}
          >
            {formData.icon} {formData.name || 'Category Name'}
          </div>
        </div>
      </div>

      <SubmitButton mode={mode} />
    </form>
  )
}

function SubmitButton({ mode }: { mode: 'create' | 'edit' }) {
  const { pending } = useFormStatus()
  
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? (
        <>
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          {mode === 'create' ? 'Creating...' : 'Updating...'}
        </>
      ) : (
        <>
          {mode === 'create' ? (
            <><Plus className="h-4 w-4 mr-2" />Create Category</>
          ) : (
            <><Edit className="h-4 w-4 mr-2" />Update Category</>
          )}
        </>
      )}
    </Button>
  )
}

export function CategoriesManager({ 
  initialCategories, 
  locale, 
  translations 
}: CategoriesManagerProps) {
  const [categories, setCategories] = useState<NewsCategoryInfo[]>(initialCategories)
  const [selectedCategory, setSelectedCategory] = useState<NewsCategoryInfo | null>(null)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)

  const handleDeleteCategory = async (categoryId: string) => {
    if (!confirm('Are you sure you want to delete this category? This action cannot be undone.')) {
      return
    }

    try {
      const result = await deleteCategoryAction(categoryId)
      if (result && result.success) {
        setCategories(prev => prev.filter(cat => cat.id !== categoryId))
      } else {
        alert(result?.error || 'Failed to delete category')
      }
    } catch (error) {
      console.error('Error deleting category:', error)
      alert('Failed to delete category')
    }
  }

  const handleCreateSuccess = () => {
    setShowCreateDialog(false)
    // TODO: Refresh categories list from API
    window.location.reload()
  }

  const handleEditSuccess = () => {
    setShowEditDialog(false)
    setSelectedCategory(null)
    // TODO: Refresh categories list from API
    window.location.reload()
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-bold">Categories</h2>
          <Badge variant="outline" className="text-sm">
            {categories.length} total
          </Badge>
        </div>
        
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Category
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Category</DialogTitle>
              <DialogDescription>
                Add a new category for organizing news articles.
              </DialogDescription>
            </DialogHeader>
            <CategoryForm 
              mode="create" 
              onSuccess={handleCreateSuccess}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Categories List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5" />
            All Categories
          </CardTitle>
        </CardHeader>
        <CardContent>
          {categories.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Tag className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No categories found.</p>
              <p className="text-sm">Create your first category to get started.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Category</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Articles Count</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categories.map((category) => (
                  <TableRow key={category.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div 
                          className="px-2 py-1 rounded text-white text-sm font-medium"
                          style={{ backgroundColor: category.color }}
                        >
                          {category.icon} {category.name}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm text-gray-600 max-w-xs truncate">
                        {category.description || 'No description'}
                      </p>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-sm">
                        0 articles {/* TODO: Add actual count */}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm text-gray-500">
                        {formatDistanceToNow(category.createdAt.toDate(), { addSuffix: true })}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem 
                            onClick={() => {
                              setSelectedCategory(category)
                              setShowEditDialog(true)
                            }}
                          >
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleDeleteCategory(category.id)}
                            className="text-red-600"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Category</DialogTitle>
            <DialogDescription>
              Update the category information and appearance.
            </DialogDescription>
          </DialogHeader>
          {selectedCategory && (
            <CategoryForm 
              mode="edit" 
              category={selectedCategory}
              onSuccess={handleEditSuccess}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
} 