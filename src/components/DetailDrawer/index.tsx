import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet'
import { Separator } from '@/components/ui/separator'
import { StatusBadge } from '@/components/StatusBadge'
import { RiskBadge } from '@/components/RiskBadge'
import type { ExceptionRecord } from '@/types'

interface DetailDrawerProps {
  record: ExceptionRecord | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

function FieldRow({ label, value }: { label: string; value: string | number }) {
  if (!value && value !== 0) return null
  return (
    <div className="space-y-0.5">
      <p className="text-xs text-[#8f959e]">{label}</p>
      <p className="text-sm text-[#1f2329]">{value}</p>
    </div>
  )
}

function SectionBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium text-[#1f2329] pb-1 border-b border-[#e5e6eb]">{title}</h4>
      <div className="grid grid-cols-2 gap-x-6 gap-y-3">{children}</div>
    </div>
  )
}

export function DetailDrawer({ record, open, onOpenChange }: DetailDrawerProps) {
  if (!record) return null

  const permFields = [
    { label: '账号名称', value: record.permAccountName },
    { label: '店铺名称', value: record.permStoreName },
    { label: '工单ID', value: record.permWorkOrderId },
    { label: '申请人', value: record.permApplicant },
    { label: 'CORP邮箱', value: record.permApplicantEmail },
    { label: '手机号', value: record.permApplicantPhone },
    { label: '用户昵称', value: record.permUserNickname },
    { label: '用户角色列表', value: record.permUserRoleList },
  ]

  const extFields = [
    { label: '店铺名称', value: record.extStoreName },
    { label: '用户手机号', value: record.extUserPhone },
    { label: '账号名', value: record.extAccountName },
    { label: '用户姓名', value: record.extUserName },
    { label: '用户角色列表', value: record.extUserRoleList },
  ]

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-none w-[640px] overflow-y-auto">
        <SheetHeader>
          <div className="flex items-center gap-3">
            <SheetTitle className="text-lg">{record.exceptionType || '-'}</SheetTitle>
            <RiskBadge level={(record.riskLevel || 'R1') as any} />
            <StatusBadge status={record.status} />
          </div>
          <SheetDescription>
            {record.exceptionCode || '-'}
          </SheetDescription>
        </SheetHeader>

        <Separator className="my-4" />

        {/* 基本信息 */}
        <SectionBlock title="基本信息">
          <FieldRow label="来源平台" value={record.sourcePlatform} />
          <FieldRow label="风险等级" value={record.riskLevel} />
          <FieldRow label="处理人" value={record.handler} />
          <FieldRow label="当前状态" value={record.status} />
          <FieldRow label="处理时效" value={record.deadlineText || record.processDeadline} />
          <FieldRow label="所属部门" value={record.department} />
          <FieldRow label="审阅时间" value={record.reviewTime || record.createdAt} />
        </SectionBlock>

        {/* 异常描述 */}
        {record.description && (
          <>
            <Separator className="my-4" />
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-[#1f2329]">异常描述</h4>
              <div className="rounded-lg bg-[#f5f6f8] p-3">
                <p className="text-sm text-[#646a73]">{record.description}</p>
              </div>
            </div>
          </>
        )}

        {/* 反馈内容 */}
        {record.feedback && (
          <>
            <Separator className="my-4" />
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-[#1f2329]">反馈内容</h4>
              <div className="rounded-lg bg-[#f5f6f8] p-3">
                <p className="text-sm text-[#646a73]">{record.feedback}</p>
              </div>
            </div>
          </>
        )}

        {/* 权限中心 */}
        {permFields.some((f) => f.value) && (
          <>
            <Separator className="my-4" />
            <SectionBlock title="权限中心">
              {permFields.map((f) => (
                <FieldRow key={f.label} label={f.label} value={f.value} />
              ))}
            </SectionBlock>
          </>
        )}

        {/* 外部系统 */}
        {extFields.some((f) => f.value) && (
          <>
            <Separator className="my-4" />
            <SectionBlock title="外部系统">
              {extFields.map((f) => (
                <FieldRow key={f.label} label={f.label} value={f.value} />
              ))}
            </SectionBlock>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
