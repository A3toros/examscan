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
  Legend,
  ResponsiveContainer
} from 'recharts'
import { Card } from '../ui'

interface UserGrowthData {
  date: string
  newUsers: number
  totalUsers: number
}

interface UserGrowthChartProps {
  data: UserGrowthData[]
  period: 'week' | 'month' | 'year'
}

const UserGrowthChart: React.FC<UserGrowthChartProps> = ({ data, period }) => {
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
  if (!data || data.length === 0) {
    return (
      <Card className="p-6">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-gray-900">{t('userGrowth', 'User Growth')}</h3>
          <p className="text-sm text-gray-600">{t('userGrowthDescription', 'Total users and new registrations over time')}</p>
        </div>
        <div className="h-80 flex items-center justify-center bg-gray-50 rounded-lg">
          <div className="text-center">
            <div className="text-4xl mb-4">📊</div>
            <p className="text-gray-500 mb-2">{t('noDataAvailable', 'No data available yet')}</p>
            <p className="text-sm text-gray-400">{t('chartsWillPopulate', 'Charts will populate as users register over time')}</p>
          </div>
        </div>
      </Card>
    )
  }

  return (
    <Card className="p-6">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900">{t('userGrowth', 'User Growth')}</h3>
        <p className="text-sm text-gray-600">
          {data.length === 1
            ? t('userGrowthCurrentDescription', 'Current total users (historical trends will appear as platform grows)')
            : t('userGrowthDescription', 'Total users and new registrations over time')
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
              formatter={(value, name) => [
                value,
                name === 'totalUsers' ? t('totalUsersChart', 'Total Users') : t('newUsers', 'New Users')
              ]}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="totalUsers"
              stroke="#3B82F6"
              strokeWidth={3}
              name={t('totalUsersChart', 'Total Users')}
              dot={{ fill: '#3B82F6', strokeWidth: 2, r: 4 }}
            />
            <Line
              type="monotone"
              dataKey="newUsers"
              stroke="#10B981"
              strokeWidth={2}
              name={t('newUsers', 'New Users')}
              dot={{ fill: '#10B981', strokeWidth: 2, r: 3 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}

export default UserGrowthChart
