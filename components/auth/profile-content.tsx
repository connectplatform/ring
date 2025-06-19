"use client"

import type React from "react"
import { useState } from "react"
import { motion } from "framer-motion"
import { useTranslation } from "@/node_modules/react-i18next"
import { Card, CardHeader, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertTitle } from "@/components/ui/alert"
import { Avatar } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { User, Calendar, Shield, Star, Upload, CreditCard } from "lucide-react"
import UpgradeRequestModal from "@/components/modals/upgrade-request-modal"
import type { AuthUser, Wallet, KYCLevel, KYCStatus } from "@/features/auth/types"
import { KYCLevel as KYCLevelEnum, KYCStatus as KYCStatusEnum } from "@/features/auth/types"
import type { ProfileFormData, ProfileUpdateState, ProfileContentProps } from "@/types/profile"

/**
 * ProfileContent Component
 * Enhanced profile page with avatar, member since, auth method, KYC status, and upgrade functionality
 */
const ProfileContent: React.FC<ProfileContentProps> = ({
  initialUser,
  initialError,
  params,
  searchParams,
  session,
  updateProfile,
}) => {
  console.log('ProfileContent: Component starting with props:', {
    hasInitialUser: !!initialUser,
    initialError,
    hasSession: !!session,
    paramsKeys: Object.keys(params || {}),
    searchParamsKeys: Object.keys(searchParams || {})
  });

  const { t } = useTranslation();
  const [error, setError] = useState<string | null>(initialError)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitState, setSubmitState] = useState<ProfileUpdateState>({
    success: false,
    message: "",
  })
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)

  // User data - prioritize server-side data
  const user = initialUser || (session?.user as AuthUser) || null
  console.log('ProfileContent: User resolved:', {
    hasUser: !!user,
    userId: user?.id,
    userName: user?.name,
    userEmail: user?.email,
    walletsCount: user?.wallets?.length || 0
  });
  
  // Show no profile message if no user
  if (!user) {
    return (
      <div className="container mx-auto px-4 py-12 text-center">
        <motion.span 
          initial={{ opacity: 0 }} 
          animate={{ opacity: 1 }} 
          transition={{ duration: 0.5 }}
          className="text-xl"
        >
          {t("noProfileFound")}
        </motion.span>
      </div>
    )
  }

  // Get wallet information
  const primaryWallet = user.wallets?.find((wallet) => wallet.isDefault) || user.wallets?.[0]

  // Get user initials for avatar fallback
  const userInitials = user.name?.split(' ').map(n => n[0]).join('').toUpperCase() || user.email?.[0]?.toUpperCase() || 'U'

  // Format member since date
  const memberSinceDate = new Date(user.createdAt).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })

  // Get auth method display name
  const getAuthMethodName = (provider: string) => {
    return t(`authMethods.${provider}`, provider)
  }

  // Get KYC status color and text
  const getKYCStatusDisplay = (status: KYCStatus = KYCStatusEnum.NOT_STARTED) => {
    const statusColors = {
      [KYCStatusEnum.NOT_STARTED]: 'bg-gray-100 text-gray-800',
      [KYCStatusEnum.PENDING]: 'bg-yellow-100 text-yellow-800',
      [KYCStatusEnum.UNDER_REVIEW]: 'bg-blue-100 text-blue-800',
      [KYCStatusEnum.APPROVED]: 'bg-green-100 text-green-800',
      [KYCStatusEnum.REJECTED]: 'bg-red-100 text-red-800',
      [KYCStatusEnum.EXPIRED]: 'bg-gray-100 text-gray-800'
    }
    
    return {
      color: statusColors[status] || statusColors[KYCStatusEnum.NOT_STARTED],
      text: t(`kycVerification.status.${status}`, status)
    }
  }

  // Get KYC level display
  const getKYCLevelDisplay = (level: KYCLevel = KYCLevelEnum.NONE) => {
    return t(`kycVerification.levels.${level}`, level)
  }

  // Handle upgrade request submission
  const handleUpgradeRequest = async (requestData: any) => {
    try {
      // Here you would typically call an API to submit the upgrade request
      console.log('Submitting upgrade request:', requestData)
      
      // For now, just simulate success
      setSubmitState({
        success: true,
        message: t('roleUpgrade.requestSubmitted')
      })
      
      setTimeout(() => {
        setSubmitState({ success: false, message: "" })
      }, 5000)
      
    } catch (error) {
      console.error('Error submitting upgrade request:', error)
      throw error
    }
  }

  // Handle avatar upload
  const handleAvatarUpload = () => {
    // Implement avatar upload functionality
    console.log('Avatar upload clicked')
  }

  // Handle KYC verification start
  const handleStartKYC = () => {
    // Implement KYC verification start
    console.log('Start KYC verification clicked')
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto px-4 py-12">
        <motion.h1
          initial={{ opacity: 0, y: -50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-4xl font-bold text-center mb-8"
        >
          {t("profile")}
        </motion.h1>

        <div className="max-w-6xl mx-auto space-y-6">
          {/* Profile Header Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.5 }}
          >
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
                  {/* Avatar Section */}
                  <div className="flex flex-col items-center gap-2">
                    <Avatar
                      src={user.photoURL}
                      alt={user.name || 'User'}
                      size="xl"
                      fallback={userInitials}
                      onClick={handleAvatarUpload}
                    />
                    <Button variant="outline" size="sm" onClick={handleAvatarUpload}>
                      <Upload className="h-4 w-4 mr-2" />
                      {t("uploadAvatar")}
                    </Button>
                  </div>

                  {/* User Info Section */}
                  <div className="flex-1 text-center sm:text-left">
                    <h2 className="text-3xl font-bold mb-2">{user.name || user.email}</h2>
                    <p className="text-lg text-muted-foreground mb-4">{user.email}</p>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span>{t("role")}: </span>
                        <Badge variant="outline">{user.role}</Badge>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span>{t("memberSince")}: </span>
                        <span className="font-medium">{memberSinceDate}</span>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4 text-muted-foreground" />
                        <span>{t("primaryAuthMethod")}: </span>
                        <span className="font-medium">{getAuthMethodName(user.authProvider)}</span>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <CreditCard className="h-4 w-4 text-muted-foreground" />
                        <span>Balance: </span>
                        <span className="font-medium">{primaryWallet?.balance || "0"} MATIC</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <div className="grid lg:grid-cols-2 gap-6">
            {/* KYC Verification Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.5 }}
            >
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">{t("kycVerification.title")}</h3>
                    <Star className="h-5 w-5 text-yellow-500" />
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    {t("kycVerification.description")}
                  </p>
                  
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">{t("verificationLevel")}:</span>
                      <span className="text-sm">
                        {getKYCLevelDisplay(user.kycVerification?.level || KYCLevelEnum.NONE)}
                      </span>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Status:</span>
                      <Badge className={getKYCStatusDisplay(user.kycVerification?.status || KYCStatusEnum.NOT_STARTED).color}>
                        {getKYCStatusDisplay(user.kycVerification?.status || KYCStatusEnum.NOT_STARTED).text}
                      </Badge>
                    </div>
                  </div>
                  
                  <Separator className="my-4" />
                  
                  <div className="flex flex-col gap-2">
                    <Button onClick={handleStartKYC} className="w-full">
                      {t("getVerified")}
                    </Button>
                    <div className="grid grid-cols-2 gap-2">
                      <Button variant="outline" size="sm" onClick={handleStartKYC}>
                        {t("kycVerification.verifyWithDiia")}
                      </Button>
                      <Button variant="outline" size="sm" onClick={handleStartKYC}>
                        {t("kycVerification.verifyWithBankId")}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Role Upgrade Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.5 }}
            >
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">{t("roleUpgrade.title")}</h3>
                    <Star className="h-5 w-5 text-blue-500" />
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    {t("roleUpgrade.description")}
                  </p>
                  
                  {user.pendingUpgradeRequest ? (
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">Request Status:</span>
                        <Badge variant="outline">
                          {t(`roleUpgrade.status.${user.pendingUpgradeRequest.status}`)}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Submitted on: {new Date(user.pendingUpgradeRequest.submittedAt).toLocaleDateString()}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">{t("roleUpgrade.currentRole")}:</span>
                        <Badge variant="outline">{user.role}</Badge>
                      </div>
                      
                      <Button 
                        onClick={() => setShowUpgradeModal(true)} 
                        className="w-full"
                        disabled={user.role !== 'subscriber'}
                      >
                        {t("upgrade")} to Member
                      </Button>
                      
                      {user.role !== 'subscriber' && (
                        <p className="text-xs text-muted-foreground text-center">
                          Upgrade is only available for subscribers
                        </p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* Wallet & Bio Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.5 }}
          >
            <Card>
              <CardHeader>
                <h3 className="text-lg font-semibold">Additional Information</h3>
              </CardHeader>
              <CardContent className="grid lg:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium mb-3">Wallet Information</h4>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Address:</span>
                      <p className="font-mono text-xs break-all">
                        {primaryWallet?.address || "Not set"}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Balance:</span>
                      <p className="font-medium">{primaryWallet?.balance || "0"} MATIC</p>
                    </div>
                  </div>
                </div>
                
                <div>
                  <h4 className="font-medium mb-3">Biography</h4>
                  <p className="text-sm text-muted-foreground">
                    {user.bio || "No biography provided yet."}
                  </p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Success/Error Messages */}
        <div className="max-w-6xl mx-auto mt-6 space-y-4">
          {error && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Alert variant="destructive">
                <AlertTitle>Error: {error}</AlertTitle>
              </Alert>
            </motion.div>
          )}

          {submitState.message && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <Alert variant={submitState.success ? "default" : "destructive"}>
                <AlertTitle>{submitState.message}</AlertTitle>
              </Alert>
            </motion.div>
          )}
        </div>

        {/* Upgrade Request Modal */}
        <UpgradeRequestModal
          isOpen={showUpgradeModal}
          onClose={() => setShowUpgradeModal(false)}
          user={user}
          onSubmit={handleUpgradeRequest}
        />
      </div>
    </div>
  )
}

export default ProfileContent

