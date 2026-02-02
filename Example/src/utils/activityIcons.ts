/**
 * Activity Icon Mapping Utility
 * Maps activity types to appropriate icons for the activity-based lesson system
 */

export const getActivityIcon = (activityType: string): string => {
  const type = activityType.toLowerCase()

  // Warm-up activities
  if (type.includes('warm') || type.includes('warmup') || type.includes('warm_up')) {
    return '🌅'
  }

  // Vocabulary activities
  if (type.includes('vocab') || type.includes('vocabulary')) {
    if (type.includes('intro')) {
      return '📋' // Introduction/Learning
    }
    if (type.includes('matching') || type.includes('match') || type.includes('drag')) {
      return '🎯' // Matching/Targeting
    }
    if (type.includes('fill') || type.includes('blank')) {
      return '📝' // Writing/Filling
    }
    return '📚' // General vocabulary
  }

  // Grammar activities
  if (type.includes('grammar')) {
    if (type.includes('explanation') || type.includes('explain')) {
      return '📖' // Book/Learning
    }
    if (type.includes('sentence') || type.includes('drag') || type.includes('construct')) {
      return '🔤' // Letters/Words
    }
    return '📝' // General grammar
  }

  // Speaking activities
  if (type.includes('speaking') || type.includes('speak') || type.includes('practice')) {
    return '🎤' // Microphone
  }

  // Improvement/Reading activities
  if (type.includes('improvement') || type.includes('improve') || type.includes('reading')) {
    return '✨' // Sparkle/Improvement
  }

  // Listening activities
  if (type.includes('listening') || type.includes('listen')) {
    return '👂' // Ear
  }

  // Default fallback
  return '📝'
}

/**
 * Get activity status icon based on completion state
 */
export const getActivityStatusIcon = (status: 'pending' | 'in_progress' | 'completed', isActive: boolean = false): string => {
  switch (status) {
    case 'completed':
      return '✅'
    case 'in_progress':
      return '▶️'
    case 'pending':
    default:
      return isActive ? '⏳' : '⏸️'
  }
}

/**
 * Get activity status color class for styling
 */
export const getActivityStatusColor = (status: 'pending' | 'in_progress' | 'completed', isActive: boolean = false): string => {
  switch (status) {
    case 'completed':
      return 'text-green-600'
    case 'in_progress':
      return 'text-blue-600'
    case 'pending':
      return isActive ? 'text-primary-600' : 'text-neutral-500'
    default:
      return 'text-neutral-500'
  }
}
