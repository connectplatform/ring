'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Mail } from 'lucide-react';

export default function EmailThreadDetailPage() {
  const params = useParams<{ id: string; locale: string }>();
  const threadId = decodeURIComponent(params.id);
  const [data, setData] = useState<{
    thread: Record<string, unknown>
    messages: Record<string, unknown>[]
    drafts: Record<string, unknown>[]
    tasks: Record<string, unknown>[]
  } | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/email/threads/${encodeURIComponent(threadId)}`, {
      cache: 'no-store',
    });
    if (!res.ok) return;
    setData(await res.json());
  }, [threadId]);

  useEffect(() => {
    load();
  }, [load]);

  if (!data) {
    return <div className="p-6 text-gray-500">Loading thread…</div>;
  }

  const thread = data.thread;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-4xl mx-auto">
        <Link
          href={`/${params.locale}/admin/email-inbox`}
          className="inline-flex items-center gap-2 text-sm text-blue-600 mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to inbox
        </Link>
        <div className="flex items-center gap-3 mb-4">
          <Mail className="h-7 w-7 text-blue-600" />
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              {String(thread.subject ?? 'Thread')}
            </h1>
            <p className="text-sm text-gray-500">
              {String(thread.fromEmail)} · {String(thread.status)} · {String(thread.priority)}
            </p>
          </div>
        </div>

        <section className="mb-6">
          <h2 className="font-semibold mb-2 text-gray-900 dark:text-white">Messages</h2>
          <div className="space-y-3">
            {data.messages.map((m) => (
              <div
                key={String(m.id)}
                className="bg-white dark:bg-gray-800 border rounded-lg p-4 text-sm"
              >
                <div className="text-gray-500 mb-2">
                  {m.isInbound ? 'Inbound' : 'Outbound'} · {String(m.date ?? '')}
                </div>
                <pre className="whitespace-pre-wrap text-gray-800 dark:text-gray-200">
                  {String(m.bodyTextClean ?? m.bodyText ?? '')}
                </pre>
              </div>
            ))}
          </div>
        </section>

        {data.drafts.length > 0 && (
          <section className="mb-6">
            <h2 className="font-semibold mb-2">Drafts ({data.drafts.length})</h2>
            <p className="text-sm text-gray-500">Review in Email Drafts admin.</p>
          </section>
        )}

        {data.tasks.length > 0 && (
          <section>
            <h2 className="font-semibold mb-2">Tasks ({data.tasks.length})</h2>
            <ul className="text-sm space-y-1">
              {data.tasks.map((t) => (
                <li key={String(t.id)}>{String(t.title)} — {String(t.status)}</li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
