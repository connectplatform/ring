//
// Admin User Manager Component
// This component is used to manage users in the admin panel.
// It displays user statistics, a user filter and table list, and a future analytics dashboard.
// It also allows for updating user roles, verifying users, and deleting users.
//
// TODO: Add i18n locale vars
// TODO: Implement advanced analytics dashboard
// TODO: Implement user export functionality
// TODO: Implement user import functionality
// TODO: Implement user search functionality
// TODO: Implement user filter functionality

'use client';

// Importing necessary hooks and UI components
import React, { useState, useEffect, useTransition, useMemo } from 'react'; // TODO: Use React 19's more advanced hooks for async state if possible.
import { AuthUser } from '@/features/auth/types';
import { UserRolesArray } from '@/features/auth/user-role';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Search, 
  Filter, 
  UserPlus, 
  Edit, 
  Trash2, 
  Shield, 
  Mail, 
  Calendar,
  Users,
  TrendingUp,
  Activity,
  AlertTriangle
} from 'lucide-react';

// Props for the AdminUserManager component
interface AdminUserManagerProps {
  initialUsers: AuthUser[];
  locale: string;
}

// User statistics structure for overview/metrics
interface UserStats {
  totalUsers: number;
  activeUsers: number;
  newUsersThisMonth: number;
  usersByRole: Record<UserRolesArray, number>;
  verifiedUsers: number;
  unverifiedUsers: number;
}

// Main AdminUserManager component
export function AdminUserManager({ initialUsers, locale }: AdminUserManagerProps) {
  // Initializing a React 19 transition for non-blocking UI updates (for search/filter experience)
  const [isPending, startTransition] = useTransition();

  // State hooks for all core manager features
  const [users, setUsers] = useState<AuthUser[]>(initialUsers); // master user list (local to this component; refreshed on mutation)
  const [filteredUsers, setFilteredUsers] = useState<AuthUser[]>(initialUsers); // the current filtered & searched set displayed
  const [searchTerm, setSearchTerm] = useState(''); // search query
  const [roleFilter, setRoleFilter] = useState<UserRolesArray | 'all'>('all'); // filter for role (all/member/etc)
  const [verificationFilter, setVerificationFilter] = useState<'all' | 'verified' | 'unverified'>('all'); // filter for verification state
  const [selectedUser, setSelectedUser] = useState<AuthUser | null>(null); // TODO: Use this for better edit dialogs if needed
  const [isEditing, setIsEditing] = useState(false); // TODO: Apply in future for edit form modals
  const [loading, setLoading] = useState(false); // true while api actions are running
  const [error, setError] = useState<string | null>(null); // last error string for alert message
  const [success, setSuccess] = useState<string | null>(null); // success feedback message

  // Handler for changes to the search field (debounced transition for React19 non-blocking UX)
  const handleSearchChange = (value: string) => {
    startTransition(() => {
      setSearchTerm(value);
    });
  };

  // Handler for changes to role dropdown
  const handleRoleFilterChange = (value: UserRolesArray | 'all') => {
    startTransition(() => {
      setRoleFilter(value);
    });
  };

  // Handler for verification dropdown
  const handleVerificationFilterChange = (value: 'all' | 'verified' | 'unverified') => {
    startTransition(() => {
      setVerificationFilter(value);
    });
  };

  // Calculate statistics for overview panel
  // TODO: Perf: Use useMemo with stable user objects if parent can guarantee referential stability.
  const userStats: UserStats = useMemo(() => {
    const now = new Date();
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    return {
      totalUsers: users.length,
      activeUsers: users.filter(user => {
        // User is active if last login was in the last 30 days
        const lastLogin = new Date(user.lastLogin);
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        return lastLogin > thirtyDaysAgo;
      }).length,
      newUsersThisMonth: users.filter(user => new Date(user.createdAt) > thisMonth).length,
      usersByRole: users.reduce((acc, user) => {
        // Group users into their roles, counting each
        acc[user.role] = (acc[user.role] || 0) + 1;
        return acc;
      }, {} as Record<UserRolesArray, number>),
      verifiedUsers: users.filter(user => user.isVerified).length,
      unverifiedUsers: users.filter(user => !user.isVerified).length
    };
  }, [users]);

  // Runs whenever users/search/filter changes; recalculates which users are displayed
  useEffect(() => {
    let filtered = users;

    // Text search match, insensitive to case, matches against name/email/id
    if (searchTerm) {
      filtered = filtered.filter(user =>
        user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.id.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply role filter
    if (roleFilter !== 'all') {
      filtered = filtered.filter(user => user.role === roleFilter);
    }

    // Apply verification filter
    if (verificationFilter !== 'all') {
      filtered = filtered.filter(user => 
        verificationFilter === 'verified' ? user.isVerified : !user.isVerified
      );
    }

    setFilteredUsers(filtered);
  }, [users, searchTerm, roleFilter, verificationFilter]);

  // Updates a user's role (API+local update)
  const handleUpdateUserRole = async (userId: string, newRole: UserRolesArray) => {
    setLoading(true);
    setError(null);

    try {
      // API call to update user role on backend
      const response = await fetch(`/api/admin/users/${userId}/role`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole })
      });
      if (!response.ok) {
        throw new Error('Failed to update user role');
      }

      // Update users state (local) upon success
      setUsers(prev => prev.map(user => 
        user.id === userId ? { ...user, role: newRole } : user
      ));
      setSuccess('User role updated successfully');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update user role');
    } finally {
      setLoading(false);
    }
  };

  // Handles toggling user's verification state (API+local update)
  const handleToggleUserVerification = async (userId: string, isVerified: boolean) => {
    setLoading(true);
    setError(null);

    try {
      // Prepare verification payloads
      const verifiedAtLocal = new Date().toISOString();
      const verifiedAtLocalDisplay = new Date().toLocaleString(locale);

      // API call: send verification toggle
      const response = await fetch(`/api/admin/users/${userId}/verification`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isVerified,
          verifiedAtLocal,
          verifiedAtLocalDisplay,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update user verification');
      }

      // Update user locally
      setUsers(prev => prev.map(user => 
        user.id === userId ? { ...user, isVerified } : user
      ));
      setSuccess(
        isVerified
          ? 'User verified manually — KYC procedure recorded'
          : 'User verification cleared',
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update user verification');
    } finally {
      setLoading(false);
    }
  };

  // Handles deleting a user (confirm+API+local update)
  const handleDeleteUser = async (userId: string) => {
    // Confirm dialog before delete
    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // API call: delete user
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error('Failed to delete user');
      }

      // Remove user locally
      setUsers(prev => prev.filter(user => user.id !== userId));
      setSuccess('User deleted successfully');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete user');
    } finally {
      setLoading(false);
    }
  };

  // Utility for coloring badges based on user role
  const getRoleBadgeColor = (role: UserRolesArray) => {
    // TODO: If design system exposes color tokens for roles, use those!
    switch (role) {
      case UserRolesArray.admin: return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case UserRolesArray.confidential: return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      case UserRolesArray.member: return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case UserRolesArray.subscriber: return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case UserRolesArray.visitor: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  // Formats any date to locale string for UI
  // TODO: Move to utility lib, memoize for perf if rendering many items
  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // --- RENDER ---
  return (
    <div className="space-y-6">
      {/* Alert section for error or success feedback */}
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

      {/* Tabs for page UI switching */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        {/* Overview Tab - Main statistics */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Tile 1: Total Users */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{userStats.totalUsers}</div>
              </CardContent>
            </Card>
            {/* Tile 2: Active Users */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Users</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{userStats.activeUsers}</div>
                <p className="text-xs text-muted-foreground">Last 30 days</p>
              </CardContent>
            </Card>
            {/* Tile 3: New Users This Month */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">New This Month</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{userStats.newUsersThisMonth}</div>
              </CardContent>
            </Card>
            {/* Tile 4: Verified Users */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Verified Users</CardTitle>
                <Shield className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{userStats.verifiedUsers}</div>
                <p className="text-xs text-muted-foreground">
                  {/* Avoid NaN% if zero users */}
                  {userStats.totalUsers === 0 
                    ? '0% verified'
                    : `${Math.round((userStats.verifiedUsers / userStats.totalUsers) * 100)}% verified`}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Users by Role Distribution Panel */}
          <Card>
            <CardHeader>
              <CardTitle>Users by Role</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {Object.entries(userStats.usersByRole).map(([role, count]) => (
                  <div key={role} className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Badge className={getRoleBadgeColor(role as UserRolesArray)}>
                        {role}
                      </Badge>
                    </div>
                    <span className="font-medium">{count}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Users Tab - user filter and table list */}
        <TabsContent value="users" className="space-y-6">
          {/* Filter bar for search & dropdowns */}
          <Card>
            <CardHeader>
              <CardTitle>User Management</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-4">
                {/* Search input */}
                <div className="flex-1">
                  <Label htmlFor="search">Search Users</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="search"
                      placeholder="Search by name, email, or ID..."
                      value={searchTerm}
                      onChange={(e) => handleSearchChange(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                {/* Role filter dropdown */}
                <div className="w-full sm:w-48">
                  <Label htmlFor="role-filter">Filter by Role</Label>
                  <Select value={roleFilter} onValueChange={(value) => handleRoleFilterChange(value as UserRolesArray | 'all')}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Roles" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Roles</SelectItem>
                      {Object.values(UserRolesArray).map(role => (
                        <SelectItem key={role} value={role}>{role}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {/* Verification status dropdown */}
                <div className="w-full sm:w-48">
                  <Label htmlFor="verification-filter">Filter by Verification</Label>
                  <Select value={verificationFilter} onValueChange={(value) => handleVerificationFilterChange(value as 'all' | 'verified' | 'unverified')}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Users" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Users</SelectItem>
                      <SelectItem value="verified">Verified</SelectItem>
                      <SelectItem value="unverified">Unverified</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Users Table */}
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Last Login</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        {/* Avatar, name, email */}
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                            {user.photoURL ? (
                              <img src={user.photoURL} alt={user.name ?? 'User'} className="w-8 h-8 rounded-full" />
                            ) : (
                              <span className="text-sm font-medium">
                                {((user.name || user.email) || 'U').charAt(0).toUpperCase()}
                              </span>
                            )}
                          </div>
                          <div>
                            <div className="font-medium">{user.name || 'No name'}</div>
                            <div className="text-sm text-muted-foreground">{user.email}</div>
                          </div>
                        </div>
                      </TableCell>
                      {/* Role badge */}
                      <TableCell>
                        <Badge className={getRoleBadgeColor(user.role as UserRolesArray)}>
                          {user.role}
                        </Badge>
                      </TableCell>
                      {/* Verification status */}
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          {user.isVerified ? (
                            <Badge variant="outline" className="text-green-600 border-green-600">
                              <Shield className="w-3 h-3 mr-1" />
                              Verified
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-yellow-600 border-yellow-600">
                              <AlertTriangle className="w-3 h-3 mr-1" />
                              Unverified
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      {/* Created/Last login date */}
                      <TableCell>{formatDate(user.createdAt)}</TableCell>
                      <TableCell>{formatDate(user.lastLogin)}</TableCell>
                      {/* Actions: role select, verify toggle, delete */}
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          {/* Role dropdown */}
                          <Select
                            value={user.role}
                            onValueChange={(newRole) => handleUpdateUserRole(user.id, newRole as UserRolesArray)}
                            disabled={loading}
                          >
                            <SelectTrigger className="w-32">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.values(UserRolesArray).map((role: UserRolesArray) => (
                                <SelectItem key={role} value={role.toString()}>{role}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {/* Verification toggle button */}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleToggleUserVerification(user.id, !user.isVerified)}
                            disabled={loading}
                          >
                            {user.isVerified ? 'Unverify' : 'Verify'}
                          </Button>
                          {/* Delete user button */}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteUser(user.id)}
                            disabled={loading}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Analytics Tab - Future analytics dashboard */}
        <TabsContent value="analytics" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>User Analytics</CardTitle>
            </CardHeader>
            <CardContent>
              {/* MOCK CODE, TODO: Implement advanced analytics dashboard
                  1. Integrate chart components when backend exposes analytics endpoints.
                  2. Render statistics for trends, growth, churn, etc.
                  3. Let admin filter timeframes and cohorts
                  4. Provide export functionality for tabular/graph data
              */}
              <div className="text-center py-8 text-muted-foreground">
                <TrendingUp className="w-12 h-12 mx-auto mb-4" />
                <p>Advanced analytics coming soon...</p>
                <p className="text-sm">Charts and detailed metrics will be available here.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}