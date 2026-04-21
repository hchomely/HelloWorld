import { jsPDF } from 'jspdf'
import html2canvas from 'html2canvas'
import type { GiftRecord } from '../types'
import { chunkRecords, PAGE_SIZE } from '../pagination'
import {
  fileDateStamp,
  formatAmount,
  formatAmountArabic,
  formatDateTime,
  toSafeFilenameStem,
} from '../format'

export async function exportGiftPdf(records: GiftRecord[], themeTitle: string): Promise<void> {
  if (records.length === 0) {
    window.alert('暂无记录，无法导出。')
    return
  }

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const chunks = chunkRecords(records, PAGE_SIZE)
  const pdfPages: GiftRecord[][] = []
  for (let i = 0; i < chunks.length; i += 2) {
    const merged = [...(chunks[i] ?? []), ...(chunks[i + 1] ?? [])]
    pdfPages.push(merged)
  }

  for (let i = 0; i < pdfPages.length; i += 1) {
    if (i > 0) doc.addPage()
    const sourceStart = i * 2 + 1
    const sourceEnd = Math.min(sourceStart + 1, chunks.length)
    const pageNode = buildPageNode(pdfPages[i]!, i + 1, pdfPages.length, themeTitle, sourceStart, sourceEnd)
    document.body.appendChild(pageNode)

    const canvas = await html2canvas(pageNode, {
      scale: 2,
      backgroundColor: '#ffffff',
    })
    pageNode.remove()

    const imgData = canvas.toDataURL('image/png')
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    const margin = 10
    const targetW = pageWidth - margin * 2
    const targetH = (canvas.height * targetW) / canvas.width
    doc.addImage(imgData, 'PNG', margin, margin, targetW, Math.min(targetH, pageHeight - margin * 2))
  }

  const safeTitle = toSafeFilenameStem(themeTitle, '人情簿')
  doc.save(`${safeTitle}_${fileDateStamp()}.pdf`)
}

function buildPageNode(
  records: GiftRecord[],
  pageNumber: number,
  totalPages: number,
  themeTitle: string,
  sourceStartPage: number,
  sourceEndPage: number,
): HTMLDivElement {
  const root = document.createElement('div')
  root.style.position = 'fixed'
  root.style.left = '-10000px'
  root.style.top = '0'
  root.style.width = '800px'
  root.style.padding = '20px'
  root.style.background = '#ffffff'
  root.style.color = '#1f2937'
  root.style.fontFamily = '"Noto Sans SC", "Microsoft YaHei", sans-serif'
  root.style.fontSize = '14px'

  const title = document.createElement('h2')
  title.textContent = themeTitle || '电子人情簿'
  title.style.margin = '0 0 10px 0'
  title.style.fontSize = '22px'
  root.appendChild(title)

  const sub = document.createElement('p')
  sub.textContent = `PDF 第 ${pageNumber} / ${totalPages} 页（合并原第 ${sourceStartPage}${sourceEndPage > sourceStartPage ? `-${sourceEndPage}` : ''} 页数据）`
  sub.style.margin = '0 0 12px 0'
  sub.style.color = '#6b7280'
  root.appendChild(sub)

  const table = document.createElement('table')
  table.style.width = '100%'
  table.style.borderCollapse = 'collapse'
  table.style.tableLayout = 'fixed'

  const thead = document.createElement('thead')
  const htr = document.createElement('tr')
  ;['姓名', '礼金(大写)', '礼金(数字)', '备忘录', '添加时间'].forEach((text) => {
    const th = document.createElement('th')
    th.textContent = text
    th.style.border = '1px solid #d1d5db'
    th.style.padding = '8px'
    th.style.background = '#f3f4f6'
    th.style.textAlign = 'left'
    htr.appendChild(th)
  })
  thead.appendChild(htr)
  table.appendChild(thead)

  const tbody = document.createElement('tbody')
  records.forEach((r) => {
    const tr = document.createElement('tr')
    const cells = [
      r.name,
      formatAmount(r.amount),
      formatAmountArabic(r.amount),
      r.memo || '—',
      formatDateTime(r.createdAt),
    ]
    cells.forEach((value) => {
      const td = document.createElement('td')
      td.textContent = value
      td.style.border = '1px solid #d1d5db'
      td.style.padding = '8px'
      td.style.verticalAlign = 'top'
      td.style.wordBreak = 'break-word'
      tr.appendChild(td)
    })
    tbody.appendChild(tr)
  })
  table.appendChild(tbody)
  root.appendChild(table)

  return root
}
