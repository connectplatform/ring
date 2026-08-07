export const PRODUCT_AGENT_CHAT_OPEN_PARAM = 'agentChat'

export function isProductAgentChatOpenParam(value: string | null | undefined): boolean {
  return value === '1' || value === 'open'
}

export function withProductAgentChatOpen(pathname: string, currentSearch = ''): string {
  const params = new URLSearchParams(currentSearch.startsWith('?') ? currentSearch.slice(1) : currentSearch)
  params.set(PRODUCT_AGENT_CHAT_OPEN_PARAM, '1')
  const qs = params.toString()
  return qs ? `${pathname}?${qs}` : `${pathname}?${PRODUCT_AGENT_CHAT_OPEN_PARAM}=1`
}
