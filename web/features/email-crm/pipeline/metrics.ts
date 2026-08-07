/**
 * Email CRM Prometheus metrics (in-process).
 * Scraped by Grafana/Prometheus via GET /api/metrics
 */

type CounterMap = Map<string, number>

const counters: CounterMap = new Map()

function inc(name: string, by = 1): void {
  counters.set(name, (counters.get(name) || 0) + by)
}

function setGauge(name: string, value: number): void {
  counters.set(name, value)
}

export const emailCrmMetrics = {
  unseenBacklog(total: number): void {
    setGauge('email_crm_unseen_backlog', total)
  },
  batchTruncated(total: number, fetching: number): void {
    if (total > fetching) inc('email_crm_batch_truncated_total')
  },
  markSeenFailed(): void {
    inc('email_crm_mark_seen_failures_total')
  },
  sanitizerRiskSpike(riskScore: number): void {
    if (riskScore >= 0.75) inc('email_crm_sanitizer_risk_spikes_total')
  },
  willRetry(): void {
    inc('email_crm_will_retry_total')
  },
  quarantined(): void {
    inc('email_crm_quarantined_total')
  },
  prePersistFailure(): void {
    inc('email_crm_pre_persist_failures_total')
  },
  processed(): void {
    inc('email_crm_processed_total')
  },
  /** Prometheus text exposition */
  render(): string {
    const lines: string[] = [
      '# HELP email_crm_unseen_backlog IMAP UNSEEN count at last poll',
      '# TYPE email_crm_unseen_backlog gauge',
      `email_crm_unseen_backlog ${counters.get('email_crm_unseen_backlog') || 0}`,
      '# HELP email_crm_batch_truncated_total Times UNSEEN > batchSize',
      '# TYPE email_crm_batch_truncated_total counter',
      `email_crm_batch_truncated_total ${counters.get('email_crm_batch_truncated_total') || 0}`,
      '# HELP email_crm_mark_seen_failures_total markAsSeen errors',
      '# TYPE email_crm_mark_seen_failures_total counter',
      `email_crm_mark_seen_failures_total ${counters.get('email_crm_mark_seen_failures_total') || 0}`,
      '# HELP email_crm_sanitizer_risk_spikes_total inbound riskScore >= 0.75',
      '# TYPE email_crm_sanitizer_risk_spikes_total counter',
      `email_crm_sanitizer_risk_spikes_total ${counters.get('email_crm_sanitizer_risk_spikes_total') || 0}`,
      '# HELP email_crm_will_retry_total Pre-persist failures left UNSEEN',
      '# TYPE email_crm_will_retry_total counter',
      `email_crm_will_retry_total ${counters.get('email_crm_will_retry_total') || 0}`,
      '# HELP email_crm_quarantined_total Moved to CRM.Quarantine after N pre-persist fails',
      '# TYPE email_crm_quarantined_total counter',
      `email_crm_quarantined_total ${counters.get('email_crm_quarantined_total') || 0}`,
      '# HELP email_crm_pre_persist_failures_total Pre-persist processing failures',
      '# TYPE email_crm_pre_persist_failures_total counter',
      `email_crm_pre_persist_failures_total ${counters.get('email_crm_pre_persist_failures_total') || 0}`,
      '# HELP email_crm_processed_total Successfully processed emails',
      '# TYPE email_crm_processed_total counter',
      `email_crm_processed_total ${counters.get('email_crm_processed_total') || 0}`,
      '',
    ]
    return lines.join('\n')
  },
}
