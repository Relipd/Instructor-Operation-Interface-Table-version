import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-[#3370ff] text-white shadow",
        secondary:
          "border-transparent bg-[#f5f6f8] text-[#1f2329]",
        destructive:
          "border-transparent bg-[#ff3b30] text-white shadow",
        outline: "text-[#1f2329]",
        // 飞书风格状态
        pending:
          "border-transparent bg-[#ffeaeb] text-[#ff3b30]",
        processing:
          "border-transparent bg-[#fff4e5] text-[#ff9500]",
        completed:
          "border-transparent bg-[#e8faf0] text-[#34c759]",
        closed:
          "border-transparent bg-[#f5f5f5] text-[#8c8c8c]",
        // 飞书风格风险等级
        p0:
          "border-transparent bg-[#ffeaeb] text-[#ff3b30]",
        p1:
          "border-transparent bg-[#fff4e5] text-[#ff9500]",
        p2:
          "border-transparent bg-[#f5f5f5] text-[#8c8c8c]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
