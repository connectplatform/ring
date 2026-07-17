'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { CrmAdminShell } from '@/features/admin/crm/crm-admin-shell';
import { CheckCircle, Clock, ListTodo } from 'lucide-react';

// Represents an individual email task and its relevant details.
interface EmailTask {
  id: string;         // Task unique identifier
  threadId: string;   // Related email thread ID
  title: string;      // Task short title or description
  status: string;     // Task status ("completed", "pending", etc.)
  priority: string;   // Priority label ("high", "low", etc.)
  taskType: string;   // Category or type of task
  dueDate: string | null; // Nullable ISO date string for due date
}

export default function EmailTasksPage() {
  // State to hold fetched email tasks
  const [tasks, setTasks] = useState<EmailTask[]>([]);

  // Loads tasks from server and updates state
  const load = useCallback(async () => {
    // Fetch tasks endpoint; disables cache to always get fresh data
    const res = await fetch('/api/admin/email/tasks', { cache: 'no-store' });
    if (!res.ok) return; // If request fails, abort further actions
    const json = await res.json();
    // Defensive parsing & transformation of tasks from the response
    setTasks(
      (json.tasks ?? []).map((t: Record<string, unknown>) => ({
        id: String(t.id),
        threadId: String(t.threadId),
        title: String(t.title),
        status: String(t.status),
        priority: String(t.priority),
        taskType: String(t.taskType),
        dueDate: t.dueDate ? String(t.dueDate) : null,
      }))
    );
  }, []);
  // TODO: In React 19/Next 16, consider using React's `use` or server actions for data fetching to better align with modern conventions and reduce state management boilerplate.

  // Load tasks after first render, and whenever the `load` function is changed (should be stable due to useCallback)
  useEffect(() => {
    load();
  }, [load]);
  // TODO: React 19's useEffectEvent could be explored here for better effect scope if available.

  // Marks a task as completed by POSTing to server, then reloads tasks
  const complete = async (id: string) => {
    await fetch(`/api/admin/email/tasks/${id}/complete`, { method: 'POST' });
    await load(); // Refresh task list after completion
  };
  // TODO: Consider optimistic UI updates by updating state immediately, then reconciling with server result after request.

  return (
    <CrmAdminShell pageContext="crm-tasks">
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header and page title */}
        <div className="flex items-center gap-3 mb-6">
          <ListTodo className="h-8 w-8 text-violet-600" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Email Tasks</h1>
        </div>
        {/* Task list area */}
        <div className="space-y-3">
          {/* Show a message if there are no tasks, otherwise render each task */}
          {tasks.length === 0 ? (
            <p className="text-gray-500">No tasks yet.</p>
          ) : (
            tasks.map((task) => (
              <div
                key={task.id}
                className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 flex justify-between items-center"
              >
                {/* Task title and details */}
                <div>
                  <div className="font-medium text-gray-900 dark:text-white">{task.title}</div>
                  <div className="text-sm text-gray-500 flex gap-3 mt-1">
                    <span>{task.status}</span>
                    <span>{task.priority}</span>
                    <span>{task.taskType}</span>
                    {task.dueDate && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {/* Formats date for local presentation */}
                        {new Date(task.dueDate).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
                {/* Only show Complete button for incomplete tasks */}
                {task.status !== 'completed' && (
                  <button
                    onClick={() => complete(task.id)}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg"
                  >
                    <CheckCircle className="h-4 w-4" />
                    Complete
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
    </CrmAdminShell>
  );
}
