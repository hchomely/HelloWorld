export type GiftRecord = {
  id: string
  name: string
  amount: number
  memo: string
  createdAt: string
}

export type GiftOperationType = 'add' | 'update' | 'delete' | 'theme_update'

export type GiftOperationLog = {
  id: string
  type: GiftOperationType
  createdAt: string
  recordId: string
  before?: GiftRecord
  after?: GiftRecord
  beforeThemeTitle?: string
  afterThemeTitle?: string
}
