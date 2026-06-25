import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import type { ExceptionRecord } from '@/types'

type RiskAction = 'exclude' | 'confirm'

interface ConfirmActionDialogProps {
  record: ExceptionRecord | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (payload: {
    action: RiskAction
    instructor: string
    reason: string
    measure?: string
    expectedCompletionTime?: string
  }) => void
  instructors?: string[]
}

export function ConfirmActionDialog({
  record,
  open,
  onOpenChange,
  onSubmit,
  instructors = [],
}: ConfirmActionDialogProps) {
  const [action, setAction] = useState<RiskAction | null>(null)
  const [instructor, setInstructor] = useState('')
  const [reason, setReason] = useState('')
  const [measure, setMeasure] = useState('')
  const [expectedTime, setExpectedTime] = useState('')

  useEffect(() => {
    if (open) {
      setAction(null)
      setReason('')
      setMeasure('')
      setExpectedTime('')
      setInstructor(instructors.length > 0 ? instructors[0] : '')
    }
  }, [open, instructors])

  const hasInstructors = instructors.length > 0

  const handleExclude = () => {
    if (!instructor || !reason.trim()) return
    onSubmit({ action: 'exclude', instructor, reason: reason.trim() })
    onOpenChange(false)
  }

  const handleConfirm = () => {
    if (!instructor || !reason.trim() || !measure.trim() || !expectedTime) return
    onSubmit({
      action: 'confirm',
      instructor,
      reason: reason.trim(),
      measure: measure.trim(),
      expectedCompletionTime: expectedTime,
    })
    onOpenChange(false)
  }

  const inputClass = 'h-8 w-full rounded-md border border-[#d0d5dd] bg-white px-3 text-sm text-[#1f2329] placeholder:text-[#bbbfc4] focus:border-[#3370ff] focus:outline-none focus:ring-1 focus:ring-[#3370ff]'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px] flex max-h-[80vh] flex-col gap-0 p-0">
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-[#e5e6eb]">
          <DialogTitle>确认核查</DialogTitle>
          <DialogDescription>
            {record?.exceptionCode || '-'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-5 py-4 pb-8 space-y-4">
          {/* 指导员 */}
          <div className="space-y-1.5">
            <Label className="text-xs text-[#1f2329]">
              指导员 <span className="text-[#ff3b30]">*</span>
              {!hasInstructors && (
                <span className="ml-1 text-xs font-normal text-[#f97316]">
                  部门「{record?.department || '未知'}」无匹配
                </span>
              )}
            </Label>
            {hasInstructors ? (
              <select value={instructor} onChange={(e) => setInstructor(e.target.value)} className={inputClass}>
                {instructors.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            ) : (
              <div className="h-8 w-full rounded-md border border-[#ffccc7] bg-[#fff2f0] px-3 text-sm text-[#cf1322] flex items-center">
                无可用指导员
              </div>
            )}
          </div>

          {/* 处置方式选择 */}
          {action === null && (
            <div className="flex items-center gap-4">
              <Label className="text-xs text-[#1f2329] whitespace-nowrap">处置方式 <span className="text-[#ff3b30]">*</span></Label>
              <label className="flex items-center gap-1.5 cursor-pointer text-sm text-[#1f2329]">
                <span className="inline-block h-4 w-4 rounded-full border border-[#d0d5dd] bg-white" />
                <button onClick={() => setAction('exclude')} className="text-sm text-[#1f2329]">排除风险</button>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer text-sm text-[#1f2329]">
                <span className="inline-block h-4 w-4 rounded-full border border-[#d0d5dd] bg-white" />
                <button onClick={() => setAction('confirm')} className="text-sm text-[#1f2329]">确存风险</button>
              </label>
            </div>
          )}

          {/* 排除风险分支 */}
          {action === 'exclude' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-[#1f2329]">排除风险</span>
                <button onClick={() => setAction(null)} className="text-xs text-[#3370ff] hover:underline">返回</button>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-[#1f2329]">排除理由 <span className="text-[#ff3b30]">*</span></Label>
                <Textarea
                  placeholder="填写排除风险理由"
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </div>
              <Button onClick={handleExclude} disabled={!instructor || !reason.trim()} className="w-full">
                确认排除风险
              </Button>
            </div>
          )}

          {/* 确存风险分支 */}
          {action === 'confirm' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-[#1f2329]">确存风险</span>
                <button onClick={() => setAction(null)} className="text-xs text-[#3370ff] hover:underline">返回</button>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-[#1f2329]">风险根因 <span className="text-[#ff3b30]">*</span></Label>
                <Textarea
                  placeholder="填写风险根因"
                  rows={2}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-[#1f2329]">整改措施 <span className="text-[#ff3b30]">*</span></Label>
                <Textarea
                  placeholder="填写整改措施"
                  rows={2}
                  value={measure}
                  onChange={(e) => setMeasure(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-3">
                <Label className="text-xs text-[#1f2329] whitespace-nowrap">预计完成时间 <span className="text-[#ff3b30]">*</span></Label>
                <input
                  type="date"
                  value={expectedTime}
                  onChange={(e) => setExpectedTime(e.target.value)}
                  className="h-8 flex-1 rounded-md border border-[#d0d5dd] bg-white px-3 text-sm text-[#1f2329] focus:border-[#3370ff] focus:outline-none focus:ring-1 focus:ring-[#3370ff]"
                />
              </div>
              <Button onClick={handleConfirm} disabled={!instructor || !reason.trim() || !measure.trim() || !expectedTime} className="w-full">
                确存风险
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
