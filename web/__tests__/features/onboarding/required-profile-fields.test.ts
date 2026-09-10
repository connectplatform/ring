import {
  isProfileFieldSatisfied,
  resolveRequiredProfileFields,
} from '@/features/onboarding/required-fields'

describe('resolveRequiredProfileFields', () => {
  it('treats omitted / empty / junk as optional (no segments)', () => {
    expect(resolveRequiredProfileFields(undefined)).toEqual([])
    expect(resolveRequiredProfileFields(null)).toEqual([])
    expect(resolveRequiredProfileFields([])).toEqual([])
    expect(resolveRequiredProfileFields(['dob', 'birthDate', 1, {}])).toEqual([])
  })

  it('keeps only unique known onboarding segment ids', () => {
    expect(resolveRequiredProfileFields(['date-of-birth', 'unknown', 'date-of-birth'])).toEqual([
      'date-of-birth',
    ])
  })
})

describe('isProfileFieldSatisfied', () => {
  it('requires a valid ISO birthDate for date-of-birth', () => {
    expect(isProfileFieldSatisfied('date-of-birth', {})).toBe(false)
    expect(isProfileFieldSatisfied('date-of-birth', { birthDate: 'not-a-date' })).toBe(false)
    expect(isProfileFieldSatisfied('date-of-birth', { birthDate: '1990-06-15' })).toBe(true)
  })
})
