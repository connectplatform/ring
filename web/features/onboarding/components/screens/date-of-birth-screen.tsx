'use client'

/**
 * "Enter your date of birth" onboarding screen — dedicated to the birth-date
 * profile subset. Three iOS-style roller columns (day / month / year) with
 * locale-aware month names; saves `users.birthDate` as `YYYY-MM-DD`.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Loader2 } from 'lucide-react'
import { RollerPicker } from '@/components/ui/roller-picker'
import { Button } from '@/components/ui/button'
import { saveOnboardingSegment } from '../../actions'
import { toIsoBirthDate } from '../../types'

const MIN_YEAR_OFFSET = 120

function buildYearList(): { values: number[]; defaultIndex: number } {
  const nowYear = new Date().getFullYear()
  const values: number[] = []
  for (let y = nowYear; y >= nowYear - MIN_YEAR_OFFSET; y--) values.push(y)
  const defaultYear = Math.max(1900, nowYear - 36)
  return { values, defaultIndex: values.indexOf(defaultYear) }
}

function daysInMonth(year: number, month0: number): number {
  return new Date(year, month0 + 1, 0).getDate()
}

export function DateOfBirthScreen({
  onComplete,
}: {
  onComplete: () => void
}) {
  const t = useTranslations('modules.onboarding.dateOfBirth')
  const localeTag = useLocale()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { values: years, defaultIndex: defaultYearIndex } = useMemo(buildYearList, [])

  const monthLabels = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(localeTag, { month: 'long' })
    return Array.from({ length: 12 }, (_, m) => fmt.format(new Date(2000, m, 1)))
  }, [localeTag])

  const [yearIndex, setYearIndex] = useState(() => Math.max(0, defaultYearIndex))
  const [monthIndex, setMonthIndex] = useState(0)
  const [dayIndex, setDayIndex] = useState(0)

  const year = years[yearIndex]
  const maxDay = useMemo(() => daysInMonth(year, monthIndex), [year, monthIndex])

  const dayLabels = useMemo(
    () => Array.from({ length: maxDay }, (_, i) => String(i + 1)),
    [maxDay],
  )

  // Clamp day when the month/year shrinks (e.g. Feb 30 → Feb 28).
  useEffect(() => {
    setDayIndex((prev) => Math.min(prev, maxDay - 1))
  }, [maxDay])

  const handleSave = useCallback(async () => {
    setSaving(true)
    setError(null)
    const iso = toIsoBirthDate(year, monthIndex, dayIndex + 1)
    const result = await saveOnboardingSegment('date-of-birth', iso)
    setSaving(false)
    if (result.success) {
      onComplete()
    } else {
      setError(result.error || t('saveError'))
    }
  }, [year, monthIndex, dayIndex, onComplete, t])

  const columnClass = 'flex-1 min-w-0'

  return (
    <div className="flex flex-col gap-6" data-testid="onboarding-date-of-birth">
      <div className="flex items-end gap-2" dir={undefined}>
        <RollerPicker
          className={columnClass}
          items={monthLabels}
          value={monthIndex}
          onChange={setMonthIndex}
          ariaLabel={t('month')}
        />
        <RollerPicker
          className={columnClass}
          items={dayLabels}
          value={dayIndex}
          onChange={setDayIndex}
          ariaLabel={t('day')}
        />
        <RollerPicker
          className={columnClass}
          items={years.map(String)}
          value={yearIndex}
          onChange={setYearIndex}
          ariaLabel={t('year')}
        />
      </div>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <Button type="button" size="lg" onClick={() => void handleSave()} disabled={saving}>
        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        {t('save')}
      </Button>
    </div>
  )
}
