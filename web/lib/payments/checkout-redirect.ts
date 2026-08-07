/**
 * Unbranded browser checkout handoff.
 * Consumes PaymentConductor `CheckoutRedirect` only — no PSP imports.
 */
import type { CheckoutRedirect } from '@/lib/payments/conductor/types'

function appendFormFields(
  form: HTMLFormElement,
  fields: Record<string, string | string[]>,
): void {
  for (const [name, value] of Object.entries(fields)) {
    const values = Array.isArray(value) ? value : [value]
    for (const v of values) {
      const input = document.createElement('input')
      input.type = 'hidden'
      input.name = name
      input.value = String(v)
      form.appendChild(input)
    }
  }
}

function submitFormPost(url: string, fields: Record<string, string | string[]>): void {
  if (typeof document === 'undefined') return
  const form = document.createElement('form')
  form.method = 'POST'
  form.action = url.split('?')[0] || url
  form.acceptCharset = 'utf-8'
  form.style.display = 'none'
  appendFormFields(form, fields)
  document.body.appendChild(form)
  form.submit()
}

/** Follow conductor-owned redirect DTO. */
export function followCheckoutRedirect(redirect: CheckoutRedirect): void {
  if (redirect.mode === 'form_post') {
    if (!redirect.fields || Object.keys(redirect.fields).length === 0) {
      console.error('checkout-redirect: form_post missing fields')
      return
    }
    submitFormPost(redirect.url, redirect.fields)
    return
  }
  window.location.href = redirect.url
}

/**
 * Accept either conductor `redirect` or legacy paymentUrl/paymentFields payloads
 * (transitional API/action responses). Prefer `redirect` when present.
 */
export function followCheckoutResult(result: {
  redirect?: CheckoutRedirect
  paymentUrl?: string
  paymentFields?: Record<string, string | string[]>
}): void {
  if (result.redirect?.url) {
    followCheckoutRedirect(result.redirect)
    return
  }
  if (result.paymentFields && Object.keys(result.paymentFields).length > 0 && result.paymentUrl) {
    followCheckoutRedirect({
      mode: 'form_post',
      url: result.paymentUrl,
      fields: result.paymentFields,
    })
    return
  }
  if (result.paymentUrl) {
    followCheckoutRedirect({ mode: 'navigate', url: result.paymentUrl })
  }
}
