'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { Activity } from '@/services/LessonActivityFlow'
import { getActivityIcon, getActivityStatusIcon, getActivityStatusColor } from '@/utils/activityIcons'

interface ActivityListItemProps {
  activity: Activity
  index: number
  isActive: boolean
  isAccessible: boolean
  onClick: () => void
}

const ActivityListItem: React.FC<ActivityListItemProps> = ({
  activity,
  index,
  isActive,
  isAccessible,
  onClick
}) => {
  const activityIcon = getActivityIcon(activity.activityType)
  const statusIcon = getActivityStatusIcon(activity.status, isActive)
  const statusColorClass = getActivityStatusColor(activity.status, isActive)

  return (
    <motion.button
      onClick={onClick}
      disabled={!isAccessible}
      className={`w-full text-left p-3 rounded-lg transition-all duration-200 ${
        isActive
          ? 'bg-primary-100 border-2 border-primary-300 shadow-sm'
          : activity.status === 'completed'
          ? 'bg-green-50 border-2 border-green-200 hover:bg-green-100'
          : isAccessible
          ? 'bg-neutral-50 border-2 border-neutral-200 hover:bg-neutral-100 hover:shadow-sm'
          : 'bg-neutral-50 border-2 border-neutral-200 opacity-60 cursor-not-allowed'
      }`}
      whileHover={isAccessible ? { scale: 1.02 } : {}}
      whileTap={isAccessible ? { scale: 0.98 } : {}}
    >
      <div className="flex items-start space-x-3">
        {/* Status Icon */}
        <div className={`text-lg flex-shrink-0 ${statusColorClass}`}>
          {statusIcon}
        </div>

        {/* Activity Icon */}
        <div className="text-lg flex-shrink-0">
          {activityIcon}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className={`text-sm font-medium truncate ${
            isActive
              ? 'text-primary-700'
              : activity.status === 'completed'
              ? 'text-green-700'
              : 'text-neutral-700'
          }`}>
            {index}. {activity.title || activity.activityType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
          </div>

          {activity.description && (
            <div className="text-xs text-neutral-600 mt-1 line-clamp-2">
              {activity.description}
            </div>
          )}

          {/* Status Badge */}
          {activity.status === 'completed' && (
            <div className="text-xs text-green-600 mt-1 font-medium">
              Completed
            </div>
          )}

          {activity.status === 'in_progress' && (
            <div className="text-xs text-blue-600 mt-1 font-medium">
              In Progress
            </div>
          )}
        </div>
      </div>
    </motion.button>
  )
}

export default ActivityListItem
