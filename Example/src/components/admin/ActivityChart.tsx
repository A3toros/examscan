'use client'

import React from 'react'
import { useTranslation } from 'react-i18next'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts'
import { Card } from '../ui'

interface ActivityData {
  date: string
  activeUsers: number
}

interface ActivityChartProps {
  data: ActivityData[]
  period: 'week' | 'month' | 'year'
}

const ActivityChart: React.FC<ActivityChartProps> = ({ data, period }) => {
  const { t } = useTranslation('admin')
  
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    switch (period) {
      case 'week':
      case 'month':
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      case 'year':
        return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' })
      default:
        return dateStr
    }
  }

  // Always show data if we have at least 1 data point (current state)

  return (
    <Card className="p-6">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900">{t('userActivity', 'User Activity')}</h3>
        <p className="text-sm text-gray-600">
          {data.length === 1
            ? t('userActivityCurrentDescription', 'Current daily active users (historical trends will appear as platform grows)')
            : t('userActivityDescription', 'Daily active users over time')
          }
        </p>
      </div>

      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis
              dataKey="date"
              tickFormatter={formatDate}
              fontSize={12}
              className="text-gray-600"
            />
            <YAxis
              fontSize={12}
              className="text-gray-600"
            />
            <Tooltip
              labelFormatter={(value) => `${t('date', 'Date')}: ${formatDate(value)}`}
              formatter={(value) => [value, t('activeUsers', 'Active Users')]}
            />
            <Line
              type="monotone"
              dataKey="activeUsers"
              stroke="#F59E0B"
              strokeWidth={3}
              name={t('activeUsers', 'Active Users')}
              dot={{ fill: '#F59E0B', strokeWidth: 2, r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}

export default ActivityChart
