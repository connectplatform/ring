/** Chromium install prompt captured before React hydrates. */

export const INSTALL_PROMPT_EVENT = 'ring:beforeinstallprompt'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

declare global {
  interface Window {
    __ringInstallPrompt?: BeforeInstallPromptEvent | null
  }
}

export function readInstallPrompt(): BeforeInstallPromptEvent | null {
  if (typeof window === 'undefined') return null
  return window.__ringInstallPrompt ?? null
}

export function storeInstallPrompt(event: BeforeInstallPromptEvent): void {
  window.__ringInstallPrompt = event
  window.dispatchEvent(new Event(INSTALL_PROMPT_EVENT))
}

export const INSTALL_PROMPT_BOOT_SCRIPT = `(function(){if(window.__ringInstallPromptBoot)return;window.__ringInstallPromptBoot=1;window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();window.__ringInstallPrompt=e;window.dispatchEvent(new Event('${INSTALL_PROMPT_EVENT}'));});})();`
