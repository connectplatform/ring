'use client'

import React, { useState, useEffect, useTransition } from 'react'
import { AuthUser } from '@/features/auth/types'
import { UserRolesArray } from '@/features/auth/user-role'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Search, Trash2, Shield, AlertTriangle, Eye } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { AdminUserDetailSheet } from '@/features/auth/components/admin-user-detail-sheet'
import { davinciPanelSurface } from '@/lib/ui/davinci'
import { cn } from '@/lib/utils'

interface AdminUserManagerProps {
  initialUsers: AuthUser[]
  locale: string
  /** @deprecated Tabs moved to dashboard action buttons; always table. */
  mode?: 'table'
}

export function AdminUserManager({ initialUsers, locale }: AdminUserManagerProps) {
  const t = useTranslations('modules.admin')
  const [isPending, startTransition] = useTransition()
  const [users, setUsers] = useState<AuthUser[]>(initialUsers)
  const [filteredUsers, setFilteredUsers] = useState<AuthUser[]>(initialUsers)
  const [searchTerm, setSearchTerm] = useState('')
  const [roleFilter, setRoleFilter] = useState<UserRolesArray | 'all'>('all')
  const [verificationFilter, setVerificationFilter] = useState<'all' | 'verified' | 'unverified'>('all')
  const [selectedUser, setSelectedUser] = useState<AuthUser | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    setUsers(initialUsers)
  }, [initialUsers])

  const handleSearchChange = (value: string) => {
    startTransition(() => setSearchTerm(value))
  }

  useEffect(() => {
    let filtered = users
    if (searchTerm) {
      const q = searchTerm.toLowerCase()
      filtered = filtered.filter(
        (user) =>
          user.name?.toLowerCase().includes(q) ||
          user.email.toLowerCase().includes(q) ||
          user.id.toLowerCase().includes(q),
      )
    }
    if (roleFilter !== 'all') {
      filtered = filtered.filter((user) => user.role === roleFilter)
    }
    if (verificationFilter !== 'all') {
      filtered = filtered.filter((user) =>
        verificationFilter === 'verified' ? user.isVerified : !user.isVerified,
      )
    }
    setFilteredUsers(filtered)
  }, [users, searchTerm, roleFilter, verificationFilter])

  const handleUpdateUserRole = async (userId: string, newRole: UserRolesArray) => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/admin/users/${userId}/role`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      })
      if (!response.ok) throw new Error(t('usersActionRoleFailed'))
      setUsers((prev) => prev.map((user) => (user.id === userId ? { ...user, role: newRole } : user)))
      setSuccess(t('usersActionRoleSuccess'))
    } catch (err) {
      setError(err instanceof Error ? err.message : t('usersActionRoleFailed'))
    } finally {
      setLoading(false)
    }
  }

  const handleToggleUserVerification = async (userId: string, isVerified: boolean) => {
    setLoading(true)
    setError(null)
    try {
      const verifiedAtLocal = new Date().toISOString()
      const verifiedAtLocalDisplay = new Date().toLocaleString(locale)
      const response = await fetch(`/api/admin/users/${userId}/verification`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isVerified, verifiedAtLocal, verifiedAtLocalDisplay }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || t('usersActionVerifyFailed'))
      setUsers((prev) =>
        prev.map((user) => (user.id === userId ? { ...user, isVerified } : user)),
      )
      setSuccess(isVerified ? t('usersActionVerifySuccess') : t('usersActionUnverifySuccess'))
    } catch (err) {
      setError(err instanceof Error ? err.message : t('usersActionVerifyFailed'))
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteUser = async (userId: string) => {
    if (!confirm(t('usersActionDeleteConfirm'))) return
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/admin/users/${userId}`, { method: 'DELETE' })
      if (!response.ok) throw new Error(t('usersActionDeleteFailed'))
      setUsers((prev) => prev.filter((user) => user.id !== userId))
      setSuccess(t('usersActionDeleteSuccess'))
    } catch (err) {
      setError(err instanceof Error ? err.message : t('usersActionDeleteFailed'))
    } finally {
      setLoading(false)
    }
  }

  const getRoleBadgeColor = (role: UserRolesArray) => {
    switch (role) {
      case UserRolesArray.admin:
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
      case UserRolesArray.confidential:
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
      case UserRolesArray.member:
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
      case UserRolesArray.subscriber:
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
      case UserRolesArray.visitor:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
    }
  }

  const formatDate = (date: Date | string) =>
    new Date(date).toLocaleDateString(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })

  const busy = loading || isPending

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {success && (
        <Alert>
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      <Card className={cn(davinciPanelSurface, 'border-0 shadow-none')}>
        <CardHeader>
          <CardTitle>{t('userManagement')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="flex-1">
              <Label htmlFor="search">{t('usersSearchLabel')}</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder={t('usersSearchPlaceholder')}
                  value={searchTerm}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="w-full sm:w-48">
              <Label htmlFor="role-filter">{t('usersFilterRole')}</Label>
              <Select
                value={roleFilter}
                onValueChange={(value) =>
                  startTransition(() => setRoleFilter(value as UserRolesArray | 'all'))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('usersFilterAllRoles')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('usersFilterAllRoles')}</SelectItem>
                  {Object.values(UserRolesArray).map((role) => (
                    <SelectItem key={role} value={role}>
                      {role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-full sm:w-48">
              <Label htmlFor="verification-filter">{t('usersFilterVerification')}</Label>
              <Select
                value={verificationFilter}
                onValueChange={(value) =>
                  startTransition(() =>
                    setVerificationFilter(value as 'all' | 'verified' | 'unverified'),
                  )
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('usersFilterAllUsers')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('usersFilterAllUsers')}</SelectItem>
                  <SelectItem value="verified">{t('usersFilterVerified')}</SelectItem>
                  <SelectItem value="unverified">{t('usersFilterUnverified')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className={cn(davinciPanelSurface, 'border-0 shadow-none')}>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('usersColUser')}</TableHead>
                <TableHead>{t('usersColRole')}</TableHead>
                <TableHead>{t('usersColStatus')}</TableHead>
                <TableHead>{t('usersColCreated')}</TableHead>
                <TableHead>{t('usersColLastLogin')}</TableHead>
                <TableHead>{t('usersColActions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="flex items-center space-x-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                        {user.avatarThumb || user.photoURL ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={user.avatarThumb || user.photoURL}
                            alt={user.name ?? 'User'}
                            className="h-8 w-8 rounded-full"
                          />
                        ) : (
                          <span className="text-sm font-medium">
                            {(user.name || user.email || 'U').charAt(0).toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div>
                        <div className="font-medium">{user.name || t('usersNoName')}</div>
                        <div className="text-sm text-muted-foreground">{user.email}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={getRoleBadgeColor(user.role as UserRolesArray)}>
                      {user.role}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {user.isVerified ? (
                      <Badge variant="outline" className="border-green-600 text-green-600">
                        <Shield className="mr-1 h-3 w-3" />
                        {t('usersFilterVerified')}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="border-yellow-600 text-yellow-600">
                        <AlertTriangle className="mr-1 h-3 w-3" />
                        {t('usersFilterUnverified')}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>{formatDate(user.createdAt)}</TableCell>
                  <TableCell>{formatDate(user.lastLogin)}</TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedUser(user)
                          setDetailOpen(true)
                        }}
                        title={t('usersViewPayments')}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Select
                        value={user.role}
                        onValueChange={(newRole) =>
                          handleUpdateUserRole(user.id, newRole as UserRolesArray)
                        }
                        disabled={busy}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.values(UserRolesArray).map((role) => (
                            <SelectItem key={role} value={role.toString()}>
                              {role}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleToggleUserVerification(user.id, !user.isVerified)}
                        disabled={busy}
                      >
                        {user.isVerified ? t('usersActionUnverify') : t('usersActionVerify')}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteUser(user.id)}
                        disabled={busy}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AdminUserDetailSheet
        user={selectedUser}
        open={detailOpen}
        onOpenChange={(open) => {
          setDetailOpen(open)
          if (!open) setSelectedUser(null)
        }}
      />
    </div>
  )
}
