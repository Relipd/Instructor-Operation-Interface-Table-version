import { cn } from '@/lib/utils'
import type { RiskLevel } from '@/types'

interface RiskBadgeProps {
  level: RiskLevel
  className?: string
}

const riskConfig: Record<RiskLevel, { bg: string; text: string; border: string }> = {
  'R3': { bg: 'bg-[#ffeaeb]', text: 'text-[#ff3b30]', border: 'border-[#ff3b30]' },
  'R2': { bg: 'bg-[#fff4e5]', text: 'text-[#ff9500]', border: 'border-[#ff9500]' },
  'R1': { bg: 'bg-[#f5f5f5]', text: 'text-[#8c8c8c]', border: 'border-[#8c8c8c]' },
}

export function RiskBadge({ level, className }: RiskBadgeProps) {
  const config = riskConfig[level]

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold',
        config.bg,
        config.text,
        config.border,
        className
      )}
    >
      {level}
    </span>
  )
}
