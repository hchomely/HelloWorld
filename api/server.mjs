import cors from 'cors'
import express from 'express'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const app = express()
const port = Number(process.env.PORT ?? 3001)
const __dirname = dirname(fileURLToPath(import.meta.url))
const logFile = resolve(__dirname, '../data/operation-logs.json')
const maxLogs = 5000

app.use(cors())
app.use(express.json({ limit: '1mb' }))

app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})

app.get('/api/operation-logs', async (_req, res) => {
  try {
    const logs = await readLogs()
    res.json(logs)
  } catch (err) {
    res.status(500).json({ error: '读取日志失败', detail: String(err) })
  }
})

app.post('/api/operation-logs', async (req, res) => {
  const log = req.body
  if (!isOperationLogLike(log)) {
    res.status(400).json({ error: '日志格式不正确' })
    return
  }

  try {
    const logs = await readLogs()
    logs.push(log)
    const finalLogs = logs.length > maxLogs ? logs.slice(-maxLogs) : logs
    await writeLogs(finalLogs)
    res.status(201).json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: '写入日志失败', detail: String(err) })
  }
})

app.listen(port, () => {
  console.log(`Operation log API listening on http://localhost:${port}`)
})

function isOperationLogLike(x) {
  if (!x || typeof x !== 'object') return false
  const t = x.type
  const typeOk = t === 'add' || t === 'update' || t === 'delete' || t === 'theme_update'
  return (
    typeof x.id === 'string' &&
    typeOk &&
    typeof x.createdAt === 'string' &&
    typeof x.recordId === 'string'
  )
}

async function readLogs() {
  await ensureLogFile()
  const raw = await readFile(logFile, 'utf8')
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

async function writeLogs(logs) {
  await ensureLogFile()
  await writeFile(logFile, `${JSON.stringify(logs, null, 2)}\n`, 'utf8')
}

async function ensureLogFile() {
  await mkdir(dirname(logFile), { recursive: true })
  try {
    await readFile(logFile, 'utf8')
  } catch {
    await writeFile(logFile, '[]\n', 'utf8')
  }
}
