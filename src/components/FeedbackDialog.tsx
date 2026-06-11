import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { ExceptionRecord } from '@/types'

interface FeedbackDialogProps {
  record: ExceptionRecord | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (recordId: string, feedback: string, handler: string) => void
  instructors?: string[]
}

export function FeedbackDialog({
  record,
  open,
  onOpenChange,
  onSubmit,
  instructors = [],
}: FeedbackDialogProps) {
  const [feedback, setFeedback] = useState('')
  const [handler, setHandler] = useState(record?.handler || '')

  useEffect(() => {
    if (open && record) {
      setFeedback('')
      setHandler(record.handler || '')
    }
  }, [open, record])

  const handleSubmit = () => {
    if (!record || !feedback.trim() || !handler.trim()) return
    onSubmit(record.id, feedback.trim(), handler.trim())
    setFeedback('')
    setHandler('')
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>反馈处理</DialogTitle>
          <DialogDescription>
            异常编号：{record?.exceptionCode}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="handler" className="text-sm text-[#1f2329]">
              处理人 <span className="text-[#ff3b30]">*</span>
            </Label>
            {instructors.length > 0 ? (
              <select
                value={handler}
                onChange={(e) => setHandler(e.target.value)}
                className="h-9 w-full rounded-md border border-[#d0d5dd] bg-white px-3 text-sm text-[#1f2329] focus:border-[#3370ff] focus:outline-none focus:ring-1 focus:ring-[#3370ff]"
              >
                {instructors.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            ) : (
              <Input
                id="handler"
                placeholder="请输入处理人姓名"
                value={handler}
                onChange={(e) => setHandler(e.target.value)}
              />
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="feedback" className="text-sm text-[#1f2329]">
              反馈内容 <span className="text-[#ff3b30]">*</span>
            </Label>
            <Textarea
              id="feedback"
              placeholder="请输入反馈内容和处理措施..."
              rows={4}
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!feedback.trim() || !handler.trim()}
          >
            提交反馈
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
