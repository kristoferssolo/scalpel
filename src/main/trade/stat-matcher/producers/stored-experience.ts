import type { StatFilter } from '../../trade'

// Facetor's Lens stored experience
export function buildStoredExperienceFilters(storedExperience: number | null | undefined): StatFilter[] {
  if (storedExperience == null) return []
  const expStr = storedExperience.toLocaleString()
  return [
    {
      id: 'misc.stored_experience',
      text: `Stored Experience: ${expStr}`,
      value: storedExperience,
      min: storedExperience,
      max: null,
      enabled: true,
      type: 'currency',
    },
  ]
}
