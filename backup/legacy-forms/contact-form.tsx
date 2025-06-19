'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { sendToTelegramBot } from '@/lib/telegram'
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Typography } from "@/components/ui/typography"
import { useTranslation } from '@/node_modules/react-i18next'

interface ContactFormProps {
  entityId: string
  entityName: string
  initialUserInfo: {
    name: string
    email: string
  }
}

interface FormData {
  name: string
  email: string
  message: string
}

export function ContactForm({ entityId, entityName, initialUserInfo }: ContactFormProps) {
  const { t } = useTranslation()
  const { register, handleSubmit, formState: { errors }, reset } = useForm<FormData>({
    defaultValues: {
      name: initialUserInfo.name,
      email: initialUserInfo.email
    }
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitSuccess, setSubmitSuccess] = useState(false)

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true)
    try {
      await sendToTelegramBot({
        entityId,
        entityName,
        name: initialUserInfo.name || data.name,
        email: initialUserInfo.email || data.email,
        message: data.message
      })
      setSubmitSuccess(true)
      reset()
    } catch (error) {
      console.error('Error sending form:', error)
      alert(t('errorSubmittingForm'))
    }
    setIsSubmitting(false)
  }

  if (submitSuccess) {
    return <Typography variant="p" className="text-center text-xl">{t('formSubmitted')}</Typography>
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {!initialUserInfo.name && (
        <div>
          <Label htmlFor="name" className="block mb-1">{t('name')}</Label>
          <Input
            id="name"
            {...register('name', { required: t('fieldRequired') })}
          />
          {errors.name && <span className="text-red-500 text-sm">{errors.name.message}</span>}
        </div>
      )}
      {!initialUserInfo.email && (
        <div>
          <Label htmlFor="email" className="block mb-1">{t('emailAddress')}</Label>
          <Input
            id="email"
            type="email"
            {...register('email', { 
              required: t('fieldRequired'),
              pattern: {
                value: /^\S+@\S+$/i,
                message: t('invalidEmail')
              }
            })}
          />
          {errors.email && <span className="text-red-500 text-sm">{errors.email.message}</span>}
        </div>
      )}
      <div>
        <Label htmlFor="message" className="block mb-1">{t('message')}</Label>
        <Textarea
          id="message"
          {...register('message', { required: t('fieldRequired') })}
          rows={4}
        />
        {errors.message && <span className="text-red-500 text-sm">{errors.message.message}</span>}
      </div>
      <Button
        type="submit"
        disabled={isSubmitting}
      >
        {isSubmitting ? t('sending') : t('send')}
      </Button>
    </form>
  )
}

