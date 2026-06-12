export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs' && process.env.EMAIL_PROCESSOR_AUTOSTART === 'true') {
    const { getEmailProcessor } = await import('@/services/email/email-processor');
    getEmailProcessor()
      .start()
      .catch((err) => console.error('[instrumentation] EmailProcessor start failed', err));
  }
}
