/** Simple Cyrillic → Latin translit for blog/site-wide slugs */
const MAP: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'h', ґ: 'g', д: 'd', е: 'e', є: 'ye', ж: 'zh', з: 'z',
  и: 'y', і: 'i', ї: 'yi', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p',
  р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh',
  щ: 'shch', ь: '', ы: 'y', ъ: '', э: 'e', ю: 'yu', я: 'ya',
  ' ': '-', _: '-',
}

export function translitSlug(input: string, maxLen = 80): string {
  const lower = input.toLowerCase().trim()
  let out = ''
  for (const ch of lower) {
    if (/[a-z0-9]/.test(ch)) out += ch
    else if (MAP[ch] !== undefined) out += MAP[ch]
    else if (MAP[ch.normalize('NFD').replace(/\p{M}/gu, '')] !== undefined) {
      out += MAP[ch]
    }
  }
  out = out.replace(/-+/g, '-').replace(/^-|-$/g, '')
  if (!out) out = 'post'
  return out.slice(0, maxLen)
}
