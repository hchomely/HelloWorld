export function formatAmount(n: number): string {
  const digits = ['零', '壹', '貳', '參', '肆', '伍', '陸', '柒', '捌', '玖']
  const smallUnits = ['', '拾', '佰', '仟']
  const bigUnits = ['', '萬', '億', '兆']

  const absFen = Math.round(Math.abs(n) * 100)
  const intPart = Math.floor(absFen / 100)
  const jiao = Math.floor((absFen % 100) / 10)
  const fen = absFen % 10

  const sectionToChinese = (section: number): string => {
    let s = ''
    let pos = 0
    let zero = true
    let value = section

    while (value > 0) {
      const digit = value % 10
      if (digit === 0) {
        if (!zero) {
          zero = true
          s = `零${s}`
        }
      } else {
        zero = false
        s = `${digits[digit]}${smallUnits[pos]}${s}`
      }
      pos += 1
      value = Math.floor(value / 10)
    }

    return s
  }

  const integerToChinese = (value: number): string => {
    if (value === 0) return digits[0]

    let out = ''
    let unitPos = 0
    let needZero = false
    let num = value

    while (num > 0) {
      const section = num % 10000
      if (section === 0) {
        if (out !== '') needZero = true
      } else {
        const sectionText = `${sectionToChinese(section)}${bigUnits[unitPos]}`
        if (needZero) {
          out = `零${out}`
          needZero = false
        }
        out = `${sectionText}${out}`
        if (section < 1000) needZero = true
      }
      num = Math.floor(num / 10000)
      unitPos += 1
    }

    return out.replace(/零+/g, '零').replace(/零$/g, '')
  }

  const integerText = integerToChinese(intPart)
  let decimalText = ''
  if (jiao !== 0 || fen !== 0) {
    if (jiao !== 0) decimalText += `${digits[jiao]}角`
    if (fen !== 0) {
      if (jiao === 0) decimalText += '零'
      decimalText += `${digits[fen]}分`
    }
  }

  const prefix = n < 0 ? '負' : ''
  return `${prefix}${integerText}元${decimalText}`
}

export function formatAmountArabic(n: number): string {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(n)
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso)
  return new Intl.DateTimeFormat('zh-CN', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(d)
}

export function fileDateStamp(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function toSafeFilenameStem(input: string, fallback: string): string {
  const cleaned = input
    .trim()
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/^_+|_+$/g, '')
  return cleaned || fallback
}
