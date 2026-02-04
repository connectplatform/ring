'use client'

import React, { useState, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import {
  Upload,
  FileText,
  CheckCircle,
  XCircle,
  AlertCircle,
  Camera,
  File,
  Image as ImageIcon,
  Shield,
  Check
} from 'lucide-react'
import { KYCDocumentType, KYCStatus } from '@/features/auth/types'

interface KYCUploadProps {
  onUpload: (document: { type: KYCDocumentType; file: File }) => Promise<void>
  currentStatus?: KYCStatus
  uploadedDocuments?: Array<{
    type: KYCDocumentType
    status: KYCStatus
    uploadedAt: Date
    fileName: string
  }>
}

const DOCUMENT_TYPES = [
  {
    type: KYCDocumentType.PASSPORT,
    label: 'Passport',
    description: 'Government-issued passport',
    icon: FileText,
    acceptedTypes: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
  },
  {
    type: KYCDocumentType.ID_CARD,
    label: 'ID Card',
    description: 'National ID or identity card',
    icon: Shield,
    acceptedTypes: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
  },
  {
    type: KYCDocumentType.DRIVERS_LICENSE,
    label: 'Driver\'s License',
    description: 'Valid driver\'s license',
    icon: File,
    acceptedTypes: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
  },
  {
    type: KYCDocumentType.DIIA_CERTIFICATE,
    label: 'Diia Certificate',
    description: 'Ukrainian Diia digital certificate',
    icon: Shield,
    acceptedTypes: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
  },
  {
    type: KYCDocumentType.BANK_ID_CERTIFICATE,
    label: 'Bank ID Certificate',
    description: 'Bank-issued digital certificate',
    icon: Shield,
    acceptedTypes: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
  }
]

export default function KYCUpload({ onUpload, currentStatus = KYCStatus.NOT_STARTED, uploadedDocuments = [] }: KYCUploadProps) {
  const t = useTranslations('modules.profile')
  const [uploadingType, setUploadingType] = useState<KYCDocumentType | null>(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null)

  const getStatusBadge = (status: KYCStatus) => {
    const statusConfig = {
      [KYCStatus.NOT_STARTED]: { color: 'bg-gray-100 text-gray-800', label: 'Not Started' },
      [KYCStatus.PENDING]: { color: 'bg-yellow-100 text-yellow-800', label: 'Pending' },
      [KYCStatus.UNDER_REVIEW]: { color: 'bg-blue-100 text-blue-800', label: 'Under Review' },
      [KYCStatus.APPROVED]: { color: 'bg-green-100 text-green-800', label: 'Approved' },
      [KYCStatus.REJECTED]: { color: 'bg-red-100 text-red-800', label: 'Rejected' },
      [KYCStatus.EXPIRED]: { color: 'bg-orange-100 text-orange-800', label: 'Expired' }
    }

    const config = statusConfig[status]
    return (
      <Badge className={config.color}>
        {config.label}
      </Badge>
    )
  }

  const getDocumentIcon = (type: KYCDocumentType) => {
    const docType = DOCUMENT_TYPES.find(dt => dt.type === type)
    return docType ? docType.icon : FileText
  }

  const isDocumentUploaded = (type: KYCDocumentType) => {
    return uploadedDocuments.some(doc => doc.type === type)
  }

  const getDocumentStatus = (type: KYCDocumentType) => {
    const doc = uploadedDocuments.find(d => d.type === type)
    return doc ? doc.status : null
  }

  const handleFileSelect = useCallback(async (type: KYCDocumentType, file: File) => {
    setUploadingType(type)
    setUploadProgress(0)
    setUploadError(null)
    setUploadSuccess(null)

    try {
      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval)
            return prev
          }
          return prev + 10
        })
      }, 100)

      await onUpload({ type, file })

      clearInterval(progressInterval)
      setUploadProgress(100)
      setUploadSuccess(`${type.replace('_', ' ').toUpperCase()} uploaded successfully`)

      setTimeout(() => {
        setUploadSuccess(null)
        setUploadProgress(0)
      }, 3000)

    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Upload failed')
      setUploadProgress(0)
    } finally {
      setUploadingType(null)
    }
  }, [onUpload])

  const handleFileInput = (type: KYCDocumentType) => (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      handleFileSelect(type, file)
    }
    // Reset input value to allow re-uploading the same file
    event.target.value = ''
  }

  return (
    <div className="space-y-6">
      {/* Current Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            KYC Verification Status
          </CardTitle>
          <CardDescription>
            Complete your identity verification to unlock premium features
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Verification Level</p>
              <div className="flex items-center gap-2">
                {getStatusBadge(currentStatus)}
                <span className="text-sm text-muted-foreground">
                  {uploadedDocuments.length} document(s) uploaded
                </span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-primary">
                {Math.round((uploadedDocuments.filter(doc => doc.status === KYCStatus.APPROVED).length / DOCUMENT_TYPES.length) * 100)}%
              </div>
              <p className="text-xs text-muted-foreground">Complete</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Upload Messages */}
      {uploadError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{uploadError}</AlertDescription>
        </Alert>
      )}

      {uploadSuccess && (
        <Alert className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800 dark:text-green-200">
            {uploadSuccess}
          </AlertDescription>
        </Alert>
      )}

      {/* Document Upload Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload Documents
          </CardTitle>
          <CardDescription>
            Upload one of the accepted documents to begin verification
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {DOCUMENT_TYPES.map((docType) => {
            const IconComponent = docType.icon
            const isUploaded = isDocumentUploaded(docType.type)
            const status = getDocumentStatus(docType.type)
            const isUploading = uploadingType === docType.type

            return (
              <div key={docType.type} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${isUploaded ? 'bg-green-100 dark:bg-green-900' : 'bg-muted'}`}>
                    <IconComponent className={`h-5 w-5 ${isUploaded ? 'text-green-600' : 'text-muted-foreground'}`} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{docType.label}</p>
                      {status && getStatusBadge(status)}
                    </div>
                    <p className="text-sm text-muted-foreground">{docType.description}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {isUploading && (
                    <div className="flex items-center gap-2 min-w-[120px]">
                      <Progress value={uploadProgress} className="w-16" />
                      <span className="text-sm text-muted-foreground">{uploadProgress}%</span>
                    </div>
                  )}

                  {!isUploading && (
                    <>
                      <input
                        type="file"
                        accept={docType.acceptedTypes.join(',')}
                        onChange={handleFileInput(docType.type)}
                        className="hidden"
                        id={`file-${docType.type}`}
                        disabled={isUploading}
                      />
                      <label htmlFor={`file-${docType.type}`}>
                        <Button
                          variant={isUploaded ? "outline" : "default"}
                          size="sm"
                          className="cursor-pointer"
                          disabled={isUploading}
                          asChild
                        >
                          <span>
                            {isUploaded ? (
                              <>
                                <Check className="mr-2 h-4 w-4" />
                                Re-upload
                              </>
                            ) : (
                              <>
                                <Upload className="mr-2 h-4 w-4" />
                                Upload
                              </>
                            )}
                          </span>
                        </Button>
                      </label>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </CardContent>
      </Card>

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>Upload Instructions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium flex-shrink-0 mt-0.5">
              1
            </div>
            <div>
              <p className="font-medium">Choose Document Type</p>
              <p className="text-sm text-muted-foreground">Select from passport, ID card, driver's license, or digital certificates</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium flex-shrink-0 mt-0.5">
              2
            </div>
            <div>
              <p className="font-medium">Take Clear Photo</p>
              <p className="text-sm text-muted-foreground">Ensure document is well-lit, all corners are visible, and text is readable</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium flex-shrink-0 mt-0.5">
              3
            </div>
            <div>
              <p className="font-medium">Upload File</p>
              <p className="text-sm text-muted-foreground">Supported formats: JPG, PNG, WebP, PDF (max 10MB)</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium flex-shrink-0 mt-0.5">
              4
            </div>
            <div>
              <p className="font-medium">Wait for Review</p>
              <p className="text-sm text-muted-foreground">Our team will review your documents within 24-48 hours</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
