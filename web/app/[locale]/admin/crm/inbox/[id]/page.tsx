'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Mail } from 'lucide-react';
import { CrmAdminShell } from '@/features/admin/crm/crm-admin-shell';
import { ROUTES } from '@/constants/routes';
import type { Locale } from '@/i18n/shared';

export default function EmailThreadDetailPage() {
  const params = useParams<{ id: string; locale: string }>();
  const threadId = decodeURIComponent(params.id);
  const locale = (params.locale as Locale) || 'en';
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
    return (
      <CrmAdminShell pageContext="crm-inbox">
        <div className="p-6 text-gray-500">Loading thread…</div>
      </CrmAdminShell>
    );
  }

  const thread = data.thread;

  return (
    <CrmAdminShell pageContext="crm-inbox">
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-4xl mx-auto">
        <Link
          href={ROUTES.ADMIN_CRM_INBOX(locale)}
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
              {thread.routeFlag ? ` · ${String(thread.routeFlag)}` : ''}
            </p>
          </div>
        </div>

        <UnsubscribePane
          threadId={threadId}
          unsubscribeUrl={typeof thread.unsubscribeUrl === 'string' ? thread.unsubscribeUrl : null}
          oneClickEligible={thread.unsubscribeOneClickEligible === true}
          last={
            thread.lastUnsubscribeRequest && typeof thread.lastUnsubscribeRequest === 'object'
              ? (thread.lastUnsubscribeRequest as {
                  at?: string
                  by?: string
                  url?: string
                  method?: string
                  status?: string
                  httpStatus?: number | null
                  error?: string | null
                })
              : null
          }
          onLogged={load}
        />

        <OsintDossierPane dossier={thread.osintDossier} routeFlag={thread.routeFlag} />

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
    </CrmAdminShell>
  );
}

function UnsubscribePane({
  threadId,
  unsubscribeUrl,
  oneClickEligible,
  last,
  onLogged,
}: {
  threadId: string
  unsubscribeUrl: string | null
  oneClickEligible: boolean
  last: {
    at?: string
    by?: string
    url?: string
    method?: string
    status?: string
    httpStatus?: number | null
    error?: string | null
  } | null
  onLogged: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [logError, setLogError] = useState<string | null>(null)
  if (!unsubscribeUrl) return null

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(unsubscribeUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* ignore */
    }
  }

  const logRequest = async () => {
    setBusy(true)
    setLogError(null)
    try {
      const res = await fetch(`/api/admin/email/threads/${encodeURIComponent(threadId)}/unsubscribe-log`, {
        method: 'POST',
      })
      if (!res.ok) {
        const json = await res.json().catch(() => null)
        throw new Error(
          (json && typeof json.error === 'string' && json.error) || `Log failed (${res.status})`
        )
      }
      onLogged()
    } catch (err) {
      setLogError(err instanceof Error ? err.message : 'Log failed')
    } finally {
      setBusy(false)
    }
  }

  const oneClickPost = async () => {
    setBusy(true)
    setLogError(null)
    try {
      const res = await fetch(
        `/api/admin/email/threads/${encodeURIComponent(threadId)}/unsubscribe-one-click`,
        { method: 'POST' }
      )
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error(
          (json && typeof json.error === 'string' && json.error) || `One-click POST failed (${res.status})`
        )
      }
      onLogged()
    } catch (err) {
      setLogError(err instanceof Error ? err.message : 'One-click POST failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/40">
      <h2 className="mb-2 font-semibold text-gray-900 dark:text-white">
        {oneClickEligible ? 'Unsubscribe (RFC 8058 one-click eligible)' : 'Unsubscribe (copy-only)'}
      </h2>
      <p className="mb-2 break-all text-sm text-gray-700 dark:text-gray-300">{unsubscribeUrl}</p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void copy()}
          className="rounded-lg bg-white px-3 py-1.5 text-sm border dark:bg-gray-800"
        >
          {copied ? 'Copied' : 'Copy URL'}
        </button>
        {oneClickEligible && (
          <button
            type="button"
            onClick={() => void oneClickPost()}
            disabled={busy}
            className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm text-white disabled:opacity-50"
          >
            One-click POST
          </button>
        )}
        <button
          type="button"
          onClick={() => void logRequest()}
          disabled={busy}
          className="rounded-lg bg-amber-600 px-3 py-1.5 text-sm text-white disabled:opacity-50"
        >
          Log request
        </button>
      </div>
      {last?.at && (
        <p className="mt-2 text-xs text-gray-500">
          Last request: {last.at}
          {last.by ? ` · ${last.by}` : ''}
          {last.method ? ` · ${last.method}` : ''}
          {last.status ? ` · ${last.status}` : ''}
          {typeof last.httpStatus === 'number' ? ` · HTTP ${last.httpStatus}` : ''}
        </p>
      )}
      {last?.error && <p className="mt-1 text-xs text-red-600">{last.error}</p>}
      {logError && <p className="mt-2 text-xs text-red-600">{logError}</p>}
    </section>
  )
}

function OsintDossierPane({
  dossier,
  routeFlag,
}: {
  dossier: unknown
  routeFlag: unknown
}) {
  const record =
    dossier && typeof dossier === 'object'
      ? (dossier as {
          enrichedAt?: string
          fromEmail?: string
          fromDomain?: string
          headerHosts?: string[]
          dns?: { mx?: string[]; spf?: string | null; dmarc?: string | null }
          error?: string
        })
      : null
  if (!record && routeFlag !== 'spam_osint_queue') return null

  return (
    <section className="mb-6 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-gray-800">
      <h2 className="mb-2 font-semibold text-gray-900 dark:text-white">OSINT dossier</h2>
      {!record ? (
        <p className="text-sm text-gray-500">Queued for the next email-crm-osint run.</p>
      ) : (
        <dl className="grid gap-2 text-sm text-gray-700 dark:text-gray-300">
          <div>
            <dt className="text-xs uppercase text-gray-500">Domain</dt>
            <dd>{record.fromDomain || '—'}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-gray-500">From</dt>
            <dd>{record.fromEmail || '—'}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-gray-500">MX</dt>
            <dd>{record.dns?.mx?.length ? record.dns.mx.join(', ') : 'absent'}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-gray-500">SPF</dt>
            <dd>{record.dns?.spf ? 'present' : 'absent'}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-gray-500">DMARC</dt>
            <dd>{record.dns?.dmarc ? 'present' : 'absent'}</dd>
          </div>
          {record.headerHosts && record.headerHosts.length > 0 && (
            <div>
              <dt className="text-xs uppercase text-gray-500">Header hosts</dt>
              <dd>{record.headerHosts.join(', ')}</dd>
            </div>
          )}
          {record.enrichedAt && (
            <div>
              <dt className="text-xs uppercase text-gray-500">Enriched</dt>
              <dd>{record.enrichedAt}</dd>
            </div>
          )}
          {record.error && <p className="text-xs text-red-600">{record.error}</p>}
        </dl>
      )}
    </section>
  )
}
