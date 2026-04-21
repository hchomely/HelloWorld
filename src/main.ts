import './style.css'
import '@fontsource/noto-sans-sc/chinese-simplified-400.css'
import type { GiftRecord } from './types'
import { clampPage, getPageSlice, totalPages } from './pagination'
import {
  appendOperationLog,
  importRecordsFromOperationLogs,
  loadRecords,
  loadThemeTitle,
  newId,
  saveRecords,
  saveThemeTitle,
} from './storage'
import { formatAmount, formatAmountArabic } from './format'

let records: GiftRecord[] = loadRecords()
let currentPage = clampPage(1, records.length)
let editingId: string | null = null
let themeTitle = loadThemeTitle() || '电子人情簿'
let lastLoggedThemeTitle = themeTitle
let amountDisplayMode: 'traditional' | 'arabic' = 'traditional'

function mount(): void {
  const root = document.querySelector<HTMLDivElement>('#app')
  if (!root) return

  root.innerHTML = `
    <div class="app-shell">
      <header class="app-header">
        <h1 id="theme-display">${themeTitle}</h1>
        <p class="subtitle">记录礼金与备忘，支持导出 PDF / Excel（每页 10 条）</p>
        <div class="theme-editor">
          <label class="field field-inline" for="field-theme-title">
            <span>主题标题</span>
            <input id="field-theme-title" type="text" maxlength="40" placeholder="例如：2026 春节人情簿" value="${themeTitle}" />
          </label>
        </div>
      </header>
      <main class="layout">
        <aside class="panel panel-form">
          <h2 id="form-title">添加记录</h2>
          <form id="gift-form" class="gift-form" novalidate>
            <label class="field">
              <span>姓名</span>
              <input id="field-name" name="name" type="text" autocomplete="name" maxlength="50" required placeholder="请输入姓名" />
            </label>
            <label class="field">
              <span>礼金（元）</span>
              <input id="field-amount" name="amount" type="number" inputmode="decimal" min="0" step="0.01" required placeholder="0.00" />
            </label>
            <label class="field">
              <span>备忘录</span>
              <textarea id="field-memo" name="memo" rows="4" maxlength="500" placeholder="可选：宴席、关系等"></textarea>
            </label>
            <div class="form-actions">
              <button type="submit" class="btn btn-primary" id="btn-submit-form">添加</button>
              <button type="button" class="btn btn-ghost" id="btn-clear-form">清空表单</button>
            </div>
          </form>
          <div class="export-block">
            <h3>导出</h3>
            <div class="export-actions">
              <button type="button" class="btn btn-secondary" id="btn-export-pdf">导出 PDF</button>
              <button type="button" class="btn btn-secondary" id="btn-export-excel">导出 Excel</button>
              <button type="button" class="btn btn-secondary" id="btn-import-logs">导入日志数据</button>
            </div>
            <p class="hint">首次导出 PDF 会在本地转换字体，数据多时请稍候。</p>
          </div>
        </aside>
        <section class="panel panel-list">
          <div class="list-toolbar">
            <div class="stats">
              <span>共 <strong id="stat-count">0</strong> 条</span>
              <span class="sep">·</span>
              <span>第 <strong id="stat-page">1</strong> / <strong id="stat-total-pages">1</strong> 页</span>
              <span class="sep">·</span>
              <span>本页礼金 <strong id="stat-page-total">¥0.00</strong></span>
              <span class="sep">·</span>
              <span>全部礼金 <strong id="stat-all-total">¥0.00</strong></span>
            </div>
            <button type="button" class="btn btn-ghost btn-sm" id="btn-toggle-amount-mode">礼金显示：大写</button>
          </div>
          <div id="table-flip" class="table-flip" data-dir="">
            <div id="record-wrap" class="record-wrap">
              <div class="record-board">
                <div class="record-label-col" aria-hidden="true">
                  <p class="record-label">姓名</p>
                  <p class="record-label">礼金</p>
                  <p class="record-label">备忘录</p>
                </div>
                <div id="ledger-list" class="record-grid" aria-label="人情记录"></div>
              </div>
            </div>
            <p id="empty-hint" class="empty-hint" hidden>暂无记录，请在左侧添加。</p>
          </div>
          <nav class="pager" aria-label="分页">
            <button type="button" class="btn btn-ghost" id="btn-first" aria-label="首页">首页</button>
            <button type="button" class="btn btn-ghost" id="btn-prev">上一页</button>
            <button type="button" class="btn btn-ghost" id="btn-next">下一页</button>
            <button type="button" class="btn btn-ghost" id="btn-last" aria-label="末页">末页</button>
          </nav>
        </section>
      </main>
    </div>
  `

  bind(root)
  render()
}

function bind(root: HTMLDivElement): void {
  const themeDisplay = root.querySelector<HTMLHeadingElement>('#theme-display')!
  const themeInput = root.querySelector<HTMLInputElement>('#field-theme-title')!
  const formTitle = root.querySelector<HTMLHeadingElement>('#form-title')!
  const form = root.querySelector<HTMLFormElement>('#gift-form')!
  const submitBtn = root.querySelector<HTMLButtonElement>('#btn-submit-form')!
  const clearBtn = root.querySelector<HTMLButtonElement>('#btn-clear-form')!
  const nameEl = root.querySelector<HTMLInputElement>('#field-name')!
  const amountEl = root.querySelector<HTMLInputElement>('#field-amount')!
  const memoEl = root.querySelector<HTMLTextAreaElement>('#field-memo')!
  const listEl = root.querySelector<HTMLDivElement>('#ledger-list')!
  const flipEl = root.querySelector<HTMLDivElement>('#table-flip')!
  const emptyHint = root.querySelector<HTMLParagraphElement>('#empty-hint')!
  const toggleAmountBtn = root.querySelector<HTMLButtonElement>('#btn-toggle-amount-mode')!
  let themeLogTimer: number | null = null

  const setEditMode = (id: string | null): void => {
    editingId = id
    if (editingId) {
      formTitle.textContent = '修改记录'
      submitBtn.textContent = '保存修改'
      clearBtn.textContent = '取消修改'
    } else {
      formTitle.textContent = '添加记录'
      submitBtn.textContent = '添加'
      clearBtn.textContent = '清空表单'
    }
  }

  const updateAmountModeButton = (): void => {
    toggleAmountBtn.textContent =
      amountDisplayMode === 'traditional' ? '礼金显示：大写' : '礼金显示：数字'
  }
  updateAmountModeButton()

  toggleAmountBtn.addEventListener('click', () => {
    amountDisplayMode = amountDisplayMode === 'traditional' ? 'arabic' : 'traditional'
    updateAmountModeButton()
    render()
    triggerFlip(flipEl, 'next')
  })

  const flushThemeLog = (): void => {
    if (themeTitle === lastLoggedThemeTitle) return
    appendOperationLog({
      id: newId(),
      type: 'theme_update',
      createdAt: new Date().toISOString(),
      recordId: '__theme__',
      beforeThemeTitle: lastLoggedThemeTitle,
      afterThemeTitle: themeTitle,
    })
    lastLoggedThemeTitle = themeTitle
  }

  themeInput.addEventListener('input', () => {
    const next = themeInput.value.trim()
    themeTitle = next || '电子人情簿'
    themeDisplay.textContent = themeTitle
    saveThemeTitle(themeTitle)
    if (themeLogTimer !== null) {
      window.clearTimeout(themeLogTimer)
    }
    themeLogTimer = window.setTimeout(() => {
      flushThemeLog()
      themeLogTimer = null
    }, 500)
  })

  themeInput.addEventListener('change', () => {
    if (themeLogTimer !== null) {
      window.clearTimeout(themeLogTimer)
      themeLogTimer = null
    }
    flushThemeLog()
  })

  clearBtn.addEventListener('click', () => {
    form.reset()
    setEditMode(null)
    nameEl.focus()
  })

  form.addEventListener('submit', (e) => {
    e.preventDefault()
    const name = nameEl.value.trim()
    const amountRaw = amountEl.value.trim()
    const amount = Number.parseFloat(amountRaw)

    if (!name) {
      window.alert('请填写姓名。')
      nameEl.focus()
      return
    }
    if (!Number.isFinite(amount) || amount < 0) {
      window.alert('请填写有效的礼金（大于等于 0 的数字）。')
      amountEl.focus()
      return
    }

    const memo = memoEl.value.trim()
    const edited = editingId ? records.find((r) => r.id === editingId) : undefined

    if (edited) {
      const updated: GiftRecord = { ...edited, name, amount, memo }
      records = records.map((r) =>
        r.id === edited.id ? updated : r,
      )
      saveRecords(records)
      appendOperationLog({
        id: newId(),
        type: 'update',
        createdAt: new Date().toISOString(),
        recordId: edited.id,
        before: { ...edited },
        after: { ...updated },
      })
      form.reset()
      setEditMode(null)
      render()
      triggerFlip(flipEl, 'next')
      return
    }

    const rec: GiftRecord = {
      id: newId(),
      name,
      amount,
      memo,
      createdAt: new Date().toISOString(),
    }
    records = [...records, rec]
    saveRecords(records)
    appendOperationLog({
      id: newId(),
      type: 'add',
      createdAt: new Date().toISOString(),
      recordId: rec.id,
      after: { ...rec },
    })
    currentPage = totalPages(records.length)
    form.reset()
    setEditMode(null)
    render()
    triggerFlip(flipEl, 'next')
  })

  const go = (page: number, dir: 'next' | 'prev' | 'none') => {
    const prevPage = currentPage
    const next = clampPage(page, records.length)
    const changed = next !== prevPage
    currentPage = next
    render()
    if (changed && dir !== 'none') {
      triggerFlip(flipEl, dir)
    }
  }

  root.querySelector('#btn-prev')!.addEventListener('click', () => go(currentPage - 1, 'prev'))
  root.querySelector('#btn-next')!.addEventListener('click', () => go(currentPage + 1, 'next'))
  root.querySelector('#btn-first')!.addEventListener('click', () => go(1, currentPage > 1 ? 'prev' : 'none'))
  root.querySelector('#btn-last')!.addEventListener('click', () => {
    const last = totalPages(records.length)
    go(last, currentPage < last ? 'next' : 'none')
  })

  const pdfBtn = root.querySelector<HTMLButtonElement>('#btn-export-pdf')!
  const excelBtn = root.querySelector<HTMLButtonElement>('#btn-export-excel')!
  const importBtn = root.querySelector<HTMLButtonElement>('#btn-import-logs')!

  function setExporting(on: boolean): void {
    pdfBtn.disabled = on
    excelBtn.disabled = on
    importBtn.disabled = on
    pdfBtn.textContent = on ? '导出中…' : '导出 PDF'
    excelBtn.textContent = on ? '导出中…' : '导出 Excel'
    importBtn.textContent = on ? '处理中…' : '导入日志数据'
  }

  listEl.addEventListener('click', (e) => {
    const t = e.target as HTMLElement
    const editBtn = t.closest<HTMLButtonElement>('button[data-edit-id]')
    if (editBtn) {
      const id = editBtn.dataset.editId
      if (!id) return
      const rec = records.find((r) => r.id === id)
      if (!rec) return
      nameEl.value = rec.name
      amountEl.value = String(rec.amount)
      memoEl.value = rec.memo
      setEditMode(rec.id)
      nameEl.focus()
      return
    }

    const btn = t.closest<HTMLButtonElement>('button[data-delete-id]')
    if (!btn) return
    const id = btn.dataset.deleteId
    if (!id) return
    const toDelete = records.find((r) => r.id === id)
    if (!toDelete) return
    if (!window.confirm('确认删除这条记录吗？')) return
    const beforeLen = records.length
    records = records.filter((r) => r.id !== id)
    if (records.length === beforeLen) return
    if (editingId === id) {
      form.reset()
      setEditMode(null)
    }
    saveRecords(records)
    appendOperationLog({
      id: newId(),
      type: 'delete',
      createdAt: new Date().toISOString(),
      recordId: toDelete.id,
      before: { ...toDelete },
    })
    currentPage = clampPage(currentPage, records.length)
    render()
    if (records.length > 0) {
      triggerFlip(flipEl, 'prev')
    }
  })

  excelBtn.addEventListener('click', async () => {
    if (excelBtn.disabled) return
    setExporting(true)
    try {
      const { exportGiftExcel } = await import('./export/excel')
      exportGiftExcel(records, themeTitle)
    } finally {
      setExporting(false)
    }
  })

  pdfBtn.addEventListener('click', async () => {
    if (pdfBtn.disabled) return
    setExporting(true)
    try {
      const { exportGiftPdf } = await import('./export/pdf')
      await exportGiftPdf(records, themeTitle)
    } catch (err) {
      console.error(err)
      window.alert('导出 PDF 失败，请检查网络或稍后重试。')
    } finally {
      setExporting(false)
    }
  })

  importBtn.addEventListener('click', async () => {
    if (importBtn.disabled) return
    const shouldImport =
      records.length === 0 ||
      window.confirm('导入日志会覆盖当前记录，是否继续？')
    if (!shouldImport) return

    setExporting(true)
    try {
      const imported = await importRecordsFromOperationLogs()
      records = imported.records
      themeTitle = imported.themeTitle || '电子人情簿'
      lastLoggedThemeTitle = themeTitle
      themeDisplay.textContent = themeTitle
      themeInput.value = themeTitle
      currentPage = clampPage(1, records.length)
      form.reset()
      setEditMode(null)
      saveRecords(records)
      saveThemeTitle(themeTitle)
      render()
      if (records.length > 0) {
        triggerFlip(flipEl, 'next')
      }
      window.alert(`导入完成，共 ${records.length} 条记录。`)
    } catch (err) {
      console.error(err)
      window.alert('导入失败，请确认日志 API 已启动。')
    } finally {
      setExporting(false)
    }
  })

  emptyHint.addEventListener('click', () => nameEl.focus())
}

function triggerFlip(el: HTMLDivElement, dir: 'next' | 'prev'): void {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (reduce) return
  el.dataset.dir = dir === 'next' ? 'next' : 'prev'
  el.classList.remove('flip-anim')
  void el.offsetWidth
  el.classList.add('flip-anim')
  const done = () => {
    el.classList.remove('flip-anim')
    el.dataset.dir = ''
    el.removeEventListener('animationend', done)
  }
  el.addEventListener('animationend', done)
}

function render(): void {
  const root = document.querySelector<HTMLDivElement>('#app')
  if (!root) return

  const countEl = root.querySelector('#stat-count')!
  const pageEl = root.querySelector('#stat-page')!
  const totalPagesEl = root.querySelector('#stat-total-pages')!
  const pageTotalEl = root.querySelector('#stat-page-total')!
  const allTotalEl = root.querySelector('#stat-all-total')!
  const listEl = root.querySelector<HTMLDivElement>('#ledger-list')!
  const emptyHint = root.querySelector<HTMLParagraphElement>('#empty-hint')!
  const recordWrap = root.querySelector<HTMLDivElement>('#record-wrap')!
  const btnFirst = root.querySelector<HTMLButtonElement>('#btn-first')!
  const btnPrev = root.querySelector<HTMLButtonElement>('#btn-prev')!
  const btnNext = root.querySelector<HTMLButtonElement>('#btn-next')!
  const btnLast = root.querySelector<HTMLButtonElement>('#btn-last')!

  const count = records.length
  const tp = totalPages(count)
  currentPage = clampPage(currentPage, count)

  countEl.textContent = String(count)
  pageEl.textContent = String(currentPage)
  totalPagesEl.textContent = String(tp)
  allTotalEl.textContent = formatAmountArabic(records.reduce((sum, r) => sum + r.amount, 0))

  const atFirst = currentPage <= 1
  const atLast = currentPage >= tp
  btnFirst.disabled = atFirst
  btnPrev.disabled = atFirst
  btnNext.disabled = atLast
  btnLast.disabled = atLast

  listEl.replaceChildren()

  if (count === 0) {
    pageTotalEl.textContent = formatAmountArabic(0)
    emptyHint.hidden = false
    recordWrap.hidden = true
    return
  }

  emptyHint.hidden = true
  recordWrap.hidden = false

  const slice = getPageSlice(records, currentPage)
  pageTotalEl.textContent = formatAmountArabic(slice.reduce((sum, r) => sum + r.amount, 0))
  const frag = document.createDocumentFragment()
  for (const r of slice) {
    const card = document.createElement('article')
    card.className = 'record-card'

    const fields = document.createElement('div')
    fields.className = 'record-fields'
    const name = document.createElement('p')
    name.className = 'record-value'
    name.textContent = r.name
    const amount = document.createElement('p')
    amount.className = 'record-value'
    amount.textContent =
      amountDisplayMode === 'traditional' ? formatAmount(r.amount) : formatAmountArabic(r.amount)

    const memo = document.createElement('p')
    memo.className = 'record-value'
    memo.textContent = r.memo || '—'
    fields.append(name, amount, memo)

    const actions = document.createElement('div')
    actions.className = 'record-actions'
    const edit = document.createElement('button')
    edit.type = 'button'
    edit.className = 'btn btn-secondary btn-sm'
    edit.textContent = '修改'
    edit.dataset.editId = r.id
    edit.setAttribute('aria-label', `修改 ${r.name} 的记录`)
    const del = document.createElement('button')
    del.type = 'button'
    del.className = 'btn btn-danger btn-sm'
    del.textContent = '删除'
    del.dataset.deleteId = r.id
    del.setAttribute('aria-label', `删除 ${r.name} 的记录`)
    actions.append(edit, del)

    card.append(fields, actions)
    frag.appendChild(card)
  }
  listEl.appendChild(frag)
}

mount()
