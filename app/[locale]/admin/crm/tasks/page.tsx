'use client'

import React from 'react'
import { CrmAdminShell } from '@/features/admin/crm/crm-admin-shell'
import { CrmTasksClient } from '@/features/admin/crm/crm-tasks-client'
import { ListTodo } from 'lucide-react'

export default function EmailTasksPage() {
  return (
    <CrmAdminShell pageContext="crm-tasks">
      <div className="min-h-0">
        <div className="mb-4 flex items-center gap-3">
          <ListTodo className="h-7 w-7 text-violet-600" />
          <h1 className="text-2xl font-bold text-foreground">Email Tasks</h1>
        </div>
        <CrmTasksClient />
      </div>
    </CrmAdminShell>
  )
}
