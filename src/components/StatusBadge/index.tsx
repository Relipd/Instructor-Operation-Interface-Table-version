import { cn } from '@/lib/utils'
import type { ExceptionStatus } from '@/types'

interface StatusBadgeProps {
  status: ExceptionStatus
  className?: string
}

const statusConfig: Record<ExceptionStatus, { bg: string; text: string; dot: string }> = {
  '待处理': { bg: 'bg-[#ffeaeb]', text: 'text-[#ff3b30]', dot: 'bg-[#ff3b30]' },
  '整改中': { bg: 'bg-[#fff4e5]', text: 'text-[#ff9500]', dot: 'bg-[#ff9500]' },
  '已完结': { bg: 'bg-[#e8faf0]', text: 'text-[#34c759]', dot: 'bg-[#34c759]' },
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status]

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap',
        config.bg,
        config.text,
        className
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', config.dot)} />
      {status}
    </span>
  )
}
