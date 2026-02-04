/**
 * Calculate estimated reading time for text content
 * Based on average reading speed of 200-250 words per minute
 */

export function calculateReadingTime(text: string, wordsPerMinute: number = 200): {
  minutes: number
  text: string
} {
  // Remove HTML tags and extra whitespace
  const cleanText = text
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/\s+/g, ' ') // Replace multiple whitespace with single space
    .trim()

  // Count words
  const wordCount = cleanText.split(' ').length

  // Calculate reading time
  const minutes = Math.ceil(wordCount / wordsPerMinute)

  // Format the display text
  const textParts = []
  if (minutes < 1) {
    textParts.push('< 1 min read')
  } else if (minutes === 1) {
    textParts.push('1 min read')
  } else {
    textParts.push(`${minutes} min read`)
  }

  return {
    minutes,
    text: textParts.join('')
  }
}

/**
 * Calculate reading time for HTML content with images
 */
export function calculateReadingTimeWithImages(htmlContent: string, wordsPerMinute: number = 200): {
  minutes: number
  text: string
} {
  // Count images (add 12 seconds per image)
  const imageCount = (htmlContent.match(/<img[^>]*>/g) || []).length
  const imageTime = (imageCount * 12) / 60 // Convert seconds to minutes

  // Get text reading time
  const textReadingTime = calculateReadingTime(htmlContent, wordsPerMinute)

  // Add image time
  const totalMinutes = Math.ceil(textReadingTime.minutes + imageTime)

  return {
    minutes: totalMinutes,
    text: totalMinutes === 1 ? '1 min read' : `${totalMinutes} min read`
  }
}
