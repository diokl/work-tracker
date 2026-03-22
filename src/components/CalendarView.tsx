'use client'

import { DaySummary, STATUS_COLORS } from '@/lib/types'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface CalendarViewProps {
  year: number
  month: number
  summaries: DaySummary[]
  selectedDate: string | null
  onDateSelect: (date: string) => void
  onMonthChange: (year: number, month: number) => void
}

const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']
const MONTH_LABELS = [
  '1월', '2월', '3월', '4월', '5월', '6월',
  '7월', '8월', '9월', '10월', '11월', '12월'
]

export default function CalendarView({
  year,
  month,
  summaries,
  selectedDate,
  onDateSelect,
  onMonthChange,
}: CalendarViewProps) {
  const today = new Date()
  const todayString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  // Get first day of month and number of days
  const firstDay = new Date(year, month - 1, 1).getDay()
  const daysInMonth = new Date(year, month, 0).getDate()
  // Create calendar days array
  const calendarDays: (number | null)[] = []

  // Previous month days
  for (let i = firstDay - 1; i >= 0; i--) {
    calendarDays.push(null)
  }

  // Current month days
  for (let i = 1; i <= daysInMonth; i++) {
    calendarDays.push(i)
  }

  // Next month days to fill grid
  const remainingDays = 42 - calendarDays.length
  for (let i = 1; i <= remainingDays; i++) {
    calendarDays.push(null)
  }

  const handlePrevMonth = () => {
    if (month === 1) {
      onMonthChange(year - 1, 12)
    } else {
      onMonthChange(year, month - 1)
    }
  }

  const handleNextMonth = () => {
    if (month === 12) {
      onMonthChange(year + 1, 1)
    } else {
      onMonthChange(year, month + 1)
    }
  }

  const handleToday = () => {
    const today = new Date()
    onMonthChange(today.getFullYear(), today.getMonth() + 1)
    onDateSelect(todayString)
  }

  const getSummaryForDate = (day: number) => {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    return summaries.find(s => s.date === dateStr)
  }

  const renderTaskDots = (summary: DaySummary | undefined) => {
    if (!summary || summary.total === 0) return null

    return (
      <div className="flex gap-1 mt-1">
        {summary.completed > 0 && (
          <div
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: STATUS_COLORS.completed }}
            title={`완료: ${summary.completed}`}
          />
        )}
        {summary.in_progress > 0 && (
          <div
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: STATUS_COLORS.in_progress }}
            title={`진행중: ${summary.in_progress}`}
          />
        )}
        {summary.waiting_next > 0 && (
          <div
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: STATUS_COLORS.waiting_next }}
            title={`대기: ${summary.waiting_next}`}
          />
        )}
        {summary.pending > 0 && (
          <div
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: STATUS_COLORS.pending }}
            title={`대기중: ${summary.pending}`}
          />
        )}
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-800 border-b border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <button
              onClick={handlePrevMonth}
              className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
              aria-label="이전 달"
            >
              <ChevronLeft className="w-5 h-5 text-gray-700 dark:text-gray-300" />
            </button>

            <div className="min-w-48 text-center">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                {year}년 {MONTH_LABELS[month - 1]}
              </h2>
            </div>

            <button
              onClick={handleNextMonth}
              className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
              aria-label="다음 달"
            >
              <ChevronRight className="w-5 h-5 text-gray-700 dark:text-gray-300" />
            </button>
          </div>

          <button
            onClick={handleToday}
            className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-medium rounded-lg transition-colors text-sm"
          >
            오늘
          </button>
        </div>
      </div>

      {/* Weekday Headers */}
      <div className="grid grid-cols-7 gap-0 border-b border-gray-200 dark:border-gray-800">
        {WEEKDAY_LABELS.map((day, idx) => (
          <div
            key={day}
            className={`py-3 text-center text-sm font-semibold border-r border-gray-200 dark:border-gray-800 last:border-r-0 ${
              idx === 0 ? 'text-red-500 dark:text-red-400' : idx === 6 ? 'text-blue-500 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'
            }`}
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Days Grid */}
      <div className="grid grid-cols-7 gap-0 divide-x divide-y divide-gray-200 dark:divide-gray-800">
        {calendarDays.map((day, idx) => {
          const isCurrentMonth = day !== null
          const dateStr = isCurrentMonth
            ? `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
            : ''
          const isToday = dateStr === todayString
          const isSelected = dateStr === selectedDate
          const summary = isCurrentMonth ? getSummaryForDate(day) : undefined
          const dayOfWeek = idx % 7

          return (
            <div
              key={`${idx}`}
              onClick={() => {
                if (isCurrentMonth && day !== null) {
                  onDateSelect(dateStr)
                }
              }}
              className={`aspect-square p-2 sm:p-3 cursor-pointer transition-all ${
                isCurrentMonth
                  ? 'hover:bg-gray-50 dark:hover:bg-gray-800'
                  : 'bg-gray-50 dark:bg-gray-800 cursor-default'
              } ${
                isSelected
                  ? 'bg-red-500 text-white dark:bg-red-600'
                  : isToday
                  ? 'ring-2 ring-red-500 dark:ring-red-400 bg-red-50 dark:bg-red-950'
                  : ''
              }`}
            >
              <div className="h-full flex flex-col">
                <div
                  className={`text-sm sm:text-base font-semibold mb-0.5 ${
                    !isCurrentMonth
                      ? 'text-gray-400 dark:text-gray-600'
                      : isSelected
                      ? 'text-white'
                      : dayOfWeek === 0
                      ? 'text-red-600 dark:text-red-400'
                      : dayOfWeek === 6
                      ? 'text-blue-600 dark:text-blue-400'
                      : 'text-gray-900 dark:text-gray-100'
                  }`}
                >
                  {day}
                </div>

                {isCurrentMonth && summary && summary.total > 0 && (
                  <>
                    <div
                      className={`text-xs font-medium mb-1 ${
                        isSelected
                          ? 'text-red-100'
                          : 'text-gray-600 dark:text-gray-400'
                      }`}
                    >
                      {summary.total}개
                    </div>
                    <div
                      className={isSelected ? 'text-white' : ''}
                    >
                      {renderTaskDots(summary)}
                    </div>
                  </>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
