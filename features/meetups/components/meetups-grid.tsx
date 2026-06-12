/**
 * Meetups Grid - Server Component
 */

import { db } from '@/lib/database'
import { Card, CardContent } from '@/components/ui/card'
import { Calendar, MapPin, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface MeetupsGridProps {
  userId: string
  locale: string
}

export async function MeetupsGrid({ userId, locale }: MeetupsGridProps) {

  const result = await db().queryDocs({
    collection: 'meetups',
    orderBy: [{ field: 'created_at', direction: 'desc' }],
    pagination: { limit: 20 },
  })

  if (!result.success) {
    return <Card><CardContent className="pt-6"><p className="text-destructive">Failed to load meetups</p></CardContent></Card>
  }

  const meetups = result.data

  if (meetups.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No upcoming meetups</h3>
          <p className="text-muted-foreground mb-4">Be the first to organize a pet meetup in your area!</p>
          <Button>Create Meetup</Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {meetups.map((meetup) => (
        <Card key={meetup.id}>
          <CardContent className="p-4">
            <h3 className="font-semibold">{String(meetup.title ?? '')}</h3>
            <div className="mt-2 space-y-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                <span>{new Date(String(meetup.date_time ?? '')).toLocaleDateString()}</span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                <span>{String(meetup.location_name ?? '')}</span>
              </div>
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                <span>{Array.isArray(meetup.participants) ? meetup.participants.length : 0} attending</span>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
