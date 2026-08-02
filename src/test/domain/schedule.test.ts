import { describe, it, expect } from 'vitest'
import { deriveScheduleProgress, buildActualWriteBack, buildStageSegments, toLocalDay, PENDING_STAGE, DONE_STAGE } from '@/domain/schedule/schedule-progress'
import { computeScheduleStatus, SCHEDULE_STATUS_LABEL } from '@/domain/schedule/schedule-status'
import type { ScheduleProgress } from '@/domain/schedule/schedule-progress'

/** 构造一条流转记录 */
function tr(toStageId: string, date: string) {
  return { toStageId, transitionDate: date }
}

const noProgress: ScheduleProgress = { actualStartDate: null, actualEndDate: null, started: false, finished: false }

describe('schedule-progress', () => {
  describe('toLocalDay', () => {
    it('截取 ISO 时间戳日期部分', () => {
      expect(toLocalDay('2026-08-01T10:00:00.000Z')).toBe('2026-08-01')
      expect(toLocalDay('2026-08-01')).toBe('2026-08-01')
    })
    it('非法输入返回 null', () => {
      expect(toLocalDay(null)).toBeNull()
      expect(toLocalDay(undefined)).toBeNull()
      expect(toLocalDay('')).toBeNull()
      expect(toLocalDay('abc')).toBeNull()
    })
  })

  describe('deriveScheduleProgress', () => {
    it('未开工：仅有进入待开始的记录 → started=false', () => {
      const p = deriveScheduleProgress([tr(PENDING_STAGE, '2026-08-01')])
      expect(p.started).toBe(false)
      expect(p.actualStartDate).toBeNull()
      expect(p.finished).toBe(false)
    })

    it('第一次离开待开始即开工', () => {
      const p = deriveScheduleProgress([
        tr(PENDING_STAGE, '2026-08-01'),
        tr('st-line', '2026-08-03'),
      ])
      expect(p.started).toBe(true)
      expect(p.actualStartDate).toBe('2026-08-03')
      expect(p.finished).toBe(false)
    })

    it('多次离开待开始（回到待开始再离开）只记第一次开工', () => {
      const p = deriveScheduleProgress([
        tr(PENDING_STAGE, '2026-08-01'),
        tr('st-line', '2026-08-03'),
        tr(PENDING_STAGE, '2026-08-05'), // 回退待开始（正常业务已禁止，兜底场景）
        tr('st-color', '2026-08-07'),
      ])
      expect(p.started).toBe(true)
      expect(p.actualStartDate).toBe('2026-08-03')
    })

    it('进完成栏 = 完工，回写结束日期', () => {
      const p = deriveScheduleProgress([
        tr(PENDING_STAGE, '2026-08-01'),
        tr('st-line', '2026-08-03'),
        tr(DONE_STAGE, '2026-08-10'),
      ])
      expect(p.started).toBe(true)
      expect(p.finished).toBe(true)
      expect(p.actualStartDate).toBe('2026-08-03')
      expect(p.actualEndDate).toBe('2026-08-10')
    })

    it('跳步订单：待开始直接到完成 → 开工=完工=进完成栏日', () => {
      const p = deriveScheduleProgress([
        tr(PENDING_STAGE, '2026-08-01'),
        tr(DONE_STAGE, '2026-08-10'),
      ])
      expect(p.started).toBe(true)
      expect(p.finished).toBe(true)
      expect(p.actualStartDate).toBe('2026-08-10')
      expect(p.actualEndDate).toBe('2026-08-10')
    })

    it('空记录 → 未开工未完工', () => {
      const p = deriveScheduleProgress([])
      expect(p).toEqual(noProgress)
    })
  })

  describe('buildActualWriteBack', () => {
    it('完工后返回回写字段', () => {
      const order = { actualStartDate: undefined, actualEndDate: undefined }
      const progress: ScheduleProgress = {
        actualStartDate: '2026-08-03',
        actualEndDate: '2026-08-10',
        started: true,
        finished: true,
      }
      expect(buildActualWriteBack(order, progress)).toEqual({
        actualStartDate: '2026-08-03',
        actualEndDate: '2026-08-10',
      })
    })

    it('已回写过且无变化 → 返回 null', () => {
      const order = { actualStartDate: '2026-08-03', actualEndDate: '2026-08-10' }
      const progress: ScheduleProgress = {
        actualStartDate: '2026-08-03',
        actualEndDate: '2026-08-10',
        started: true,
        finished: true,
      }
      expect(buildActualWriteBack(order, progress)).toBeNull()
    })

    it('未完工 → 返回 null', () => {
      const order = { actualStartDate: undefined, actualEndDate: undefined }
      expect(buildActualWriteBack(order, noProgress)).toBeNull()
    })
  })

  describe('buildStageSegments', () => {
    const now = new Date('2026-08-02T12:00:00').getTime()

    it('按流转时刻依次切段，最后一段到今天日末', () => {
      const segs = buildStageSegments(
        [
          { toStageId: 'st-design', toStageName: '设计', toStageColor: '#aabbcc', transitionDate: '2026-07-01T10:00:00' },
          { toStageId: 'st-draw', toStageName: '绘制', toStageColor: '#ddeeff', transitionDate: '2026-07-10T09:00:00' },
        ],
        now,
      )
      expect(segs).toHaveLength(2)
      expect(segs[0]).toEqual({
        stageName: '设计', color: '#aabbcc',
        startTs: new Date('2026-07-01T10:00:00').getTime(),
        endTs: new Date('2026-07-10T09:00:00').getTime(),
      })
      // 最后一段：未完工 → 今天日末（08-03 00:00 本地）
      expect(segs[1]).toEqual({
        stageName: '绘制', color: '#ddeeff',
        startTs: new Date('2026-07-10T09:00:00').getTime(),
        endTs: new Date(2026, 7, 3).getTime(),
      })
    })

    it('进入待开始阶段不产生分段', () => {
      const segs = buildStageSegments([tr(PENDING_STAGE, '2026-08-01')], now)
      expect(segs).toEqual([])
    })

    it('完工：最后一段到完工时刻，完成栏自身零宽被跳过', () => {
      const segs = buildStageSegments(
        [
          { toStageId: 'st-design', toStageName: '设计', toStageColor: '#1', transitionDate: '2026-07-01T09:00:00' },
          { toStageId: DONE_STAGE, toStageName: '完成', toStageColor: '#2', transitionDate: '2026-07-20T18:00:00' },
        ],
        now,
      )
      expect(segs).toEqual([
        {
          stageName: '设计', color: '#1',
          startTs: new Date('2026-07-01T09:00:00').getTime(),
          endTs: new Date('2026-07-20T18:00:00').getTime(),
        },
      ])
    })

    it('跳步订单（待开始直进完成）无实际分段', () => {
      const segs = buildStageSegments([tr(DONE_STAGE, '2026-07-20')], now)
      expect(segs).toEqual([])
    })

    it('同日内的反复流转（色稿→草稿→色稿）各自成段，不塌缩', () => {
      const segs = buildStageSegments(
        [
          { toStageId: 'st-sketch', toStageName: '草稿', toStageColor: '#c', transitionDate: '2026-08-01T09:00:00' },
          { toStageId: 'st-color', toStageName: '色稿', toStageColor: '#b', transitionDate: '2026-08-01T14:00:00' },
          { toStageId: 'st-sketch', toStageName: '草稿', toStageColor: '#c', transitionDate: '2026-08-01T16:30:00' },
        ],
        now,
      )
      expect(segs).toHaveLength(3)
      expect(segs[0]).toEqual({
        stageName: '草稿', color: '#c',
        startTs: new Date('2026-08-01T09:00:00').getTime(),
        endTs: new Date('2026-08-01T14:00:00').getTime(),
      })
      expect(segs[1]).toEqual({
        stageName: '色稿', color: '#b',
        startTs: new Date('2026-08-01T14:00:00').getTime(),
        endTs: new Date('2026-08-01T16:30:00').getTime(),
      })
      expect(segs[2]).toEqual({
        stageName: '草稿', color: '#c',
        startTs: new Date('2026-08-01T16:30:00').getTime(),
        endTs: new Date(2026, 7, 3).getTime(), // 今天日末
      })
    })

    it('阶段往复时按每次进入切段，颜色取对应流转记录', () => {
      const segs = buildStageSegments(
        [
          { toStageId: 'a', toStageName: 'A', toStageColor: '#a', transitionDate: '2026-07-01T09:00:00' },
          { toStageId: 'b', toStageName: 'B', toStageColor: '#b', transitionDate: '2026-07-05T10:00:00' },
          { toStageId: 'a', toStageName: 'A', toStageColor: '#a', transitionDate: '2026-07-10T11:00:00' },
        ],
        now,
      )
      expect(segs.map(s => s.stageName)).toEqual(['A', 'B', 'A'])
      expect(segs[2].endTs).toBe(new Date(2026, 7, 3).getTime())
    })

    it("'YYYY-MM-DD' 流转时间按本地 0 点解析", () => {
      const segs = buildStageSegments(
        [{ toStageId: 'a', toStageName: 'A', toStageColor: '#a', transitionDate: '2026-07-28' }],
        now,
      )
      expect(segs[0].startTs).toBe(new Date('2026-07-28T00:00:00').getTime())
    })

    it('非法时间戳被跳过', () => {
      const segs = buildStageSegments(
        [{ toStageId: 'a', toStageName: 'A', toStageColor: '#a', transitionDate: 'not-a-date' }],
        now,
      )
      expect(segs).toEqual([])
    })

    it('空记录 → 无分段', () => {
      expect(buildStageSegments([], now)).toEqual([])
    })
  })
})

describe('schedule-status', () => {
  it('未开工：有排期但仍在待开始', () => {
    expect(computeScheduleStatus('2026-08-01', '2026-08-10', noProgress, '2026-08-05')).toBe('not_started')
  })

  it('进行中：已开工未完工且未超期', () => {
    const progress: ScheduleProgress = { actualStartDate: '2026-08-03', actualEndDate: null, started: true, finished: false }
    expect(computeScheduleStatus('2026-08-01', '2026-08-20', progress, '2026-08-10')).toBe('in_progress')
  })

  it('超期：expectedEnd 已过且未完工', () => {
    const progress: ScheduleProgress = { actualStartDate: '2026-08-03', actualEndDate: null, started: true, finished: false }
    expect(computeScheduleStatus('2026-08-01', '2026-08-10', progress, '2026-08-15')).toBe('overdue')
  })

  it('待开始未开工也可能超期', () => {
    expect(computeScheduleStatus('2026-08-01', '2026-08-05', noProgress, '2026-08-10')).toBe('overdue')
  })

  it('完工（按期/逾期）→ completed', () => {
    const progress: ScheduleProgress = { actualStartDate: '2026-08-03', actualEndDate: '2026-08-10', started: true, finished: true }
    expect(computeScheduleStatus('2026-08-01', '2026-08-10', progress, '2026-08-15')).toBe('completed')
  })

  it('提前完工 → completed_early', () => {
    const progress: ScheduleProgress = { actualStartDate: '2026-08-03', actualEndDate: '2026-08-10', started: true, finished: true }
    expect(computeScheduleStatus('2026-08-01', '2026-08-20', progress, '2026-08-15')).toBe('completed_early')
  })

  it('状态标签完整', () => {
    expect(SCHEDULE_STATUS_LABEL).toMatchObject({
      not_started: '未开工',
      in_progress: '进行中',
      overdue: '超期',
      completed: '已完工',
      completed_early: '提前完工',
    })
  })
})
