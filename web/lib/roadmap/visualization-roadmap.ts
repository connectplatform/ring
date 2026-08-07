import visualizationRoadmap from '@/docs/VISUALIZATION-ROADMAP.json'

export type RoadmapComponentSpec = {
  name: string
  library?: string
  package?: string
  packages?: string[]
  file?: string
  status?: string
  use_cases?: string[]
  estimated_time?: string
  features?: string[]
}

export type RoadmapPhase = {
  timeline: string
  priority: string
  components: RoadmapComponentSpec[]
  total_estimated_time?: string
  success_criteria?: string[]
}

export const VISUALIZATION_ROADMAP = visualizationRoadmap as {
  roadmap_name: string
  version: string
  created: string
  priority: string
  emperor_mandate: string
  phase_1_immediate: RoadmapPhase
  phase_2_enhanced: RoadmapPhase
  phase_3_advanced: RoadmapPhase
  current_components: { implemented: RoadmapComponentSpec[] }
  implementation_order: string[]
  total_effort: Record<string, string>
  success_metrics: Record<string, string>
}

export const ROADMAP_PHASES = [
  { id: 'phase1', key: 'phase_1_immediate' as const, data: VISUALIZATION_ROADMAP.phase_1_immediate },
  { id: 'phase2', key: 'phase_2_enhanced' as const, data: VISUALIZATION_ROADMAP.phase_2_enhanced },
  { id: 'phase3', key: 'phase_3_advanced' as const, data: VISUALIZATION_ROADMAP.phase_3_advanced },
]
