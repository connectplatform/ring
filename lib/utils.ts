import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { Timestamp, FieldValue } from 'firebase/firestore'
import { Opportunity } from '@/types'
import { UtilityError, FetchError, ValidationError, logRingError } from '@/lib/errors'

/**
 * Combines multiple class names using clsx and tailwind-merge
 * @param inputs - Class names to be combined
 * @returns Combined and optimized class name string
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Truncates text to a specified maximum length
 * @param text - The text to truncate
 * @param maxLength - The maximum length of the truncated text
 * @returns Truncated text with ellipsis if necessary
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength) + '...'
}

/**
 * Generates a URL-friendly slug from a given text
 * @param text - The text to convert into a slug
 * @returns A lowercase, hyphenated slug
 */
export function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w ]+/g, '')
    .replace(/ +/g, '-')
}

/**
 * Creates a debounced version of a function
 * @param func - The function to debounce
 * @param wait - The number of milliseconds to delay
 * @returns A debounced version of the input function
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}

/**
 * Extracts initials from a given name
 * @param name - The full name to extract initials from
 * @returns A string containing up to two uppercase initials
 */
export function getInitials(name: string): string {
  return name
    .split(' ')
    .map(word => word.at(0) ?? '')
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

// ====================
// ES2022 Object.hasOwn() Implementation
// Safe property checking utilities to replace hasOwnProperty
// ====================

/**
 * ES2022 Object.hasOwn() - Safe property checking
 * Validates that an object has its own property (not inherited)
 * @param obj - The object to check
 * @param property - The property name to check for
 * @returns True if the object has the own property, false otherwise
 */
export function hasOwnProperty<T extends object>(obj: T, property: PropertyKey): boolean {
  if (!obj || typeof obj !== 'object') {
    return false
  }
  return Object.hasOwn(obj, property)
}

/**
 * Validates that an object contains all required fields using Object.hasOwn()
 * @param data - The object to validate
 * @param requiredFields - Array of required field names
 * @returns True if all required fields exist, false otherwise
 */
export function validateRequiredFields<T extends Record<string, any>>(
  data: T, 
  requiredFields: (keyof T)[]
): boolean {
  if (!data || typeof data !== 'object') {
    return false
  }
  return requiredFields.every(field => Object.hasOwn(data, field) && data[field] !== null && data[field] !== undefined)
}

/**
 * Safely extracts properties from an object using Object.hasOwn()
 * @param source - The source object
 * @param properties - Array of property names to extract
 * @returns New object with only the specified properties (if they exist)
 */
export function extractProperties<T extends Record<string, any>, K extends keyof T>(
  source: T,
  properties: K[]
): Partial<Pick<T, K>> {
  if (!source || typeof source !== 'object') {
    return {}
  }
  
  const result: Partial<Pick<T, K>> = {}
  
  for (const property of properties) {
    if (Object.hasOwn(source, property)) {
      result[property] = source[property]
    }
  }
  
  return result
}

/**
 * Filters an object's properties based on a predicate using Object.hasOwn()
 * @param obj - The object to filter
 * @param predicate - Function to test each property
 * @returns New object with filtered properties
 */
export function filterObjectProperties<T extends Record<string, any>>(
  obj: T,
  predicate: (key: string, value: any) => boolean
): Partial<T> {
  if (!obj || typeof obj !== 'object') {
    return {}
  }
  
  const result: Partial<T> = {}
  
  for (const key in obj) {
    if (Object.hasOwn(obj, key) && predicate(key, obj[key])) {
      result[key as keyof T] = obj[key]
    }
  }
  
  return result
}

/**
 * Safely merges objects ensuring no prototype pollution using Object.hasOwn()
 * @param target - The target object to merge into
 * @param sources - Source objects to merge from
 * @returns New merged object
 */
export function safeMergeObjects<T extends Record<string, any>>(
  target: T,
  ...sources: Partial<T>[]
): T {
  const result = { ...target }
  
  for (const source of sources) {
    if (source && typeof source === 'object') {
      for (const key in source) {
        if (Object.hasOwn(source, key) && source[key] !== undefined) {
          result[key] = source[key]
        }
      }
    }
  }
  
  return result
}

/**
 * Validates entity data using Object.hasOwn() for safe property checking
 * @param data - The entity data to validate
 * @returns True if entity data is valid, false otherwise
 */
export function validateEntityData(data: any): boolean {
  if (!data || typeof data !== 'object') {
    return false
  }
  
  const requiredFields = ['name', 'type', 'description'] as const
  return requiredFields.every(field => Object.hasOwn(data, field) && 
    typeof data[field] === 'string' && 
    data[field].trim().length > 0
  )
}

/**
 * Validates opportunity data using Object.hasOwn() for safe property checking
 * @param data - The opportunity data to validate  
 * @returns True if opportunity data is valid, false otherwise
 */
export function validateOpportunityData(data: any): boolean {
  if (!data || typeof data !== 'object') {
    return false
  }
  
  const requiredFields = ['title', 'briefDescription', 'budget', 'expirationDate'] as const
  const hasAllRequired = requiredFields.every(field => Object.hasOwn(data, field))
  
  if (!hasAllRequired) {
    return false
  }
  
  // Additional validation for nested objects
  if (Object.hasOwn(data, 'budget') && data.budget && typeof data.budget === 'object') {
    const budgetFields = ['min', 'max', 'currency'] as const
    return budgetFields.every(field => Object.hasOwn(data.budget, field))
  }
  
  return true
}

// ====================
// End ES2022 Object.hasOwn() Implementation  
// ====================

/**
 * Formats a Timestamp or FieldValue into a localized date string
 * @param timestamp - The Timestamp or FieldValue to format
 * @returns A formatted date string, or 'N/A' if the input is invalid
 */
export const formatDate = (timestamp: Timestamp | FieldValue): string => {
  if (timestamp instanceof Timestamp) {
    return new Date(timestamp.seconds * 1000).toLocaleDateString()
  } else {
    // Handle FieldValue or invalid input
    return 'N/A'
  }
}

/**
 * Formats a budget object into a string representation
 * @param budget - The budget object containing min, max, and currency
 * @returns A formatted string representing the budget range
 */
export const formatBudget = (budget: { min: number; max: number; currency: string }): string => {
  return `${budget.currency} ${budget.min} - ${budget.max}`
}

/**
 * Truncates a description to a specified length
 * @param description - The full description text
 * @param maxLength - The maximum length of the truncated description (default: 100)
 * @returns A truncated description with ellipsis if necessary
 */
export const truncateDescription = (description: string, maxLength: number = 100): string => {
  return description.length > maxLength ? `${description.slice(0, maxLength)}...` : description
}

/**
 * Fetches opportunities from an API endpoint with enhanced error handling
 * @param url - The base URL for the API endpoint
 * @param limit - The number of opportunities to fetch
 * @param lastVisible - The ID of the last visible opportunity for pagination
 * @returns An object containing the fetched opportunities and the new lastVisible ID
 * @throws {FetchError} If the HTTP request fails
 * @throws {ValidationError} If the response data is invalid
 */
export const fetchOpportunities = async (
  url: string,
  limit: number,
  lastVisible: string | null
): Promise<{ opportunities: Opportunity[]; lastVisible: string | null }> => {
  const context = {
    timestamp: Date.now(),
    url,
    limit,
    lastVisible,
    operation: 'fetchOpportunities'
  };

  try {
    const params = new URLSearchParams({ limit: limit.toString() })
    if (lastVisible) {
      params.append('startAfter', lastVisible)
    }

    const response = await fetch(`${url}?${params}`)
    
    if (!response.ok) {
      throw new FetchError(
        `Failed to fetch opportunities: ${response.status} ${response.statusText}`,
        new Error(`HTTP ${response.status}: ${response.statusText}`),
        {
          ...context,
          statusCode: response.status,
          statusText: response.statusText,
          responseHeaders: Object.fromEntries(response.headers.entries())
        }
      );
    }

    let data;
    try {
      data = await response.json();
    } catch (error) {
      throw new FetchError(
        'Failed to parse response as JSON',
        error instanceof Error ? error : new Error(String(error)),
        {
          ...context,
          statusCode: response.status,
          contentType: response.headers.get('content-type')
        }
      );
    }

    // Validate response structure
    if (!data || typeof data !== 'object' || !Array.isArray(data.opportunities)) {
      throw new ValidationError(
        'Invalid response format: expected object with opportunities array',
        undefined,
        {
          ...context,
          receivedData: data,
          dataType: typeof data
        }
      );
    }

    return data;
  } catch (error) {
    // Enhanced error logging with cause information using centralized logger
    logRingError(error, 'fetchOpportunities error');
    
    if (error instanceof FetchError || error instanceof ValidationError) {
      throw error;
    }
    
    // Wrap unknown errors
    throw new FetchError(
      'Unknown error occurred while fetching opportunities',
      error instanceof Error ? error : new Error(String(error)),
      context
    );
  }
}

/**
 * Helper function to format a Timestamp or FieldValue as a date string
 * @param value - The Timestamp or FieldValue to format
 * @returns A formatted date string or 'N/A' if the value is invalid
 * 
 * User steps:
 * 1. Import this function in your component file
 * 2. Use this function to format Timestamp or FieldValue date fields
 * 
 * Example usage:
 * const formattedDate = formatTimestampOrFieldValue(opportunity.dateCreated)
 */
export function formatTimestampOrFieldValue(value: Timestamp | FieldValue): string {
  if (value instanceof Timestamp) {
    return formatDate(value)
  }
  // Handle FieldValue or return a default value
  return 'N/A'
}

