import React, { useState, useMemo } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import {
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  Download,
} from 'lucide-react'
import { StatusBadge } from '@/components/StatusBadge'
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { exportToExcel } from '@/utils/export'
import type { ExceptionRecord, ActionType } from '@/types'

interface ExceptionTableProps {
  records: ExceptionRecord[]
  statusFilter?: string
  riskFilter?: string
  platformFilter?: string
  exceptionTypeFilter?: string
  searchKeyword?: string
  loading?: boolean
  onStatusFilterChange?: (v: string) => void
  onRiskFilterChange?: (v: string) => void
  onPlatformFilterChange?: (v: string) => void
  onExceptionTypeFilterChange?: (v: string) => void
  onSearchKeywordChange?: (v: string) => void
  onViewDetail: (record: ExceptionRecord) => void
  onAction: (action: ActionType, record: ExceptionRecord) => void
}

const PAGE_SIZE = 20

function TooltipCell({ value, className }: { value: string; className?: string }) {
  if (!value) return <span className={className}>-</span>
  return (
    <span className={`truncate block ${className || ''}`}>{value}</span>
  )
}

/** 带自定义悬浮提示的单元格内容（Radix Tooltip，Portal 渲染不受表格 overflow 裁剪） */
function HoverCell({ value, className }: { value: string; className?: string }) {
  if (!value) return <span className={className}>-</span>
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={`truncate block cursor-default ${className || ''}`}>{value}</span>
      </TooltipTrigger>
      <TooltipContent>{value}</TooltipContent>
    </Tooltip>
  )
}

function getPageNumbers(current: number, total: number): (number | 'ellipsis-start' | 'ellipsis-end')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const pages: (number | 'ellipsis-start' | 'ellipsis-end')[] = [1]
  if (current > 3) pages.push('ellipsis-start')
  const start = Math.max(2, current - 1)
  const end = Math.min(total - 1, current + 1)
  for (let i = start; i <= end; i++) pages.push(i)
  if (current < total - 2) pages.push('ellipsis-end')
  pages.push(total)
  return pages
}

export const ExceptionTable = React.memo(function ExceptionTable({
  records,
  statusFilter: externalStatusFilter,
  riskFilter: externalRiskFilter,
  platformFilter: externalPlatformFilter,
  exceptionTypeFilter: externalExceptionTypeFilter,
  searchKeyword: externalSearchKeyword,
  loading = false,
  onStatusFilterChange,
  onRiskFilterChange,
  onPlatformFilterChange,
  onExceptionTypeFilterChange,
  onSearchKeywordChange,
  onViewDetail,
  onAction,
}: ExceptionTableProps) {
  const [currentPage, setCurrentPage] = useState(1)

  const statusFilter = externalStatusFilter ?? '全部'
  const riskFilter = externalRiskFilter ?? '全部'
  const platformFilter = externalPlatformFilter ?? '全部'
  const exceptionTypeFilter = externalExceptionTypeFilter ?? '全部'
  const searchKeyword = externalSearchKeyword ?? ''
  const setStatusFilter = onStatusFilterChange || (() => {})
  const setRiskFilter = onRiskFilterChange || (() => {})
  const setPlatformFilter = onPlatformFilterChange || (() => {})
  const setExceptionTypeFilter = onExceptionTypeFilterChange || (() => {})
  const setSearchKeyword = onSearchKeywordChange || (() => {})

  // 只把"已完成"排到最后，其余状态保持原顺序
  const filteredRecords = useMemo(() => {
    const result = records.filter((record) => {
      // 状态筛选（已超时按 isTimeout 字段筛选）
      if (statusFilter === '已超时') {
        if (!record.isTimeout) return false
      } else if (statusFilter !== '全部') {
        if (record.status !== statusFilter) return false
      }
      // 风险等级筛选
      if (riskFilter !== '全部' && record.riskLevel !== riskFilter) return false
      // 平台筛选
      if (platformFilter !== '全部' && record.sourcePlatform !== platformFilter) return false
      // 异常类型筛选
      if (exceptionTypeFilter !== '全部' && record.exceptionType !== exceptionTypeFilter) return false
      // 关键词搜索：编号 + 业务渠道指导员 + 申请人
      if (searchKeyword) {
        const keyword = searchKeyword.toLowerCase()
        const applicant = (record.permApplicant || record.extAccountName || '').toLowerCase()
        return (
          record.exceptionCode.toLowerCase().includes(keyword) ||
          record.deptInstructors.toLowerCase().includes(keyword) ||
          applicant.includes(keyword)
        )
      }
      return true
    })
    const completed = result.filter((r) => r.status === '已完结')
    const others = result.filter((r) => r.status !== '已完结')
    return [...others, ...completed]
  }, [records, statusFilter, riskFilter, platformFilter, exceptionTypeFilter, searchKeyword])

  // 动态风险选项（从记录中提取原始值）
  const riskOptions = useMemo(() => {
    const order = ['R3', 'R2', 'R1']
    const unique = [...new Set(records.map((r) => r.riskLevel).filter(Boolean))].sort(
      (a, b) => order.indexOf(a) - order.indexOf(b)
    )
    return [
      { label: '全部等级', value: '全部' },
      ...unique.map((r) => ({ label: r, value: r })),
    ]
  }, [records])

  // 动态平台选项（从主表记录的 sourcePlatform 提取）
  const platformOptions = useMemo(() => {
    const unique = [...new Set(records.map((r) => r.sourcePlatform).filter(Boolean))];
    return [
      { label: '全部平台', value: '全部' },
      ...unique.map((p) => ({ label: p, value: p })),
    ]
  }, [records])

  // 动态异常类型选项（从主表记录的 exceptionType 提取，按名称排序）
  const exceptionTypeOptions = useMemo(() => {
    const unique = [...new Set(records.map((r) => r.exceptionType).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'zh-CN'));
    return [
      { label: '全部类型', value: '全部' },
      ...unique.map((t) => ({ label: t, value: t })),
    ]
  }, [records])

  // 固定状态选项（始终显示全部预设状态，不受当前记录中无该状态影响）
  const statusOptions = useMemo(() => [
    { label: '全部状态', value: '全部' },
    { label: '待处理', value: '待处理' },
    { label: '整改中', value: '整改中' },
    { label: '已完结', value: '已完结' },
    { label: '已超时', value: '已超时' },
  ], [])

  // 分页
  const totalPages = Math.ceil(filteredRecords.length / PAGE_SIZE)
  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE
    return filteredRecords.slice(start, start + PAGE_SIZE)
  }, [filteredRecords, currentPage])

  // 筛选条件变化时重置页码
  const handleFilterChange = (setter: (value: string) => void) => (value: string) => {
    setter(value)
    setCurrentPage(1)
  }

  return (
    <TooltipProvider delayDuration={200}>
    <div className="space-y-2">
      {/* 筛选栏 */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[#e5e6eb] bg-white p-2">
        <div className="flex items-center gap-1.5 text-sm text-[#646a73] pr-1">
          <Filter className="h-4 w-4" />
          <span>筛选</span>
        </div>

        <Select value={statusFilter} onValueChange={handleFilterChange(setStatusFilter)}>
          <SelectTrigger className="h-8 w-[120px]">
            <SelectValue placeholder="状态" />
          </SelectTrigger>
          <SelectContent>
            {statusOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={riskFilter} onValueChange={handleFilterChange(setRiskFilter)}>
          <SelectTrigger className="h-8 w-[120px]">
            <SelectValue placeholder="风险等级" />
          </SelectTrigger>
          <SelectContent>
            {riskOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={platformFilter} onValueChange={handleFilterChange(setPlatformFilter)}>
          <SelectTrigger className="h-8 w-[120px]">
            <SelectValue placeholder="来源平台" />
          </SelectTrigger>
          <SelectContent className="max-h-[180px]">
            {platformOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={exceptionTypeFilter} onValueChange={handleFilterChange(setExceptionTypeFilter)}>
          <SelectTrigger className="h-8 w-[160px]">
            <SelectValue placeholder="异常类型" />
          </SelectTrigger>
          <SelectContent className="max-h-[220px] min-w-[16rem]">
            {exceptionTypeOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <a
          href="https://kttfkmbfmy.feishu.cn/wiki/DJd0wfFLficLNTkx41tcxBU4n8b"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-[#3370ff] hover:underline ml-auto"
        >
          指引
        </a>

        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8f959e]" />
          <Input
            placeholder="搜索编号、指导员、申请人..."
            value={searchKeyword}
            onChange={(e) => {
              setSearchKeyword(e.target.value)
              setCurrentPage(1)
            }}
            className="h-8 w-[200px] pl-8"
          />
        </div>

        <div className="text-sm text-[#646a73] whitespace-nowrap">
          共 <span className="font-medium text-[#1f2329]">{filteredRecords.length}</span> 条
        </div>

        <Button
          variant="outline"
          size="sm"
          className="h-8 px-3 text-xs gap-1.5 whitespace-nowrap"
          onClick={() => exportToExcel(filteredRecords)}
          disabled={filteredRecords.length === 0}
        >
          <Download className="h-3.5 w-3.5" />
          导出Excel
        </Button>
      </div>

      {/* 表格 */}
      <div className="rounded-lg border border-[#e5e6eb] bg-white">
        <Table className="table-fixed">
          <TableHeader>
            <TableRow className="bg-[#fafbfc]">
              <TableHead className="w-[13%] text-center">平台</TableHead>
              <TableHead className="w-[20%] text-center">异常类型</TableHead>
              <TableHead className="w-[20%] text-center">异常详细描述</TableHead>
              <TableHead className="w-[10%] text-center">申请人</TableHead>
              <TableHead className="w-[8%] text-center">状态</TableHead>
              <TableHead className="w-[10%] text-center">审阅时间</TableHead>
              <TableHead className="w-[8%] text-center">处理时效</TableHead>
              <TableHead className="w-[10%] text-center">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedRecords.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-32 text-center text-[#8f959e]">
                  {loading ? (
                    <div className="flex flex-col items-center gap-2">
                      <svg className="h-5 w-5 animate-spin text-[#3370ff]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      <span>正在拉取数据，请稍候…</span>
                    </div>
                  ) : (
                    '暂无数据'
                  )}
                </TableCell>
              </TableRow>
            ) : (
              paginatedRecords.map((record) => {
                const applicant = record.permApplicant || record.extAccountName || '-'
                // 计算处理时效（相对天数）
                const deadlineText = record.deadlineText || '-'
                return (
                <TableRow
                  key={record.id}
                  className="cursor-pointer hover:bg-[#f5f6f8]"
                  onClick={() => onViewDetail(record)}
                >
                  <TableCell className="text-center">
                    <TooltipCell value={record.sourcePlatform} className="text-[#646a73]" />
                  </TableCell>
                  <TableCell className="text-center">
                    <HoverCell value={record.exceptionType} className="text-[#1f2329]" />
                  </TableCell>
                  <TableCell className="text-center">
                    <HoverCell value={record.description} className="text-[#646a73]" />
                  </TableCell>
                  <TableCell className="text-center">
                    <TooltipCell value={applicant} className="text-[#1f2329]" />
                  </TableCell>
                  <TableCell className="text-center">
                    <StatusBadge status={record.status} />
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="truncate block text-[#646a73]">{record.reviewTime || '-'}</span>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="truncate block text-[#646a73]">{deadlineText}</span>
                  </TableCell>
                  <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-center gap-1.5">
                      {(record.status === '待处理') && (
                        <Button
                          variant="default"
                          size="sm"
                          className="h-7 px-2.5 bg-[#3370ff] text-xs hover:bg-[#2860e1] whitespace-nowrap"
                          onClick={() => onAction('confirm', record)}
                        >
                          确认核查
                        </Button>
                      )}
                      {record.status === '整改中' && (
                        <Button
                          variant="default"
                          size="sm"
                          className="h-7 px-2.5 bg-[#ff9500] text-xs hover:bg-[#e68600] whitespace-nowrap"
                          onClick={() => onAction('feedback', record)}
                        >
                          情况反馈
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>

        {/* 分页 */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-[#e5e6eb] px-4 py-2.5">
            <div className="flex items-center gap-3 text-sm text-[#646a73]">
              <span>
                第 {(currentPage - 1) * PAGE_SIZE + 1}-
                {Math.min(currentPage * PAGE_SIZE, filteredRecords.length)} 条，共{' '}
                <span className="font-medium text-[#1f2329]">{filteredRecords.length}</span> 条
              </span>
              <span className="text-[#e5e6eb]">|</span>
              <span>
                共 <span className="font-medium text-[#1f2329]">{totalPages}</span> 页
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(1)}
                title="首页"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M11 17l-5-5m0 0l5-5m-5 5h12" /><path d="M18 17V7" />
                </svg>
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(currentPage - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              {getPageNumbers(currentPage, totalPages).map((item) => {
                if (item === 'ellipsis-start' || item === 'ellipsis-end') {
                  return (
                    <span key={item} className="flex h-8 w-8 items-center justify-center text-sm text-[#8f959e] select-none">
                      ...
                    </span>
                  )
                }
                return (
                  <Button
                    key={item}
                    variant={currentPage === item ? 'default' : 'outline'}
                    size="icon"
                    className={cn(
                      'h-8 w-8 text-sm',
                      currentPage === item && 'bg-[#3370ff] text-white hover:bg-[#2860e1]'
                    )}
                    onClick={() => setCurrentPage(item)}
                  >
                    {item}
                  </Button>
                )
              })}
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(currentPage + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(totalPages)}
                title="末页"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M13 17l5-5m0 0l-5-5m5 5H6" /><path d="M6 17V7" />
                </svg>
              </Button>
              <div className="ml-3 flex items-center gap-1.5 text-sm text-[#646a73]">
                <span>跳至</span>
                <Input
                  type="number"
                  min={1}
                  max={totalPages}
                  className="h-7 w-[52px] text-center text-xs"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const v = parseInt((e.target as HTMLInputElement).value, 10)
                      if (v >= 1 && v <= totalPages) {
                        setCurrentPage(v)
                        ;(e.target as HTMLInputElement).value = ''
                      }
                    }
                  }}
                  placeholder=""
                />
                <span>页</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
    </TooltipProvider>
  )
});
