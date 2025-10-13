'use client'

import React, { useState, useCallback } from 'react'
import { useFormStatus } from 'react-dom'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useSession } from 'next-auth/react'
import { createOpportunity, OpportunityFormState } from '@/app/_actions/opportunities'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Progress } from '@/components/ui/progress'
import {
  Upload,
  FileText,
  X,
  CheckCircle2,
  AlertCircle,
  Code,
  Database,
  Globe,
  Server,
  Smartphone,
  Cloud,
  Shield,
  Zap,
  Target,
  User,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Award,
  BookOpen,
  Star,
  ChevronDown,
  ChevronUp
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { put } from '@vercel/blob'
import type { Locale } from '@/i18n-config'

interface DeveloperCVFormProps {
  locale: Locale
}

// Skill level definitions
const SKILL_LEVELS = [
  { value: 1, label: 'Beginner', description: 'Basic understanding, needs guidance' },
  { value: 2, label: 'Novice', description: 'Limited experience, can work with supervision' },
  { value: 3, label: 'Intermediate', description: 'Good understanding, can work independently' },
  { value: 4, label: 'Advanced', description: 'Strong expertise, can mentor others' },
  { value: 5, label: 'Expert', description: 'Deep expertise, thought leader in the field' }
]

// Ring Platform specific skills
const RING_SKILLS = [
  { id: 'ring_platform_overview', label: 'Ring Platform Architecture', category: 'ring' },
  { id: 'database_migration', label: 'Database Migration (Firebase → PostgreSQL)', category: 'ring' },
  { id: 'module_development', label: 'Custom Module Development', category: 'ring' },
  { id: 'ai_customization', label: 'AI Agent Customization', category: 'ring' },
  { id: 'whitelabel_deployment', label: 'White-label Deployment', category: 'ring' },
  { id: 'connectplatform_integration', label: 'ConnectPlatform Integration', category: 'ring' },
  { id: 'nft_marketplace', label: 'NFT Marketplace Development', category: 'ring' },
  { id: 'token_economics', label: 'Token Economics Design', category: 'ring' }
]

// React specific skills
const REACT_SKILLS = [
  { id: 'react_hooks', label: 'React Hooks (useState, useEffect, custom hooks)', category: 'react' },
  { id: 'react_context', label: 'React Context API', category: 'react' },
  { id: 'react_router', label: 'React Router', category: 'react' },
  { id: 'react_performance', label: 'React Performance Optimization', category: 'react' },
  { id: 'react19_features', label: 'React 19 Features (cache, useTransition)', category: 'react' },
  { id: 'nextjs', label: 'Next.js Framework', category: 'react' },
  { id: 'nextjs_app_router', label: 'Next.js App Router', category: 'react' },
  { id: 'server_components', label: 'Server Components', category: 'react' },
  { id: 'client_components', label: 'Client Components', category: 'react' },
  { id: 'ssr_ssg', label: 'SSR/SSG/ISR', category: 'react' }
]

// Other technical skills
const OTHER_TECH_SKILLS = [
  { id: 'typescript', label: 'TypeScript', category: 'language' },
  { id: 'javascript', label: 'JavaScript (ES6+)', category: 'language' },
  { id: 'nodejs', label: 'Node.js', category: 'backend' },
  { id: 'python', label: 'Python', category: 'language' },
  { id: 'postgresql', label: 'PostgreSQL', category: 'database' },
  { id: 'mongodb', label: 'MongoDB', category: 'database' },
  { id: 'firebase', label: 'Firebase', category: 'backend' },
  { id: 'aws', label: 'AWS Services', category: 'cloud' },
  { id: 'docker', label: 'Docker', category: 'devops' },
  { id: 'kubernetes', label: 'Kubernetes', category: 'devops' },
  { id: 'graphql', label: 'GraphQL', category: 'api' },
  { id: 'rest_api', label: 'REST APIs', category: 'api' },
  { id: 'git', label: 'Git Version Control', category: 'tool' },
  { id: 'ci_cd', label: 'CI/CD Pipelines', category: 'devops' },
  { id: 'testing', label: 'Unit/Integration Testing', category: 'quality' },
  { id: 'security', label: 'Web Security', category: 'security' }
]

// General IT knowledge areas
const IT_KNOWLEDGE_AREAS = [
  { id: 'software_architecture', label: 'Software Architecture Patterns', category: 'architecture' },
  { id: 'system_design', label: 'System Design', category: 'architecture' },
  { id: 'data_structures', label: 'Data Structures & Algorithms', category: 'computer_science' },
  { id: 'design_patterns', label: 'Design Patterns', category: 'architecture' },
  { id: 'agile_methodologies', label: 'Agile/Scrum Methodologies', category: 'methodology' },
  { id: 'project_management', label: 'Project Management', category: 'management' },
  { id: 'team_leadership', label: 'Team Leadership', category: 'management' },
  { id: 'code_review', label: 'Code Review & Quality Assurance', category: 'quality' },
  { id: 'mentoring', label: 'Developer Mentoring', category: 'education' },
  { id: 'technical_writing', label: 'Technical Documentation', category: 'communication' }
]

interface SkillRating {
  skillId: string
  level: number
  years: number
}

interface DeveloperCVData {
  // Basic Information
  fullName: string
  email: string
  phone?: string
  location: string
  linkedinUrl?: string
  githubUrl?: string
  portfolioUrl?: string

  // Professional Summary
  professionalSummary: string
  yearsOfExperience: number
  currentRole: string
  availability: 'immediately' | '2weeks' | '1month' | '3months' | 'not_available'

  // Ring Platform Expertise
  ringExperienceYears: number
  ringProjectsCompleted: number
  ringSkills: SkillRating[]
  ringCertifications?: string[]

  // React Expertise
  reactExperienceYears: number
  reactSkills: SkillRating[]
  reactProjects: string[]

  // Other Technical Skills
  otherSkills: SkillRating[]

  // IT Knowledge
  itKnowledge: SkillRating[]

  // Experience & Projects
  notableProjects: Array<{
    name: string
    description: string
    technologies: string[]
    role: string
    duration: string
    url?: string
  }>

  // Education
  education: Array<{
    institution: string
    degree: string
    field: string
    graduationYear: number
    gpa?: number
  }>

  // Certifications
  certifications: Array<{
    name: string
    issuer: string
    issueDate: string
    expiryDate?: string
    credentialId?: string
    url?: string
  }>

  // Languages
  languages: Array<{
    language: string
    proficiency: 'native' | 'fluent' | 'intermediate' | 'basic'
  }>

  // Resume
  resumeUrl?: string
  resumeFileName?: string

  // Preferences
  preferredProjectTypes: string[]
  hourlyRate?: number
  remoteWork: boolean
  relocationWilling: boolean
}

function SubmitButton() {
  const t = useTranslations('modules.opportunities')
  const { pending } = useFormStatus()

  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? (
        <>
          <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
          {t('saving', { defaultValue: 'Saving...' })}
        </>
      ) : (
        <>
          <FileText className="h-4 w-4 mr-2" />
          {t('save', { defaultValue: 'Save' })}
        </>
      )}
    </Button>
  )
}

export default function DeveloperCVForm({ locale }: DeveloperCVFormProps) {
  const t = useTranslations('modules.opportunities')
  const tCommon = useTranslations('common')
  const { data: session } = useSession()
  const router = useRouter()

  const [formState, setFormState] = useState<OpportunityFormState | null>(null)

  const [cvData, setCvData] = useState<DeveloperCVData>({
    fullName: session?.user?.name || '',
    email: session?.user?.email || '',
    phone: '',
    location: '',
    linkedinUrl: '',
    githubUrl: '',
    portfolioUrl: '',
    professionalSummary: '',
    yearsOfExperience: 0,
    currentRole: '',
    availability: 'immediately',
    ringExperienceYears: 0,
    ringProjectsCompleted: 0,
    ringSkills: [],
    reactExperienceYears: 0,
    reactSkills: [],
    reactProjects: [],
    otherSkills: [],
    itKnowledge: [],
    notableProjects: [{ name: '', description: '', technologies: [], role: '', duration: '' }],
    education: [{ institution: '', degree: '', field: '', graduationYear: new Date().getFullYear() }],
    certifications: [],
    languages: [{ language: 'English', proficiency: 'fluent' }],
    preferredProjectTypes: [],
    remoteWork: true,
    relocationWilling: false
  })

  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['basic-info']))

  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev)
      if (newSet.has(section)) {
        newSet.delete(section)
      } else {
        newSet.add(section)
      }
      return newSet
    })
  }

  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validate file type and size
    if (!file.type.includes('pdf') && !file.type.includes('doc') && !file.type.includes('docx')) {
      alert('Please upload a PDF, DOC, or DOCX file')
      return
    }

    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      alert('File size must be less than 10MB')
      return
    }

    setUploading(true)
    setUploadProgress(0)

    try {
      // Upload to Vercel Blob
      const blob = await put(file.name, file, {
        access: 'public',
        onUploadProgress: (progress) => {
          setUploadProgress(progress.percentage)
        }
      })

      setCvData(prev => ({
        ...prev,
        resumeUrl: blob.url,
        resumeFileName: file.name
      }))
    } catch (error) {
      console.error('Upload failed:', error)
      alert('Failed to upload resume. Please try again.')
    } finally {
      setUploading(false)
      setUploadProgress(0)
    }
  }, [])

  const updateSkillRating = (category: 'ringSkills' | 'reactSkills' | 'otherSkills' | 'itKnowledge', skillId: string, level: number, years: number) => {
    setCvData(prev => ({
      ...prev,
      [category]: prev[category].some(s => s.skillId === skillId)
        ? prev[category].map(s => s.skillId === skillId ? { skillId, level, years } : s)
        : [...prev[category], { skillId, level, years }]
    }))
  }

  const removeSkill = (category: 'ringSkills' | 'reactSkills' | 'otherSkills' | 'itKnowledge', skillId: string) => {
    setCvData(prev => ({
      ...prev,
      [category]: prev[category].filter(s => s.skillId !== skillId)
    }))
  }

  const getSkillLevel = (category: 'ringSkills' | 'reactSkills' | 'otherSkills' | 'itKnowledge', skillId: string) => {
    return cvData[category].find(s => s.skillId === skillId)
  }

  const renderSkillSection = (
    title: string,
    skills: Array<{id: string, label: string, category: string}>,
    category: 'ringSkills' | 'reactSkills' | 'otherSkills' | 'itKnowledge',
    icon: React.ComponentType<any>
  ) => {
    const IconComponent = icon
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <IconComponent className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">{title}</h3>
        </div>
        <div className="grid gap-4">
          {skills.map(skill => {
            const currentRating = getSkillLevel(category, skill.id)
            return (
              <Card key={skill.id} className="p-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{skill.label}</span>
                    {currentRating && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeSkill(category, skill.id)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>

                  {!currentRating ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => updateSkillRating(category, skill.id, 3, 1)}
                      className="w-full"
                    >
                      Add Skill
                    </Button>
                  ) : (
                    <div className="space-y-3">
                      <div>
                        <Label className="text-sm">Proficiency Level</Label>
                        <Select
                          value={currentRating.level.toString()}
                          onValueChange={(value) => updateSkillRating(category, skill.id, parseInt(value), currentRating.years)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {SKILL_LEVELS.map(level => (
                              <SelectItem key={level.value} value={level.value.toString()}>
                                {level.label} - {level.description}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label className="text-sm">Years of Experience</Label>
                        <Select
                          value={currentRating.years.toString()}
                          onValueChange={(value) => updateSkillRating(category, skill.id, currentRating.level, parseInt(value))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(years => (
                              <SelectItem key={years} value={years.toString()}>
                                {years === 0 ? '< 1 year' : `${years}+ years`}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            )
          })}
        </div>
      </div>
    )
  }

  // Convert form data to opportunity format
  const handleSubmit = async (formData: FormData) => {
    // Create a comprehensive description from CV data
    const description = `
Developer CV: ${cvData.fullName}

Professional Summary:
${cvData.professionalSummary}

Experience: ${cvData.yearsOfExperience} years
Current Role: ${cvData.currentRole}
Availability: ${cvData.availability}

Ring Platform Expertise:
- ${cvData.ringExperienceYears} years of experience
- ${cvData.ringProjectsCompleted} projects completed

Key Skills:
${cvData.ringSkills.map(s => `- ${RING_SKILLS.find(skill => skill.id === s.skillId)?.label} (Level ${s.level}/5, ${s.years} years)`).join('\n')}

React Expertise:
${cvData.reactSkills.map(s => `- ${REACT_SKILLS.find(skill => skill.id === s.skillId)?.label} (Level ${s.level}/5, ${s.years} years)`).join('\n')}

Contact: ${cvData.email}
${cvData.phone ? `Phone: ${cvData.phone}` : ''}
${cvData.location ? `Location: ${cvData.location}` : ''}
${cvData.resumeUrl ? `Resume: ${cvData.resumeUrl}` : ''}
    `.trim()

    // Set form data for submission
    formData.set('type', 'cv')
    formData.set('title', `Developer CV: ${cvData.fullName} - ${cvData.currentRole}`)
    formData.set('briefDescription', cvData.professionalSummary.substring(0, 200) + '...')
    formData.set('fullDescription', description)
    formData.set('category', 'technology')
    formData.set('tags', JSON.stringify(['developer', 'cv', 'portfolio', 'ring-platform']))
    formData.set('location', cvData.location)
    formData.set('requiredSkills', JSON.stringify(['ring-platform', 'react', 'typescript']))
    formData.set('attachments', JSON.stringify([{ url: cvData.resumeUrl || '', name: cvData.resumeFileName || 'CV' }]))

    // Call the original action
    setFormState(null) // Clear previous state
    const result = await createOpportunity(null, formData)
    setFormState(result)

    if (result?.success) {
      router.push(`/${locale}/opportunities`)
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-6 w-6" />
            Share Your Developer CV
          </CardTitle>
          <CardDescription>
            Create a comprehensive developer profile to showcase your skills and connect with Ring Platform opportunities.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={async (formData: FormData) => { await handleSubmit(formData) }} className="space-y-8">
            {/* Basic Information */}
            <Collapsible
              open={expandedSections.has('basic-info')}
              onOpenChange={() => toggleSection('basic-info')}
            >
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between p-4 h-auto">
                  <div className="flex items-center gap-2">
                    <User className="h-5 w-5" />
                    <span className="text-lg font-semibold">Basic Information</span>
                  </div>
                  {expandedSections.has('basic-info') ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="px-4 pb-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="fullName">Full Name *</Label>
                    <Input
                      id="fullName"
                      value={cvData.fullName}
                      onChange={(e) => setCvData(prev => ({ ...prev, fullName: e.target.value }))}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="email">Email *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={cvData.email}
                      onChange={(e) => setCvData(prev => ({ ...prev, email: e.target.value }))}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      value={cvData.phone}
                      onChange={(e) => setCvData(prev => ({ ...prev, phone: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="location">Location *</Label>
                    <Input
                      id="location"
                      value={cvData.location}
                      onChange={(e) => setCvData(prev => ({ ...prev, location: e.target.value }))}
                      placeholder="City, Country"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="linkedinUrl">LinkedIn URL</Label>
                    <Input
                      id="linkedinUrl"
                      value={cvData.linkedinUrl}
                      onChange={(e) => setCvData(prev => ({ ...prev, linkedinUrl: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="githubUrl">GitHub URL</Label>
                    <Input
                      id="githubUrl"
                      value={cvData.githubUrl}
                      onChange={(e) => setCvData(prev => ({ ...prev, githubUrl: e.target.value }))}
                    />
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* Professional Summary */}
            <Collapsible
              open={expandedSections.has('professional')}
              onOpenChange={() => toggleSection('professional')}
            >
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between p-4 h-auto">
                  <div className="flex items-center gap-2">
                    <Target className="h-5 w-5" />
                    <span className="text-lg font-semibold">Professional Summary</span>
                  </div>
                  {expandedSections.has('professional') ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="px-4 pb-4">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="professionalSummary">Professional Summary *</Label>
                    <Textarea
                      id="professionalSummary"
                      value={cvData.professionalSummary}
                      onChange={(e) => setCvData(prev => ({ ...prev, professionalSummary: e.target.value }))}
                      placeholder="Describe your professional background, key achievements, and what you're looking for..."
                      rows={4}
                      required
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="yearsOfExperience">Years of Experience</Label>
                      <Input
                        id="yearsOfExperience"
                        type="number"
                        min="0"
                        max="50"
                        value={cvData.yearsOfExperience}
                        onChange={(e) => setCvData(prev => ({ ...prev, yearsOfExperience: parseInt(e.target.value) || 0 }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="currentRole">Current Role</Label>
                      <Input
                        id="currentRole"
                        value={cvData.currentRole}
                        onChange={(e) => setCvData(prev => ({ ...prev, currentRole: e.target.value }))}
                        placeholder="e.g. Senior React Developer"
                      />
                    </div>
                    <div>
                      <Label htmlFor="availability">Availability</Label>
                      <Select
                        value={cvData.availability}
                        onValueChange={(value: any) => setCvData(prev => ({ ...prev, availability: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="immediately">Immediately</SelectItem>
                          <SelectItem value="2weeks">2 weeks</SelectItem>
                          <SelectItem value="1month">1 month</SelectItem>
                          <SelectItem value="3months">3 months</SelectItem>
                          <SelectItem value="not_available">Not available</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* Ring Platform Expertise */}
            <Collapsible
              open={expandedSections.has('ring-expertise')}
              onOpenChange={() => toggleSection('ring-expertise')}
            >
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between p-4 h-auto">
                  <div className="flex items-center gap-2">
                    <Zap className="h-5 w-5 text-purple-500" />
                    <span className="text-lg font-semibold">Ring Platform Expertise</span>
                  </div>
                  {expandedSections.has('ring-expertise') ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="px-4 pb-4">
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="ringExperienceYears">Years of Ring Platform Experience</Label>
                      <Input
                        id="ringExperienceYears"
                        type="number"
                        min="0"
                        max="10"
                        value={cvData.ringExperienceYears}
                        onChange={(e) => setCvData(prev => ({ ...prev, ringExperienceYears: parseInt(e.target.value) || 0 }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="ringProjectsCompleted">Ring Projects Completed</Label>
                      <Input
                        id="ringProjectsCompleted"
                        type="number"
                        min="0"
                        max="100"
                        value={cvData.ringProjectsCompleted}
                        onChange={(e) => setCvData(prev => ({ ...prev, ringProjectsCompleted: parseInt(e.target.value) || 0 }))}
                      />
                    </div>
                  </div>
                  {renderSkillSection('Ring Platform Skills', RING_SKILLS, 'ringSkills', Zap)}
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* React Expertise */}
            <Collapsible
              open={expandedSections.has('react-expertise')}
              onOpenChange={() => toggleSection('react-expertise')}
            >
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between p-4 h-auto">
                  <div className="flex items-center gap-2">
                    <Code className="h-5 w-5 text-blue-500" />
                    <span className="text-lg font-semibold">React Expertise</span>
                  </div>
                  {expandedSections.has('react-expertise') ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="px-4 pb-4">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="reactExperienceYears">Years of React Experience</Label>
                    <Input
                      id="reactExperienceYears"
                      type="number"
                      min="0"
                      max="15"
                      value={cvData.reactExperienceYears}
                      onChange={(e) => setCvData(prev => ({ ...prev, reactExperienceYears: parseInt(e.target.value) || 0 }))}
                    />
                  </div>
                  {renderSkillSection('React Skills', REACT_SKILLS, 'reactSkills', Code)}
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* Other Technical Skills */}
            <Collapsible
              open={expandedSections.has('other-skills')}
              onOpenChange={() => toggleSection('other-skills')}
            >
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between p-4 h-auto">
                  <div className="flex items-center gap-2">
                    <Server className="h-5 w-5 text-green-500" />
                    <span className="text-lg font-semibold">Other Technical Skills</span>
                  </div>
                  {expandedSections.has('other-skills') ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="px-4 pb-4">
                {renderSkillSection('Technical Skills', OTHER_TECH_SKILLS, 'otherSkills', Server)}
              </CollapsibleContent>
            </Collapsible>

            {/* IT Knowledge */}
            <Collapsible
              open={expandedSections.has('it-knowledge')}
              onOpenChange={() => toggleSection('it-knowledge')}
            >
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between p-4 h-auto">
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-5 w-5 text-orange-500" />
                    <span className="text-lg font-semibold">IT Knowledge & Soft Skills</span>
                  </div>
                  {expandedSections.has('it-knowledge') ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="px-4 pb-4">
                {renderSkillSection('IT Knowledge Areas', IT_KNOWLEDGE_AREAS, 'itKnowledge', BookOpen)}
              </CollapsibleContent>
            </Collapsible>

            {/* Resume Upload */}
            <Collapsible
              open={expandedSections.has('resume')}
              onOpenChange={() => toggleSection('resume')}
            >
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between p-4 h-auto">
                  <div className="flex items-center gap-2">
                    <Upload className="h-5 w-5" />
                    <span className="text-lg font-semibold">Resume/CV Upload</span>
                  </div>
                  {expandedSections.has('resume') ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="px-4 pb-4">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="resume">Upload Resume (PDF, DOC, DOCX - Max 10MB)</Label>
                    <Input
                      id="resume"
                      type="file"
                      accept=".pdf,.doc,.docx"
                      onChange={handleFileUpload}
                      disabled={uploading}
                    />
                    {uploading && (
                      <div className="mt-2">
                        <Progress value={uploadProgress} className="w-full" />
                        <p className="text-sm text-muted-foreground mt-1">
                          Uploading... {uploadProgress.toFixed(0)}%
                        </p>
                      </div>
                    )}
                    {cvData.resumeUrl && (
                      <div className="mt-2 flex items-center gap-2 p-2 bg-green-50 dark:bg-green-950/20 rounded-md">
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        <span className="text-sm text-green-700 dark:text-green-300">
                          {cvData.resumeFileName} uploaded successfully
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* Form Status */}
            {formState?.success === false && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>
                  {formState.message || 'Failed to save your developer CV. Please try again.'}
                </AlertDescription>
              </Alert>
            )}

            {formState?.success === true && (
              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertTitle>Success!</AlertTitle>
                <AlertDescription>
                  Your developer CV has been published successfully.
                </AlertDescription>
              </Alert>
            )}

            {/* Submit Button */}
            <div className="pt-6 border-t">
              <SubmitButton />
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
