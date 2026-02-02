'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Search, Trophy } from 'lucide-react'
import { AchievementCard } from './AchievementCard'
import { apiClient } from '@/lib/api'

interface Achievement {
  achievement_id: string
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

interface AchievementModalProps {
  isOpen: boolean
  onClose: () => void
}

export function AchievementModal({ isOpen, onClose }: AchievementModalProps) {
  const [achievements, setAchievements] = useState<Achievement[]>([])
  const [achievementsByCategory, setAchievementsByCategory] = useState<Record<string, Achievement[]>>({})
  const [stats, setStats] = useState({ total: 0, earned: 0, percentage: 0 })
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')

  useEffect(() => {
    if (isOpen) {
      fetchAchievements()
    }
  }, [isOpen])

  const fetchAchievements = async () => {
    try {
      setLoading(true)
      const response = await apiClient.getAchievements()
      
      if (response.success && response.data) {
        const data = response.data.data || response.data
        setAchievements(data.achievements || [])
        setAchievementsByCategory(data.achievementsByCategory || {})
        setStats(data.stats || { total: 0, earned: 0, percentage: 0 })
      }
    } catch (error) {
      console.error('Failed to load achievements:', error)
    } finally {
      setLoading(false)
    }
  }

  const categories = ['all', ...Object.keys(achievementsByCategory)]
  
  const filteredAchievements = achievements.filter(achievement => {
    const matchesSearch = achievement.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         achievement.description.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCategory = selectedCategory === 'all' || achievement.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  const earnedCount = filteredAchievements.filter(a => a.earned_at).length

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 z-50"
          />
          
          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
              {/* Header */}
              <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Trophy className="w-6 h-6 text-yellow-500" />
                  <div>
                    <h2 className="text-xl font-bold text-slate-800">Achievements</h2>
                    <p className="text-sm text-slate-500">
                      {stats.earned} of {stats.total} earned ({stats.percentage}%)
                    </p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-slate-600" />
                </button>
              </div>

              {/* Search and Filters */}
              <div className="px-6 py-4 border-b border-slate-200 space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search achievements..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                
                <div className="flex gap-2 flex-wrap">
                  {categories.map(category => (
                    <button
                      key={category}
                      onClick={() => setSelectedCategory(category)}
                      className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                        selectedCategory === category
                          ? 'bg-purple-500 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {category.charAt(0).toUpperCase() + category.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto px-6 py-4">
                {loading ? (
                  <div className="text-center py-12">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
                    <p className="mt-4 text-slate-500">Loading achievements...</p>
                  </div>
                ) : filteredAchievements.length === 0 ? (
                  <div className="text-center py-12">
                    <Trophy className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                    <p className="text-slate-500">No achievements found</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {filteredAchievements.map(achievement => (
                      <AchievementCard
                        key={achievement.achievement_id}
                        achievement={achievement}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-slate-200 bg-slate-50">
                <p className="text-sm text-slate-600 text-center">
                  Showing {earnedCount} earned of {filteredAchievements.length} achievements
                </p>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

