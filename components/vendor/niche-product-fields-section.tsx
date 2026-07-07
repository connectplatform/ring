'use client'

// TODO: Generalize product fields vars to accomodate for presets.
// TODO: Analyze usage of this component for ring-erp and wire as needed.

/**
 * Optional extended product metadata (legacy ERP / certification fields).
 * 
 * Fields (organized by category):
 * - Origin & Traceability (farm, location, harvest date, batch)
 * - Certifications (organic, fair trade, etc)
 * - Sustainability (carbon, water, packaging)
 * - Freshness (harvest, shelf life, storage)
 * 
 * Future: AI enrichment will auto-populate many of these fields
 * 
 * Tech: React 19 + Collapsible sections + Agricultural theme
 */

import React, { useState } from 'react'
// TODO: Consider replacing useState with React's useOptimistic/useRef for large forms to reduce re-renders (React 19+ feature).
import { useTranslations } from 'next-intl'
import { ChevronDown, ChevronRight, Leaf, Award, Recycle, Calendar } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'
import { getProductFieldsPreset } from '@/lib/ring-config-core'

// TODO: AnimatePresence and framer-motion work well here, but for simple show/hide with better SSR/streaming compatibility,
// consider React 19's <Show /> native tags when available.

interface NicheProductFieldsSectionProps {
  isPending?: boolean
  existingData?: any // TODO: Replace 'any' with a proper typescript interface for stricter typing and autocompletion.
  /** Currently selected product category — used to show category-specific fields. */
  category?: string
}

/**
 * Renders the entry point for extended agricultural/niche product fields.
 * - Checks the current product fields preset from config
 * - Only renders AgriculturalProductFields if preset is 'platform'
 */
export default function NicheProductFieldsSection(props: NicheProductFieldsSectionProps) {
  // Use product field preset from config to determine whether to show this section.
  // TODO: Consider moving this logic higher (parent page) or inside getServerSideProps for SSR optimization.
  const preset = getProductFieldsPreset()

  if (preset !== 'platform') {
    return null // Not on 'platform' preset, render nothing.
  } else {
    return <AgriculturalProductFields {...props} /> // Show extended fields.
  }
}

/**
 * Displays collapsible, animated sections for various extended product metadata.
 * - Origin & Traceability
 * - Certifications
 * - Sustainability
 * - Freshness & Storage
 * 
 * Props:
 *  - isPending: disables inputs when true
 *  - existingData: initial field values (STUB: should follow a strict shape)
 */
function AgriculturalProductFields({ isPending, existingData }: NicheProductFieldsSectionProps) {
  // Section expansion/collapse state
  const [expanded, setExpanded] = useState(false)
  // Individual section toggles
  const [showOrigin, setShowOrigin] = useState(false)
  const [showCertifications, setShowCertifications] = useState(false)
  const [showSustainability, setShowSustainability] = useState(false)
  const [showFreshness, setShowFreshness] = useState(false)
  // TODO: For accessibility, persist expanded/collapsed state in localStorage or URL query if useful.

  return (
    <div className="space-y-4">
      {/* Main Toggle Button for the expandable section */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        // TODO: Refactor to use React 19's <button inert> or native "open" attribute if possible once widespread.
        className={cn(
          "w-full flex items-center justify-between p-4 rounded-lg",
          "border-2 border-dashed transition-all duration-300",
          expanded 
            ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20" 
            : "border-border hover:border-emerald-300"
        )}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500/20 to-lime-500/20 flex items-center justify-center">
            <Leaf className="w-5 h-5 text-emerald-600" />
          </div>
          <div className="text-left">
            <h3 className="font-semibold text-sm">
              Agricultural Details <Badge variant="secondary" className="ml-2 text-[10px]">Optional</Badge>
            </h3>
            <p className="text-xs text-muted-foreground">
              Add traceability, certifications, and sustainability data
            </p>
          </div>
        </div>
        {/* Chevron icon changes based on expanded state */}
        {expanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
      </button>

      {/* Expandable content with framer-motion for smooth open/close */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-4"
          >
            {/* ---------------------- Origin & Traceability ---------------------- */}
            <Card className="border-emerald-500/20">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  {/* Section title with icon */}
                  <div className="flex items-center gap-2">
                    <Leaf className="w-4 h-4 text-emerald-600" />
                    <CardTitle className="text-sm">Origin & Traceability</CardTitle>
                  </div>
                  {/* Collapse/expand button */}
                  <button
                    type="button"
                    onClick={() => setShowOrigin(!showOrigin)}
                    className="text-xs text-emerald-600 hover:underline"
                    aria-controls="origin-section"
                    aria-expanded={showOrigin}
                  >
                    {showOrigin ? 'Hide' : 'Show'}
                  </button>
                </div>
                <CardDescription className="text-xs">
                  Farm location, harvest date, batch tracking
                </CardDescription>
              </CardHeader>
              
              <AnimatePresence>
                {showOrigin && (
                  <motion.div
                    id="origin-section"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                  >
                    <CardContent className="space-y-4">
                      <div className="grid md:grid-cols-2 gap-4">
                        {/* Harvest Date */}
                        <div className="space-y-2">
                          <Label htmlFor="harvestDate" className="text-xs">Harvest Date</Label>
                          <Input
                            id="harvestDate"
                            name="harvestDate"
                            type="date"
                            defaultValue={existingData?.agriculturalData?.origin?.harvestDate}
                            disabled={isPending}
                            className="h-9 text-sm"
                          />
                        </div>
                        {/* Batch Number */}
                        <div className="space-y-2">
                          <Label htmlFor="batchNumber" className="text-xs">Batch Number</Label>
                          <Input
                            id="batchNumber"
                            name="batchNumber"
                            placeholder="BATCH-2025-001"
                            defaultValue={existingData?.agriculturalData?.origin?.batchNumber}
                            disabled={isPending}
                            className="h-9 text-sm"
                          />
                        </div>
                      </div>
                      {/* Farm Location */}
                      <div className="space-y-2">
                        <Label htmlFor="farmLocation" className="text-xs">Farm Address</Label>
                        <Input
                          id="farmLocation"
                          name="farmLocation"
                          placeholder="Kyiv Oblast, Ukraine"
                          defaultValue={existingData?.agriculturalData?.origin?.location?.address}
                          disabled={isPending}
                          className="h-9 text-sm"
                        />
                      </div>
                    </CardContent>
                  </motion.div>
                )}
              </AnimatePresence>
            </Card>

            {/* ---------------------- Certifications Section ---------------------- */}
            <Card className="border-emerald-500/20">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Award className="w-4 h-4 text-amber-600" />
                    <CardTitle className="text-sm">Certifications</CardTitle>
                  </div>
                  {/* Collapse/expand button */}
                  <button
                    type="button"
                    onClick={() => setShowCertifications(!showCertifications)}
                    className="text-xs text-emerald-600 hover:underline"
                    aria-controls="certifications-section"
                    aria-expanded={showCertifications}
                  >
                    {showCertifications ? 'Hide' : 'Show'}
                  </button>
                </div>
                <CardDescription className="text-xs">
                  Organic, Fair Trade, and other certifications
                </CardDescription>
              </CardHeader>
              
              <AnimatePresence>
                {showCertifications && (
                  <motion.div
                    id="certifications-section"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                  >
                    <CardContent className="space-y-4">
                      <div className="grid md:grid-cols-2 gap-4">
                        {/* Organic Certification (dropdown/select) */}
                        <div className="space-y-2">
                          <Label htmlFor="organicCert" className="text-xs">Organic Certification</Label>
                          <Select name="organicCert" defaultValue={existingData?.certifications?.organic || 'None'}>
                            <SelectTrigger className="h-9 text-sm">
                              <SelectValue placeholder="None" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="None">None</SelectItem>
                              <SelectItem value="USDA">USDA Organic</SelectItem>
                              <SelectItem value="EU-Organic">EU Organic</SelectItem>
                              <SelectItem value="Biodynamic">Biodynamic</SelectItem>
                              <SelectItem value="Other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        {/* Organic Certification Number */}
                        <div className="space-y-2">
                          <Label htmlFor="organicCertNumber" className="text-xs">Cert Number</Label>
                          <Input
                            id="organicCertNumber"
                            name="organicCertNumber"
                            placeholder="ORG-123456"
                            defaultValue={existingData?.certifications?.organicCertNumber}
                            disabled={isPending}
                            className="h-9 text-sm"
                          />
                        </div>
                      </div>

                      {/* Fair Trade, Locally Grown, Regenerative Agriculture */}
                      <div className="flex flex-wrap gap-4">
                        {/* Fair Trade Switch */}
                        <div className="flex items-center space-x-2">
                          <Switch 
                            id="fairTrade" 
                            name="fairTrade"
                            defaultChecked={existingData?.certifications?.fairTrade}
                            disabled={isPending}
                          />
                          <Label htmlFor="fairTrade" className="text-xs">Fair Trade</Label>
                        </div>
                        {/* Locally Grown Switch */}
                        <div className="flex items-center space-x-2">
                          <Switch 
                            id="locallyGrown" 
                            name="locallyGrown"
                            defaultChecked={existingData?.certifications?.locallyGrown}
                            disabled={isPending}
                          />
                          <Label htmlFor="locallyGrown" className="text-xs">Locally Grown (&lt;100km)</Label>
                        </div>
                        {/* Regenerative Agriculture Switch */}
                        <div className="flex items-center space-x-2">
                          <Switch 
                            id="regenerative" 
                            name="regenerative"
                            defaultChecked={existingData?.certifications?.regenerative}
                            disabled={isPending}
                          />
                          <Label htmlFor="regenerative" className="text-xs">Regenerative Agriculture</Label>
                        </div>
                      </div>
                    </CardContent>
                  </motion.div>
                )}
              </AnimatePresence>
            </Card>

            {/* ---------------------- Sustainability Section ---------------------- */}
            <Card className="border-emerald-500/20">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Recycle className="w-4 h-4 text-green-600" />
                    <CardTitle className="text-sm">Sustainability</CardTitle>
                  </div>
                  {/* Collapse/expand button */}
                  <button
                    type="button"
                    onClick={() => setShowSustainability(!showSustainability)}
                    className="text-xs text-emerald-600 hover:underline"
                    aria-controls="sustainability-section"
                    aria-expanded={showSustainability}
                  >
                    {showSustainability ? 'Hide' : 'Show'}
                  </button>
                </div>
                <CardDescription className="text-xs">
                  Packaging, carbon footprint, environmental impact
                </CardDescription>
              </CardHeader>
              
              <AnimatePresence>
                {showSustainability && (
                  <motion.div
                    id="sustainability-section"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                  >
                    <CardContent className="space-y-4">
                      {/* Packaging type */}
                      <div className="space-y-2">
                        <Label htmlFor="packaging" className="text-xs">Packaging Type</Label>
                        <Select name="packaging" defaultValue={existingData?.sustainabilityMetrics?.packaging || 'Mixed'}>
                          <SelectTrigger className="h-9 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Plastic-free">Plastic-free</SelectItem>
                            <SelectItem value="Recyclable">Recyclable</SelectItem>
                            <SelectItem value="Compostable">Compostable (+7% DAAR bonus)</SelectItem>
                            <SelectItem value="Reusable">Reusable (+7% DAAR bonus)</SelectItem>
                            <SelectItem value="Mixed">Mixed</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Carbon Negative and Renewable Energy switches */}
                      <div className="flex flex-wrap gap-4">
                        <div className="flex items-center space-x-2">
                          <Switch 
                            id="carbonNegative" 
                            name="carbonNegative"
                            defaultChecked={existingData?.sustainabilityMetrics?.carbonNegative}
                            disabled={isPending}
                          />
                          <Label htmlFor="carbonNegative" className="text-xs">
                            Carbon Negative (+15% DAAR bonus) 🔥
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Switch 
                            id="renewableEnergy" 
                            name="renewableEnergy"
                            defaultChecked={existingData?.sustainabilityMetrics?.renewableEnergyUsed}
                            disabled={isPending}
                          />
                          <Label htmlFor="renewableEnergy" className="text-xs">
                            Renewable Energy (+4% DAAR bonus)
                          </Label>
                        </div>
                      </div>

                      {/* Carbon & Water usage inputs */}
                      <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="carbonFootprint" className="text-xs">Carbon Footprint (kg CO2/kg)</Label>
                          <Input
                            id="carbonFootprint"
                            name="carbonFootprint"
                            type="number"
                            step="0.01"
                            placeholder="0.50"
                            defaultValue={existingData?.sustainabilityMetrics?.carbonFootprintPerKg}
                            disabled={isPending}
                            className="h-9 text-sm"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="waterUsage" className="text-xs">Water Usage (L/kg)</Label>
                          <Input
                            id="waterUsage"
                            name="waterUsage"
                            type="number"
                            step="0.1"
                            placeholder="15.0"
                            defaultValue={existingData?.sustainabilityMetrics?.waterUsagePerKg}
                            disabled={isPending}
                            className="h-9 text-sm"
                          />
                        </div>
                      </div>
                    </CardContent>
                  </motion.div>
                )}
              </AnimatePresence>
            </Card>

            {/* ---------------------- Freshness Section ---------------------- */}
            <Card className="border-emerald-500/20">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-blue-600" />
                    <CardTitle className="text-sm">Freshness & Storage</CardTitle>
                  </div>
                  {/* Collapse/expand button */}
                  <button
                    type="button"
                    onClick={() => setShowFreshness(!showFreshness)}
                    className="text-xs text-emerald-600 hover:underline"
                    aria-controls="freshness-section"
                    aria-expanded={showFreshness}
                  >
                    {showFreshness ? 'Hide' : 'Show'}
                  </button>
                </div>
                <CardDescription className="text-xs">
                  Shelf life, storage conditions
                </CardDescription>
              </CardHeader>
              
              <AnimatePresence>
                {showFreshness && (
                  <motion.div
                    id="freshness-section"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                  >
                    <CardContent className="space-y-4">
                      {/* Shelf Life & Storage Temp */}
                      <div className="grid md:grid-cols-2 gap-4">
                        {/* Shelf Life in days */}
                        <div className="space-y-2">
                          <Label htmlFor="shelfLifeDays" className="text-xs">Shelf Life (days)</Label>
                          <Input
                            id="shelfLifeDays"
                            name="shelfLifeDays"
                            type="number"
                            placeholder="30"
                            defaultValue={existingData?.freshness?.shelfLifeDays}
                            disabled={isPending}
                            className="h-9 text-sm"
                          />
                        </div>
                        {/* Storage Temperature */}
                        <div className="space-y-2">
                          <Label htmlFor="storageTemp" className="text-xs">Storage Temp (°C)</Label>
                          <Input
                            id="storageTemp"
                            name="storageTemp"
                            type="number"
                            step="0.1"
                            placeholder="4"
                            defaultValue={existingData?.freshness?.storageTemp}
                            disabled={isPending}
                            className="h-9 text-sm"
                          />
                        </div>
                      </div>
                      {/* Storage Instructions (textarea) */}
                      <div className="space-y-2">
                        <Label htmlFor="storageInstructions" className="text-xs">Storage Instructions</Label>
                        <Textarea
                          id="storageInstructions"
                          name="storageInstructions"
                          placeholder="Store in a cool, dry place..."
                          defaultValue={existingData?.freshness?.storageInstructions}
                          disabled={isPending}
                          className="min-h-[60px] text-sm"
                          maxLength={200}
                        />
                      </div>
                      {/* Perishable Switch */}
                      <div className="flex items-center space-x-2">
                        <Switch 
                          id="perishable" 
                          name="perishable"
                          defaultChecked={existingData?.freshness?.perishable ?? true}
                          disabled={isPending}
                        />
                        <Label htmlFor="perishable" className="text-xs">Perishable Product</Label>
                      </div>
                    </CardContent>
                  </motion.div>
                )}
              </AnimatePresence>
            </Card>

            {/* ---------------------- Help Text / AI Enrichment Notice ---------------------- */}
            <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-500/30 rounded-lg p-4">
              <p className="text-xs text-muted-foreground">
                <span className="font-semibold text-emerald-600">💡 AI Enhancement Coming Soon:</span> In Phase 3, 
                your DAGI agent will automatically enrich products with traceability data, calculate carbon footprints, 
                and suggest certifications based on your farming practices.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
