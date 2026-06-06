import { NextRequest, NextResponse, connection} from 'next/server'
import fs from 'fs'
import path from 'path'
import { auth } from '@/auth'
import { UserRole } from '@/features/auth/user-role'

export async function POST(request: NextRequest) {
  await connection() // Next.js 16: opt out of prerendering

  const session = await auth()
  if (!session?.user || session.user.role !== UserRole.SUPERADMIN) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const formData = await request.formData()
  const primary = String(formData.get('colorPrimary') || '#3b82f6')
  const background = String(formData.get('colorBackground') || '#0b0f1a')
  const foreground = String(formData.get('colorForeground') || '#e5e7eb')
  const accent = String(formData.get('colorAccent') || '#22c55e')
  const defaultTheme = String(formData.get('defaultTheme') || 'system') as 'light' | 'dark' | 'system'

  const base = process.cwd()
  const localPath = path.join(base, 'whitelabel', 'instance.config.json')
  const defaultPath = path.join(base, 'whitelabel', 'examples', 'default.json')
  const p = fs.existsSync(localPath) ? localPath : defaultPath
  const cfg = JSON.parse(fs.readFileSync(p, 'utf-8'))
  cfg.brand = cfg.brand || {}
  cfg.brand.colors = { primary, background, foreground, accent }
  cfg.theme = { default: defaultTheme }

  // Write to instance.config.json in whitelabel folder, creating it if needed
  const outDir = path.join(base, 'whitelabel')
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })
  fs.writeFileSync(path.join(outDir, 'instance.config.json'), JSON.stringify(cfg, null, 2))

  return NextResponse.redirect(new URL('/en/admin/settings', request.url))
}



