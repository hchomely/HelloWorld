import * as XLSX from 'xlsx'
import type { GiftRecord } from '../types'
import { chunkRecords, PAGE_SIZE } from '../pagination'
import { fileDateStamp, formatAmount, formatAmountArabic, formatDateTime, toSafeFilenameStem } from '../format'

const HEAD = ['姓名', '礼金(大写)', '礼金(数字)', '备忘录', '添加时间']

export function exportGiftExcel(records: GiftRecord[], themeTitle: string): void {
  if (records.length === 0) {
    window.alert('暂无记录，无法导出。')
    return
  }

  const wb = XLSX.utils.book_new()
  const chunks = chunkRecords(records, PAGE_SIZE)

  chunks.forEach((chunk, pageIdx) => {
    const title = themeTitle || '电子人情簿'
    const rows: (string | number)[][] = [
      [title, '', '', '', ''],
      [],
      HEAD,
      ...chunk.map((r) => [
        r.name,
        formatAmount(r.amount),
        formatAmountArabic(r.amount),
        r.memo,
        formatDateTime(r.createdAt),
      ]),
    ]
    const ws = XLSX.utils.aoa_to_sheet(rows)
    const colW = [{ wch: 12 }, { wch: 18 }, { wch: 12 }, { wch: 24 }, { wch: 18 }]
    ws['!cols'] = colW
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 4 } },
    ]
    XLSX.utils.book_append_sheet(wb, ws, `第${pageIdx + 1}页`)
  })

  const safeTitle = toSafeFilenameStem(themeTitle, '人情簿')
  const name = `${safeTitle}_${fileDateStamp()}.xlsx`
  XLSX.writeFile(wb, name)
}
