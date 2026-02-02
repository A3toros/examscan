'use client'

import React from 'react'
import { motion } from 'framer-motion'

interface AchievementCardProps {
  achievement: {
    code: string
    name: string
    description: string
    icon: string
    category: string
    rarity: string
    points: number
    earned_at?: string | null
    current_progress?: number
    target_progress?: number
    progress_percentage?: number
  }
  onClick?: () => void
}

export function AchievementCard({ achievement, onClick }: AchievementCardProps) {
  const isEarned = !!achievement.earned_at
  const progress = achievement.progress_percentage || 0

  const rarityColors: Record<string, string> = {
    common: 'border-slate-300 bg-slate-50',
    rare: 'border-blue-300 bg-blue-50',
    epic: 'border-purple-300 bg-purple-50',
    legendary: 'border-yellow-400 bg-yellow-50'
  }

  const rarityColor = rarityColors[achievement.rarity] || rarityColors.common

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={`
        relative p-4 rounded-lg border-2 cursor-pointer transition-all
        ${isEarned ? `${rarityColor} shadow-md` : 'border-slate-200 bg-white opacity-60'}
      `}
    >
      {isEarned && (
        <div className="absolute top-2 right-2">
          <span className="text-yellow-500 text-xl">✓</span>
        </div>
      )}
      
      <div className="flex items-start gap-3">
        <div className="text-4xl">{achievement.icon}</div>
        <div className="flex-1 min-w-0">
          <h3 className={`font-semibold text-sm ${isEarned ? 'text-slate-800' : 'text-slate-500'}`}>
            {achievement.name}
          </h3>
          <p className="text-xs text-slate-600 mt-1 line-clamp-2">
            {achievement.description}
          </p>
          
          {!isEarned && achievement.target_progress && achievement.target_progress > 0 && (
            <div className="mt-2">
              <div className="flex justify-between text-xs text-slate-500 mb-1">
                <span>Progress</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-1.5">
                <div
                  className="bg-purple-500 h-1.5 rounded-full transition-all"
                  style={{ width: `${Math.min(progress, 100)}%` }}
                />
              </div>
            </div>
          )}
          
          <div className="flex items-center gap-2 mt-2">
            <span className={`text-xs px-2 py-0.5 rounded ${
              achievement.rarity === 'legendary' ? 'bg-yellow-100 text-yellow-800' :
              achievement.rarity === 'epic' ? 'bg-purple-100 text-purple-800' :
              achievement.rarity === 'rare' ? 'bg-blue-100 text-blue-800' :
              'bg-slate-100 text-slate-800'
            }`}>
              {achievement.rarity}
            </span>
            <span className="text-xs text-slate-500">{achievement.points} pts</span>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

