'use client'

import React, { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import type { Locale } from '@/i18n/shared'
import { useSession } from 'next-auth/react'
import { ROUTES } from '@/constants/routes'
import Link from 'next/link'
import { Building2, Plus, Search, User } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface EntitiesPageWrapperProps {
  children: React.ReactNode
  locale: string
}

export default function EntitiesPageWrapper({ children, locale }: EntitiesPageWrapperProps) {
  const { data: session } = useSession()
  const t = useTranslations('modules.entities')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return <div className="min-h-[40vh]">{children}</div>
  }

  const loc = locale as Locale

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      <aside className="hidden lg:block w-64 shrink-0 space-y-4">
        {session?.user && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                {t('title', { defaultValue: 'Entities' })}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button asChild variant="ghost" className="w-full justify-start" size="sm">
                <Link href={ROUTES.ENTITIES(loc)}>
                  <Search className="h-4 w-4 mr-2" />
                  {t('viewAll', { defaultValue: 'View All' })}
                </Link>
              </Button>
              <Button asChild variant="ghost" className="w-full justify-start" size="sm">
                <Link href={ROUTES.MY_ENTITIES(loc)}>
                  <User className="h-4 w-4 mr-2" />
                  {t('myEntities')}
                </Link>
              </Button>
              <Button asChild variant="outline" className="w-full justify-start" size="sm">
                <Link href={ROUTES.ADD_ENTITY(loc)}>
                  <Plus className="h-4 w-4 mr-2" />
                  {t('addMyEntity')}
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </aside>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  )
}
