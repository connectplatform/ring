import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { Timestamp, FieldValue } from 'firebase/firestore'
import { Opportunity } from '@/types'

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
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

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
 * Fetches opportunities from an API endpoint
 * @param url - The base URL for the API endpoint
 * @param limit - The number of opportunities to fetch
 * @param lastVisible - The ID of the last visible opportunity for pagination
 * @returns An object containing the fetched opportunities and the new lastVisible ID
 */
export const fetchOpportunities = async (
  url: string,
  limit: number,
  lastVisible: string | null
): Promise<{ opportunities: Opportunity[]; lastVisible: string | null }> => {
  const params = new URLSearchParams({ limit: limit.toString() })
  if (lastVisible) {
    params.append('startAfter', lastVisible)
  }

  const response = await fetch(`${url}?${params}`)
  if (!response.ok) {
    throw new Error('Failed to fetch opportunities')
  }
  return await response.json()
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

