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
import { Input } from '@/components/ui/input'
import type { ExceptionRecord } from '@/types'

interface FeedbackDialogProps {
  record: ExceptionRecord | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (recordId: string, feedback: string, handler: string) => void
  instructors?: string[]
}

function buildFeedbackText(fields: {
  assetLoss: boolean
  solution: string
  completionTime: string
  responsibleExists: boolean
  responsiblePerson: string
}): string {
  const responsible = fields.responsibleExists
    ? `是否存在违规人员：是，${fields.responsiblePerson.trim()}`
    : '是否存在违规人员：否'
  return [
    `是否涉及资金损失：${fields.assetLoss ? '是' : '否'}`,
    `已整改方案：${fields.solution.trim()}`,
    `整改完成时间：${fields.completionTime}`,
    responsible,
  ].join('\n')
}

function isFormComplete(fields: {
  assetLoss: boolean | null
  solution: string
  completionTime: string
  responsibleExists: boolean | null
  responsiblePerson: string
}): boolean {
  if (!fields.solution.trim() || !fields.completionTime) return false
  if (fields.assetLoss === null) return false
  if (fields.responsibleExists === null) return false
  if (fields.responsibleExists && !fields.responsiblePerson.trim()) return false
  return true
}

export function FeedbackDialog({
  record,
  open,
  onOpenChange,
  onSubmit,
  instructors: _instructors = [],
}: FeedbackDialogProps) {
  const [assetLoss, setAssetLoss] = useState<boolean | null>(null)
  const [solution, setSolution] = useState('')
  const [completionTime, setCompletionTime] = useState('')
  const [responsibleExists, setResponsibleExists] = useState<boolean | null>(null)
  const [responsiblePerson, setResponsiblePerson] = useState('')

  useEffect(() => {
    if (open && record) {
      setAssetLoss(null)
      setSolution('')
      setCompletionTime('')
      setResponsibleExists(null)
      setResponsiblePerson('')
    }
  }, [open, record])

  const canSubmit = isFormComplete({ assetLoss, solution, completionTime, responsibleExists, responsiblePerson })

  const handleSubmit = () => {
    if (!record || !canSubmit) return
    const feedback = buildFeedbackText({ assetLoss: assetLoss!, solution, completionTime, responsibleExists: responsibleExists!, responsiblePerson })
    onSubmit(record.id, feedback, responsibleExists ? responsiblePerson.trim() : (record.handler || ''))
    setAssetLoss(null); setSolution(''); setCompletionTime(''); setResponsibleExists(null); setResponsiblePerson('')
    onOpenChange(false)
  }

  const parseMergedFeedback = (text: string) => {
    const extract = (key: string) => {
      for (const line of text.split('\n')) {
        if (line.startsWith(`${key}：`) || line.startsWith(`${key}:`))
          return line.replace(new RegExp(`^${key}[：:]`), '').trim()
      }
      return ''
    }
    return {
      rootCause: extract('风险根因'),
      measure: extract('整改措施'),
    }
  }

  const { rootCause, measure } = parseMergedFeedback(record?.feedback || '')

  const inputClass = 'h-8 w-full rounded-md border border-[#d0d5dd] bg-white px-3 text-sm text-[#1f2329] placeholder:text-[#bbbfc4] focus:border-[#3370ff] focus:outline-none focus:ring-1 focus:ring-[#3370ff]'
  const requiredStar = <span className="text-[#ff3b30]">*</span>

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px] flex max-h-[85vh] flex-col gap-0 p-0">
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-[#e5e6eb]">
          <DialogTitle>整改反馈</DialogTitle>
          <DialogDescription>填写整改情况，确认后提交完结</DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-5 py-4 pb-8 space-y-4">
          {/* 展示区 */}
          <div className="space-y-2 rounded-lg bg-[#f5f6f8] p-3 text-xs">
            <div><span className="text-[#8f959e]">审阅异常编码：</span><span className="text-[#1f2329]">{record?.exceptionCode || '-'}</span></div>
            <div><span className="text-[#8f959e]">异常类型：</span><span className="text-[#1f2329]">{record?.exceptionType || '-'}</span></div>
            {rootCause && <div><span className="text-[#8f959e]">风险根因：</span><span className="text-[#1f2329]">{rootCause}</span></div>}
            {measure && <div><span className="text-[#8f959e]">整改措施：</span><span className="text-[#1f2329]">{measure}</span></div>}
            {record?.expectedCompletionTime && (
              <div><span className="text-[#8f959e]">预计整改完成时间：</span><span className="text-[#1f2329]">{record.expectedCompletionTime}</span></div>
            )}
          </div>

          {/* 表单 */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Label className="text-xs text-[#1f2329] whitespace-nowrap">是否涉及资金损失 {requiredStar}</Label>
              <label className="flex items-center gap-1.5 cursor-pointer text-sm text-[#1f2329]">
                <span className={`inline-block h-4 w-4 rounded-full border ${assetLoss === true ? 'border-[#3370ff] bg-[#3370ff]' : 'border-[#d0d5dd] bg-white'}`} />
                <button onClick={() => setAssetLoss(true)} className="text-sm text-[#1f2329]">是</button>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer text-sm text-[#1f2329]">
                <span className={`inline-block h-4 w-4 rounded-full border ${assetLoss === false ? 'border-[#3370ff] bg-[#3370ff]' : 'border-[#d0d5dd] bg-white'}`} />
                <button onClick={() => setAssetLoss(false)} className="text-sm text-[#1f2329]">否</button>
              </label>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-[#1f2329]">已整改方案 {requiredStar}</Label>
              <Textarea
                placeholder="描述已执行的整改方案…如有风险根因更新请在此补充"
                rows={3}
                value={solution}
                onChange={(e) => setSolution(e.target.value)}
                className="text-xs leading-relaxed resize-none"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-[#1f2329]">整改完成时间 {requiredStar}</Label>
              <input
                type="date"
                value={completionTime}
                onChange={(e) => setCompletionTime(e.target.value)}
                className="h-8 w-[180px] rounded-md border border-[#d0d5dd] bg-white px-3 text-sm text-[#1f2329] placeholder:text-[#bbbfc4] focus:border-[#3370ff] focus:outline-none focus:ring-1 focus:ring-[#3370ff]"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center gap-3">
                <Label className="text-xs text-[#1f2329] whitespace-nowrap">是否存在违规人员 {requiredStar}</Label>
                <label className="flex items-center gap-1.5 cursor-pointer text-sm text-[#1f2329] whitespace-nowrap">
                  <span className={`inline-block h-4 w-4 rounded-full border ${responsibleExists === true ? 'border-[#3370ff] bg-[#3370ff]' : 'border-[#d0d5dd] bg-white'}`} />
                  <button onClick={() => { setResponsibleExists(true); setResponsiblePerson('') }} className="text-sm text-[#1f2329]">是</button>
                </label>
                {responsibleExists && (
                  <Input
                    placeholder="填写违规人员"
                    value={responsiblePerson}
                    onChange={(e) => setResponsiblePerson(e.target.value)}
                    className="h-8 flex-1 rounded-md border border-[#d0d5dd] bg-white px-3 text-sm text-[#1f2329] placeholder:text-[#bbbfc4] focus:border-[#3370ff] focus:outline-none focus:ring-1 focus:ring-[#3370ff]"
                  />
                )}
                <label className="flex items-center gap-1.5 cursor-pointer text-sm text-[#1f2329] whitespace-nowrap">
                  <span className={`inline-block h-4 w-4 rounded-full border ${responsibleExists === false ? 'border-[#3370ff] bg-[#3370ff]' : 'border-[#d0d5dd] bg-white'}`} />
                  <button onClick={() => setResponsibleExists(false)} className="text-sm text-[#1f2329]">否</button>
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
              <Button onClick={handleSubmit} disabled={!canSubmit}>
                确认整改完结
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
