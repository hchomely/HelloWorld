import type { GiftOperationLog, GiftRecord } from './types'

const STORAGE_KEY = 'gift-ledger-v1'
const OP_LOG_API = (import.meta.env.VITE_LOG_API_URL ?? 'http://localhost:3001') + '/api/operation-logs'
const THEME_KEY = 'gift-ledger-theme-v1'

export function loadRecords(): GiftRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isGiftRecord)
  } catch {
    return []
  }
}

export function saveRecords(records: GiftRecord[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records))
}

export function loadThemeTitle(): string {
  try {
    const raw = localStorage.getItem(THEME_KEY)
    if (!raw) return ''
    return typeof raw === 'string' ? raw : ''
  } catch {
    return ''
  }
}

export function saveThemeTitle(title: string): void {
  localStorage.setItem(THEME_KEY, title)
}

export function appendOperationLog(log: GiftOperationLog): void {
  void (async () => {
    try {
      const res = await fetch(OP_LOG_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(log),
      })
      if (!res.ok) {
        const detail = await res.text()
        throw new Error(`写入失败(${res.status}): ${detail}`)
      }
    } catch (err: unknown) {
      console.error('写入操作日志失败：', err)
    }
  })()
}

export async function importRecordsFromOperationLogs(): Promise<{
  records: GiftRecord[]
  themeTitle: string
}> {
  const logs = await fetchOperationLogs()
  return replayOperationLogs(logs)
}

export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function isGiftRecord(x: unknown): x is GiftRecord {
  if (x === null || typeof x !== 'object') return false
  const o = x as Record<string, unknown>
  return (
    typeof o.id === 'string' &&
    typeof o.name === 'string' &&
    typeof o.amount === 'number' &&
    Number.isFinite(o.amount) &&
    typeof o.memo === 'string' &&
    typeof o.createdAt === 'string'
  )
}

function isOperationLog(x: unknown): x is GiftOperationLog {
  if (x === null || typeof x !== 'object') return false
  const o = x as Record<string, unknown>
  const typeOk =
    o.type === 'add' || o.type === 'update' || o.type === 'delete' || o.type === 'theme_update'
  const beforeOk = o.before === undefined || isGiftRecord(o.before)
  const afterOk = o.after === undefined || isGiftRecord(o.after)
  return (
    typeof o.id === 'string' &&
    typeOk &&
    typeof o.createdAt === 'string' &&
    typeof o.recordId === 'string' &&
    beforeOk &&
    afterOk
  )
}

async function fetchOperationLogs(): Promise<GiftOperationLog[]> {
  const res = await fetch(OP_LOG_API)
  if (!res.ok) {
    throw new Error(`读取日志失败: ${res.status}`)
  }
  const data = (await res.json()) as unknown
  if (!Array.isArray(data)) return []
  return data.filter(isOperationLog)
}

function replayOperationLogs(logs: GiftOperationLog[]): {
  records: GiftRecord[]
  themeTitle: string
} {
  const ordered = [...logs].sort((a, b) => {
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  })
  const map = new Map<string, GiftRecord>()
  let themeTitle = ''

  for (const log of ordered) {
    if (log.type === 'theme_update') {
      if (typeof log.afterThemeTitle === 'string') {
        themeTitle = log.afterThemeTitle.trim()
      }
      continue
    }
    if (log.type === 'add' || log.type === 'update') {
      if (log.after) {
        map.set(log.after.id, { ...log.after })
      }
      continue
    }
    map.delete(log.recordId)
  }

  return {
    records: [...map.values()].sort((a, b) => {
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    }),
    themeTitle,
  }
}
