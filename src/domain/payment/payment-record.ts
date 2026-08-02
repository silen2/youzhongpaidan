/**
 * 账单（资金流水）纯函数（需求文档第 5 章，账单化：入账/出账）。
 * 账单方向：in = 入账（收到客户的钱）；out = 出账（退单退款 / 红冲冲销）。
 *
 * 统计口径：
 * - monthReceived：本月入账合计（direction='in' 的记录 amount 总和）
 * - monthRefunded：本月出账合计（direction='out' 的记录 amount 总和，退单退款/红冲）
 * - monthNetIncome：本月净收入 = 本月入账到手 − 本月出账（退款会冲抵收入）
 * - pendingTotal：待收总额 = 所有待收订单「剩余应收的预计到手金额」合计
 *   （待收订单 = 非 completed / 非 voided；剩余应收 = max(0, expectedAmount − 已收定金 − 已收尾款)；
 *    到手金额 = 剩余应收按来源规则扣手续费）
 */
import { calcFee } from '@/domain/order/fee-calculator'

export const PAYMENT_RECORD_TYPES = ['deposit', 'final'] as const
export type PaymentRecordType = (typeof PAYMENT_RECORD_TYPES)[number]

export const PAYMENT_RECORD_TYPE_LABEL: Record<PaymentRecordType, string> = {
  deposit: '定金',
  final: '尾款',
}

export const PAYMENT_DIRECTIONS = ['in', 'out'] as const
export type PaymentDirection = (typeof PAYMENT_DIRECTIONS)[number]

export const PAYMENT_DIRECTION_LABEL: Record<PaymentDirection, string> = {
  in: '入账',
  out: '出账',
}

export function isPaymentType(v: unknown): v is PaymentRecordType {
  return typeof v === 'string' && (PAYMENT_RECORD_TYPES as readonly string[]).includes(v)
}

export function paymentTypeLabel(v: unknown): string {
  return isPaymentType(v) ? PAYMENT_RECORD_TYPE_LABEL[v] : '—'
}

export function isPaymentDirection(v: unknown): v is PaymentDirection {
  return typeof v === 'string' && (PAYMENT_DIRECTIONS as readonly string[]).includes(v)
}

export function paymentDirectionLabel(v: unknown): string {
  return isPaymentDirection(v) ? PAYMENT_DIRECTION_LABEL[v] : '—'
}

/** 订单是否仍可收款（新建入账可选关联）。已结清订单不可再收：
 * - 订单已完成（completed）或已退单（voided）
 * - 收款状态已结清（final_paid）或免收（waived） */
export function isOrderCollectible(order: {
  orderStatus?: string
  paymentStatus?: string
}): boolean {
  if (order.orderStatus === 'completed' || order.orderStatus === 'voided') return false
  if (order.paymentStatus === 'final_paid' || order.paymentStatus === 'waived') return false
  return true
}

/** 订单是否可退款（退单后需要把已收的钱退回）：仅当订单已退单（voided）且存在入账流水时。
 * @param records 该订单的全部账单（含入账/出账）；存在有效入账（未被红冲）记录即可退款 */
export function isOrderRefundable(order: {
  orderStatus?: string
}, records: PaymentRecordLike[]): boolean {
  if (order.orderStatus !== 'voided') return false
  return activeInRecords(records).some(r => isFinite(r.amount) && r.amount > 0)
}

/** 订单可退金额 = 有效入账合计 − 手动退款出账合计（仅已入账部分可退）：
 * - 已被红冲的入账（存在 refundOf 指向它的出账）不再视为实收，不计入
 * - 红冲出账（refundOf 有值）只是冲销标记，不额外计入出账 */
export function orderRefundableAmount(records: PaymentRecordLike[]): number {
  const reversedIds = reversedInIds(records)
  let net = 0
  for (const r of records) {
    const amount = isFinite(r.amount) ? r.amount : 0
    if (r.direction === 'out') {
      if (r.refundOf) continue
      net -= amount
    } else {
      if (r.id && reversedIds.has(r.id)) continue
      net += amount
    }
  }
  return round2(Math.max(0, net))
}

/** 已被红冲的入账 id 集合（存在出账账单的 refundOf 指向它） */
function reversedInIds(records: PaymentRecordLike[]): Set<string> {
  return new Set(records.filter(r => r.direction === 'out' && r.refundOf).map(r => r.refundOf as string))
}

/** 有效入账流水：排除出账与已被红冲的入账 */
function activeInRecords(records: PaymentRecordLike[]): PaymentRecordLike[] {
  const reversedIds = reversedInIds(records)
  return records.filter(r => r.direction !== 'out' && !(r.id && reversedIds.has(r.id)))
}

/** 流水变更（新增/删除/编辑/红冲）后，按订单剩余入账流水重算订单收款字段的补丁。
 * 出账（退款/红冲）不改变订单收款状态——退单订单保持 voided，其收款历史保留。 */
export interface OrderPaymentPatch {
  paymentStatus: string
  orderStatus?: string
  depositActual: number
  depositPaidAt?: string
  finalActual: number
  finalPaidAt?: string
  /** 实收金额 = 定金实收 + 尾款实收（红冲/编辑后随剩余入账同步，供客户统计/权重/实付排序） */
  actualAmount: number
}

export function recomputeOrderPaymentPatch(
  order: { orderStatus?: string; paymentStatus?: string },
  records: PaymentRecordLike[],
): OrderPaymentPatch {
  // 只计有效入账流水（出账与已被红冲的入账不改变订单收款状态）
  const ins = activeInRecords(records)
  const deposits = ins.filter(r => r.type === 'deposit')
  const finals = ins.filter(r => r.type === 'final')
  const sum = (arr: PaymentRecordLike[]) =>
    round2(arr.reduce((s, r) => s + (isFinite(r.amount) ? r.amount : 0), 0))
  const lastAt = (arr: PaymentRecordLike[]) => (arr.length > 0 ? arr[arr.length - 1].receivedAt : undefined)

  const depositActual = sum(deposits)
  const finalActual = sum(finals)

  // 收款状态：仅当原状态是「已收定金/已收尾款」时按剩余入账重算；
  // 欠款/免收/待付为手动语义，不因流水删除而改变
  let paymentStatus = order.paymentStatus ?? 'unpaid'
  if (order.paymentStatus === 'deposit_paid' || order.paymentStatus === 'final_paid') {
    if (finals.length > 0) paymentStatus = 'final_paid'
    else if (deposits.length > 0) paymentStatus = 'deposit_paid'
    else paymentStatus = 'unpaid'
  }

  // 工作状态：结单（completed）是由收尾款触发的——尾款入账被冲销后回退「待付尾款」；
  // 其他工作阶段（未开始/进行中）属绘制进度，不因流水删除而回退
  let orderStatus: string | undefined
  if (paymentStatus !== 'final_paid' && order.orderStatus === 'completed') {
    orderStatus = 'awaiting_final'
  }

  return {
    paymentStatus,
    ...(orderStatus ? { orderStatus } : {}),
    depositActual,
    depositPaidAt: lastAt(deposits),
    finalActual,
    finalPaidAt: lastAt(finals),
    actualAmount: round2(depositActual + finalActual),
  }
}

/**
 * 收款单号生成（纯函数）。
 * 格式：RC + YY + MM + DD + 3位随机数字（与订单编号 HT 前缀同风格）
 * 示例：RC260801001
 */
export function generateRecordNo(now: Date = new Date()): string {
  const year = now.getFullYear().toString().slice(-2)
  const month = (now.getMonth() + 1).toString().padStart(2, '0')
  const day = now.getDate().toString().padStart(2, '0')
  const seq = Math.floor(Math.random() * 1000).toString().padStart(3, '0')
  return `RC${year}${month}${day}${seq}`
}

export interface PaymentRecordLike {
  id?: string
  orderId: string
  type?: string
  direction?: string
  refundOf?: string
  amount: number
  receivedAt: string
}

export interface OrderLikeForPayment {
  id: string
  sourceId?: string
  orderStatus: string
  expectedAmount: number
  depositActual: number
  finalActual: number
}

export interface SourceLikeForPayment {
  feeType: 'percentage' | 'fixed'
  feeValue: number
}

export interface PaymentStats {
  /** 本月入账（有效入账的到手金额合计：排除被红冲入账、扣手续费）——实收口径 */
  monthReceived: number
  /** 本月出账（手动退款出账合计；红冲是冲销不计）——实出口径 */
  monthRefunded: number
  /** 本月净收入（入账到手 − 出账） */
  monthNetIncome: number
  /** 待收总额（待收订单剩余应收的到手金额合计） */
  pendingTotal: number
}

/**
 * 计算账单统计指标（实收口径，四卡口径一致——都按「实际到手金额」计）：
 * - monthReceived：入账 = 有效入账的到手金额合计
 *   （排除被红冲的入账——红冲是纠错已全额退回；扣手续费后为实收）
 * - monthRefunded：出账 = 手动退款出账合计（红冲是冲销不是实出，不计）
 * - monthNetIncome：净收入 = 入账到手 − 出账
 * - pendingTotal：待收总额 = 传入订单中待收订单「剩余应收的预计到手金额」合计（与上面同为到手口径）
 * 红冲对（被红冲入账 + 红冲出账）在统计中互抵为 0；账本明细仍保留两笔（审计痕迹）。
 * @param records 账单记录（调用方决定范围：固定本月全量 or 跟随筛选结果）
 * @param orders 订单（用于查记录对应订单的来源与待收口径；待收只统计传入订单）
 * @param sourceOf 按 sourceId 查来源模板；查不到返回 null（0 手续费）
 * @param today 当前时间；传 null 时不过滤月份，统计全部传入记录（跟随筛选用）
 */
export function computePaymentStats(
  records: PaymentRecordLike[],
  orders: OrderLikeForPayment[],
  sourceOf: (sourceId: string | undefined) => SourceLikeForPayment | null | undefined,
  today: Date | null,
): PaymentStats {
  const orderMap = new Map(orders.map(o => [o.id, o]))
  // today 为 null 时统计全部传入记录（跟随筛选）；否则只统计该月
  const monthKey = today ? `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}` : null
  // 已被红冲的入账 id 集合（红冲记录 refundOf 指向它们）
  const reversedIds = new Set(records.filter(r => r.direction === 'out' && r.refundOf).map(r => r.refundOf as string))

  let monthReceived = 0
  let monthRefunded = 0
  let monthNetIncome = 0

  for (const r of records) {
    if (monthKey && (!r.receivedAt || r.receivedAt.slice(0, 7) !== monthKey)) continue
    const amount = isFinite(r.amount) ? r.amount : 0
    if (r.direction === 'out') {
      // 红冲是冲销不是实出，不计入出账
      if (r.refundOf) continue
      monthRefunded += amount
      monthNetIncome -= amount
    } else {
      // 被红冲的入账已全额退回，不计入入账（红冲对在统计中互抵）
      if (r.id && reversedIds.has(r.id)) continue
      const order = orderMap.get(r.orderId)
      const source = order ? sourceOf(order.sourceId) : null
      const net = amount - calcFee(amount, source).feeAmount
      monthReceived += net
      monthNetIncome += net
    }
  }

  let pendingTotal = 0
  for (const o of orders) {
    if (o.orderStatus === 'completed' || o.orderStatus === 'voided') continue
    const remaining = Math.max(
      0,
      (isFinite(o.expectedAmount) ? o.expectedAmount : 0) -
        (isFinite(o.depositActual) ? o.depositActual : 0) -
        (isFinite(o.finalActual) ? o.finalActual : 0),
    )
    if (remaining <= 0) continue
    const source = sourceOf(o.sourceId)
    pendingTotal += calcFee(remaining, source).actualAmount
  }

  return {
    monthReceived: round2(monthReceived),
    monthRefunded: round2(monthRefunded),
    monthNetIncome: round2(monthNetIncome),
    pendingTotal: round2(pendingTotal),
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
