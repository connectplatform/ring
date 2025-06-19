'use client'

import React from 'react'
import { useOptimistic, useActionState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslation } from '@/node_modules/react-i18next'
import { useSession } from 'next-auth/react'
import { 
  CheckCircle2, 
  Clock, 
  Archive, 
  Eye, 
  EyeOff, 
  Loader2, 
  AlertCircle,
  MoreHorizontal,
  Edit,
  Trash2
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { updateOpportunity, OpportunityFormState } from '@/app/actions/opportunities'

type OpportunityStatus = 'active' | 'closed' | 'expired' | 'draft' | 'archived'
type OpportunityVisibility = 'public' | 'confidential' | 'private'

interface OpportunityStatusData {
  id: string
  status: OpportunityStatus
  visibility: OpportunityVisibility
  isConfidential: boolean
  createdBy: string
  title: string
}

interface OpportunityStatusToggleProps {
  opportunity: OpportunityStatusData
  onStatusChangeAction?: (opportunityId: string, newStatus: OpportunityStatus) => void
  onVisibilityChangeAction?: (opportunityId: string, newVisibility: OpportunityVisibility) => void
  onDeleteAction?: (opportunityId: string) => void
  compact?: boolean
  showDropdown?: boolean
  className?: string
}

interface OptimisticStatusUpdate {
  status?: OpportunityStatus
  visibility?: OpportunityVisibility
  isPending?: boolean
  error?: string
}

export default function OpportunityStatusToggle({
  opportunity,
  onStatusChangeAction,
  onVisibilityChangeAction,
  onDeleteAction,
  compact = false,
  showDropdown = true,
  className = ''
}: OpportunityStatusToggleProps) {
  const { t } = useTranslation()
  const { data: session } = useSession()
  const [showDeleteDialog, setShowDeleteDialog] = React.useState(false)

  // Optimistic state for status updates
  const [optimisticUpdate, addOptimisticUpdate] = useOptimistic<
    OptimisticStatusUpdate,
    Partial<OptimisticStatusUpdate>
  >(
    { status: opportunity.status, visibility: opportunity.visibility },
    (current, update) => ({ ...current, ...update, isPending: true })
  )

  // Server action for status updates
  const [updateState, updateAction] = useActionState<OpportunityFormState | null, FormData>(
    updateOpportunity,
    null
  )

  // Check if user can modify this opportunity
  const canModify = React.useMemo(() => {
    if (!session?.user) return false
    
    const isOwner = session.user.id === opportunity.createdBy
    const isAdmin = session.user.role === 'admin'
    const isModerator = session.user.role === 'confidential'
    
    return isOwner || isAdmin || isModerator
  }, [session, opportunity.createdBy])

  // Handle status change with optimistic update
  const handleStatusChange = async (newStatus: OpportunityStatus) => {
    if (!canModify) return

    // Apply optimistic update immediately
    addOptimisticUpdate({ status: newStatus, isPending: true })

    // Create form data for server action
    const formData = new FormData()
    formData.append('opportunityId', opportunity.id)
    formData.append('status', newStatus)
    formData.append('title', opportunity.title)
    formData.append('type', 'offer') // Default, should come from opportunity
    formData.append('category', 'technology') // Default, should come from opportunity
    formData.append('description', 'Status update') // Minimal required field

    // Submit to server
    updateAction(formData)

    // Notify parent component
    if (onStatusChangeAction) {
      onStatusChangeAction(opportunity.id, newStatus)
    }
  }

  // Handle visibility change with optimistic update
  const handleVisibilityChange = async (newVisibility: OpportunityVisibility) => {
    if (!canModify) return

    // Apply optimistic update immediately
    addOptimisticUpdate({ visibility: newVisibility, isPending: true })

    // Create form data for server action
    const formData = new FormData()
    formData.append('opportunityId', opportunity.id)
    formData.append('visibility', newVisibility)
    formData.append('isConfidential', (newVisibility === 'confidential').toString())
    formData.append('title', opportunity.title)
    formData.append('type', 'offer')
    formData.append('category', 'technology')
    formData.append('description', 'Visibility update')

    // Submit to server
    updateAction(formData)

    // Notify parent component
    if (onVisibilityChangeAction) {
      onVisibilityChangeAction(opportunity.id, newVisibility)
    }
  }

  // Handle delete confirmation
  const handleDelete = () => {
    if (onDeleteAction) {
      onDeleteAction(opportunity.id)
    }
    setShowDeleteDialog(false)
  }

  // Get status configuration
  const getStatusConfig = (status: OpportunityStatus) => {
    switch (status) {
      case 'active':
        return {
          label: t('active'),
          icon: CheckCircle2,
          variant: 'default' as const,
          color: 'text-green-600',
          bgColor: 'bg-green-100'
        }
      case 'draft':
        return {
          label: t('draft'),
          icon: Edit,
          variant: 'secondary' as const,
          color: 'text-gray-600',
          bgColor: 'bg-gray-100'
        }
      case 'closed':
        return {
          label: t('closed'),
          icon: Archive,
          variant: 'outline' as const,
          color: 'text-blue-600',
          bgColor: 'bg-blue-100'
        }
      case 'expired':
        return {
          label: t('expired'),
          icon: Clock,
          variant: 'destructive' as const,
          color: 'text-red-600',
          bgColor: 'bg-red-100'
        }
      case 'archived':
        return {
          label: t('archived'),
          icon: Archive,
          variant: 'outline' as const,
          color: 'text-gray-600',
          bgColor: 'bg-gray-100'
        }
      default:
        return {
          label: t('unknown'),
          icon: AlertCircle,
          variant: 'outline' as const,
          color: 'text-gray-600',
          bgColor: 'bg-gray-100'
        }
    }
  }

  // Get visibility configuration
  const getVisibilityConfig = (visibility: OpportunityVisibility) => {
    switch (visibility) {
      case 'public':
        return {
          label: t('public'),
          icon: Eye,
          variant: 'outline' as const,
          color: 'text-green-600'
        }
      case 'confidential':
        return {
          label: t('confidential'),
          icon: EyeOff,
          variant: 'destructive' as const,
          color: 'text-red-600'
        }
      case 'private':
        return {
          label: t('private'),
          icon: EyeOff,
          variant: 'secondary' as const,
          color: 'text-gray-600'
        }
      default:
        return {
          label: t('unknown'),
          icon: AlertCircle,
          variant: 'outline' as const,
          color: 'text-gray-600'
        }
    }
  }

  const currentStatus = optimisticUpdate.status || opportunity.status
  const currentVisibility = optimisticUpdate.visibility || opportunity.visibility
  const statusConfig = getStatusConfig(currentStatus)
  const visibilityConfig = getVisibilityConfig(currentVisibility)
  const StatusIcon = statusConfig.icon
  const VisibilityIcon = visibilityConfig.icon

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* Status Badge */}
      <motion.div
        layout
        className="relative"
      >
        <Badge 
          variant={statusConfig.variant}
          className={`flex items-center gap-1 ${
            optimisticUpdate.isPending ? 'opacity-70' : ''
          } ${compact ? 'text-xs px-2 py-1' : ''}`}
        >
          {optimisticUpdate.isPending ? (
            <Loader2 className={`${compact ? 'h-3 w-3' : 'h-4 w-4'} animate-spin`} />
          ) : (
            <StatusIcon className={`${compact ? 'h-3 w-3' : 'h-4 w-4'}`} />
          )}
          {statusConfig.label}
        </Badge>

        {/* Pending indicator */}
        {optimisticUpdate.isPending && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-1 -right-1 h-2 w-2 bg-primary rounded-full"
          />
        )}
      </motion.div>

      {/* Visibility Badge */}
      {!compact && (
        <Badge 
          variant={visibilityConfig.variant}
          className={`flex items-center gap-1 ${
            optimisticUpdate.isPending ? 'opacity-70' : ''
          }`}
        >
          <VisibilityIcon className="h-3 w-3" />
          {visibilityConfig.label}
        </Badge>
      )}

      {/* Actions Dropdown */}
      {canModify && showDropdown && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="ghost" 
              size={compact ? "sm" : "default"}
              className="h-8 w-8 p-0"
              disabled={optimisticUpdate.isPending}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            {/* Status Changes */}
            <div className="px-2 py-1.5 text-sm font-medium text-muted-foreground">
              {t('changeStatus')}
            </div>
            
            {currentStatus !== 'active' && (
              <DropdownMenuItem onClick={() => handleStatusChange('active')}>
                <CheckCircle2 className="h-4 w-4 mr-2 text-green-600" />
                {t('markAsActive')}
              </DropdownMenuItem>
            )}
            
            {currentStatus !== 'draft' && (
              <DropdownMenuItem onClick={() => handleStatusChange('draft')}>
                <Edit className="h-4 w-4 mr-2 text-gray-600" />
                {t('markAsDraft')}
              </DropdownMenuItem>
            )}
            
            {currentStatus !== 'closed' && (
              <DropdownMenuItem onClick={() => handleStatusChange('closed')}>
                <Archive className="h-4 w-4 mr-2 text-blue-600" />
                {t('markAsClosed')}
              </DropdownMenuItem>
            )}
            
            {currentStatus !== 'archived' && (
              <DropdownMenuItem onClick={() => handleStatusChange('archived')}>
                <Archive className="h-4 w-4 mr-2 text-gray-600" />
                {t('archive')}
              </DropdownMenuItem>
            )}

            <DropdownMenuSeparator />

            {/* Visibility Changes */}
            <div className="px-2 py-1.5 text-sm font-medium text-muted-foreground">
              {t('changeVisibility')}
            </div>
            
            {currentVisibility !== 'public' && (
              <DropdownMenuItem onClick={() => handleVisibilityChange('public')}>
                <Eye className="h-4 w-4 mr-2 text-green-600" />
                {t('makePublic')}
              </DropdownMenuItem>
            )}
            
            {currentVisibility !== 'confidential' && (
              <DropdownMenuItem onClick={() => handleVisibilityChange('confidential')}>
                <EyeOff className="h-4 w-4 mr-2 text-red-600" />
                {t('makeConfidential')}
              </DropdownMenuItem>
            )}
            
            {currentVisibility !== 'private' && (
              <DropdownMenuItem onClick={() => handleVisibilityChange('private')}>
                <EyeOff className="h-4 w-4 mr-2 text-gray-600" />
                {t('makePrivate')}
              </DropdownMenuItem>
            )}

            <DropdownMenuSeparator />

            {/* Delete Action */}
            <DropdownMenuItem 
              onClick={() => setShowDeleteDialog(true)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {t('delete')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {/* Error Display */}
      <AnimatePresence>
        {updateState?.error && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="absolute top-full left-0 mt-2 z-50"
          >
            <Alert variant="destructive" className="w-64">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-sm">
                {updateState.error}
              </AlertDescription>
            </Alert>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deleteOpportunity')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('deleteOpportunityConfirmation', { title: opportunity.title })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// Convenience components for specific use cases
export function OpportunityStatusBadge({ 
  opportunity, 
  onStatusChangeAction 
}: { 
  opportunity: OpportunityStatusData
  onStatusChangeAction?: (opportunityId: string, newStatus: OpportunityStatus) => void 
}) {
  return (
    <OpportunityStatusToggle
      opportunity={opportunity}
      onStatusChangeAction={onStatusChangeAction}
      compact={true}
      showDropdown={false}
    />
  )
}

export function OpportunityQuickActions({ 
  opportunity, 
  onStatusChangeAction,
  onVisibilityChangeAction,
  onDeleteAction 
}: { 
  opportunity: OpportunityStatusData
  onStatusChangeAction?: (opportunityId: string, newStatus: OpportunityStatus) => void
  onVisibilityChangeAction?: (opportunityId: string, newVisibility: OpportunityVisibility) => void
  onDeleteAction?: (opportunityId: string) => void
}) {
  return (
    <OpportunityStatusToggle
      opportunity={opportunity}
      onStatusChangeAction={onStatusChangeAction}
      onVisibilityChangeAction={onVisibilityChangeAction}
      onDeleteAction={onDeleteAction}
      compact={false}
      showDropdown={true}
    />
  )
} 