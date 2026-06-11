import { useState, useEffect } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import type { ExceptionRecord } from '@/types'

interface ConfirmDialogProps {
  record: ExceptionRecord | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (selectedInstructor: string) => void
  title: string
  description: string
  confirmText?: string
  cancelText?: string
  instructors?: string[]
}

export function ConfirmDialog({
  record,
  open,
  onOpenChange,
  onConfirm,
  title,
  description,
  confirmText = '确认',
  cancelText = '取消',
  instructors,
}: ConfirmDialogProps) {
  const [selectedInstructor, setSelectedInstructor] = useState('')

  // 弹窗打开时重置为第一个指导员
  useEffect(() => {
    if (open && instructors && instructors.length > 0) {
      setSelectedInstructor(instructors[0])
    } else if (open) {
      setSelectedInstructor('')
    }
  }, [open, instructors])

  const hasInstructors = instructors && instructors.length > 0

  const handleConfirm = () => {
    if (!hasInstructors || !selectedInstructor) return
    onConfirm(selectedInstructor)
    onOpenChange(false)
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="sm:max-w-[425px]">
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>

        {/* 始终渲染，根据状态显示不同内容 */}
        <div className="space-y-2 py-2">
          <label className="text-sm font-medium text-[#1f2329]">
            处理人
            {!hasInstructors && (
              <span className="ml-1 text-xs font-normal text-[#f97316]">
                未加载到指导员，请检查配置表
              </span>
            )}
          </label>
          {hasInstructors ? (
            <select
              value={selectedInstructor}
              onChange={(e) => setSelectedInstructor(e.target.value)}
              className="h-9 w-full rounded-md border border-[#d0d5dd] bg-white px-3 text-sm text-[#1f2329] focus:border-[#3370ff] focus:outline-none focus:ring-1 focus:ring-[#3370ff]"
            >
              {instructors!.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          ) : (
            <div className="h-9 w-full rounded-md border border-[#ffccc7] bg-[#fff2f0] px-3 text-sm text-[#cf1322] flex items-center">
              部门「{record?.department || '未知'}」无匹配指导员
            </div>
          )}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel>{cancelText}</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm} disabled={!hasInstructors || !selectedInstructor}>
            {confirmText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
