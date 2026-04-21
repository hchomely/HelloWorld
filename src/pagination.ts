export const PAGE_SIZE = 10

export function chunkRecords<T>(arr: T[], size: number = PAGE_SIZE): T[][] {
  if (arr.length === 0) return []
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size))
  }
  return out
}

export function totalPages(count: number, size: number = PAGE_SIZE): number {
  if (count <= 0) return 1
  return Math.ceil(count / size)
}

export function getPageSlice<T>(arr: T[], page: number, size: number = PAGE_SIZE): T[] {
  const p = Math.max(1, page)
  const start = (p - 1) * size
  return arr.slice(start, start + size)
}

export function clampPage(page: number, count: number, size: number = PAGE_SIZE): number {
  const tp = totalPages(count, size)
  return Math.min(Math.max(1, page), tp)
}
