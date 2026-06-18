'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle, Clock, ListTodo } from 'lucide-react';

interface EmailTask {
  id: string;
  threadId: string;
  title: string;
  status: string;
  priority: string;
  taskType: string;
  dueDate: string | null;
}

export default function EmailTasksPage() {
  const [tasks, setTasks] = useState<EmailTask[]>([]);

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/email/tasks', { cache: 'no-store' });
    if (!res.ok) return;
    const json = await res.json();
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

  useEffect(() => {
    load();
  }, [load]);

  const complete = async (id: string) => {
    await fetch(`/api/admin/email/tasks/${id}/complete`, { method: 'POST' });
    await load();
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <ListTodo className="h-8 w-8 text-violet-600" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Email Tasks</h1>
        </div>
        <div className="space-y-3">
          {tasks.length === 0 ? (
            <p className="text-gray-500">No tasks yet.</p>
          ) : (
            tasks.map((task) => (
              <div
                key={task.id}
                className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 flex justify-between items-center"
              >
                <div>
                  <div className="font-medium text-gray-900 dark:text-white">{task.title}</div>
                  <div className="text-sm text-gray-500 flex gap-3 mt-1">
                    <span>{task.status}</span>
                    <span>{task.priority}</span>
                    <span>{task.taskType}</span>
                    {task.dueDate && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(task.dueDate).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
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
  );
}
