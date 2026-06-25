import { AlertTriangle, Clock, CheckCircle, XCircle } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { ExceptionRecord } from '@/types'

interface StatsCardsProps {
  records: ExceptionRecord[]
  onStatusClick?: (status: string) => void
  activeStatus?: string
}

interface StatCard {
  label: string
  value: number
  icon: React.ReactNode
  color: string
  bgColor: string
  status: string
}

export function StatsCards({ records, onStatusClick, activeStatus }: StatsCardsProps) {
  const stats: StatCard[] = [
    {
      label: '待处理',
      value: records.filter((r) => r.status === '待处理').length,
      icon: <AlertTriangle className="h-4 w-4" />,
      color: 'text-[#ff3b30]',
      bgColor: 'bg-[#ffeaeb]',
      status: '待处理',
    },
    {
      label: '整改中',
      value: records.filter((r) => r.status === '整改中').length,
      icon: <Clock className="h-4 w-4" />,
      color: 'text-[#ff9500]',
      bgColor: 'bg-[#fff4e5]',
      status: '整改中',
    },
    {
      label: '已完结',
      value: records.filter((r) => r.status === '已完结').length,
      icon: <CheckCircle className="h-4 w-4" />,
      color: 'text-[#34c759]',
      bgColor: 'bg-[#e8faf0]',
      status: '已完结',
    },
    {
      label: '已超时',
      value: records.filter((r) => r.isTimeout).length,
      icon: <XCircle className="h-4 w-4" />,
      color: 'text-[#8c8c8c]',
      bgColor: 'bg-[#f5f5f5]',
      status: '已超时',
    },
  ]

  return (
    <div className="grid grid-cols-4 gap-3">
      {stats.map((stat) => (
        <Card
          key={stat.status}
          className={cn(
            'cursor-pointer transition-all hover:shadow-md',
            activeStatus === stat.status && 'ring-2 ring-[#3370ff] ring-offset-2'
          )}
          onClick={() => onStatusClick?.(stat.status === activeStatus ? '全部' : stat.status)}
        >
          <CardContent className="flex items-center gap-2 p-2.5">
            <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', stat.bgColor)}>
              <div className={stat.color}>{stat.icon}</div>
            </div>
            <div className="flex items-baseline gap-2 min-w-0">
              <span className="text-sm text-[#646a73] truncate">{stat.label}</span>
              <span className={cn('text-xl font-semibold', stat.color)}>{stat.value}</span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
