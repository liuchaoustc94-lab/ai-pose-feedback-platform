import {
  clearArchiveRecords,
  createAnonymousId,
  readArchiveIdentity,
  readArchiveRecords,
  saveArchiveIdentity,
  savePoseReportToArchive,
  writeArchiveRecords,
  type TrainingArchiveRecord,
} from './trainingArchive'
import type { PoseReport } from './poseMetrics'

function report(overrides: Partial<PoseReport> = {}): PoseReport {
  return {
    metrics: [
      {
        shoulderSymmetry: 2,
        hipSymmetry: 3,
        kneeAngle: { name: '膝关节角度', left: 170, right: 171, unit: '°' },
        elbowAngle: { name: '肘关节角度', left: null, right: null, unit: '°' },
        ankleAngle: { name: '踝关节角度', left: null, right: null, unit: '°' },
        hipAngle: { name: '髋关节角度', left: null, right: null, unit: '°' },
        centerOfGravity: { x: 0.5, y: 0.5 },
        headPosition: { x: 0.5, y: 0.1 },
        timestamp: 1_000,
      },
    ],
    summary: {
      avgShoulderSymmetry: 2,
      avgHipSymmetry: 3,
      postureQuality: 'good',
      recommendations: ['保持训练'],
      keyFindings: ['对称性良好'],
    },
    duration: 8,
    startTime: 1_000,
    endTime: 9_000,
    ...overrides,
  }
}

function record(index: number): TrainingArchiveRecord {
  return {
    id: `record-${index}`,
    anonymousId: 'A-001',
    moduleCode: 'F2.1',
    moduleTitle: '单腿站立平衡测试',
    timestamp: index,
    duration: 5,
    avgShoulderSymmetry: 1,
    avgHipSymmetry: 1,
    postureQuality: 'excellent',
    keyFindings: [],
    recommendations: [],
    sampleCount: 1,
  }
}

describe('trainingArchive', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('creates stable anonymous IDs from normalized class and student number', () => {
    expect(createAnonymousId(' 体教 2401 ', ' 01 ')).toBe(createAnonymousId('体教2401', '01'))
    expect(createAnonymousId('', '')).toMatch(/^CLASS-[A-Z0-9]{6}$/)
  })

  it('persists and reads archive identity', () => {
    const identity = saveArchiveIdentity('体教2401', '01')

    expect(identity.className).toBe('体教2401')
    expect(identity.studentNo).toBe('01')
    expect(readArchiveIdentity()).toEqual(identity)
  })

  it('returns null or empty arrays for missing and corrupt localStorage values', () => {
    localStorage.setItem('ai-feedback-training-identity', '{bad json')
    localStorage.setItem('ai-feedback-training-records', '{bad json')

    expect(readArchiveIdentity()).toBeNull()
    expect(readArchiveRecords()).toEqual([])
  })

  it('saves pose reports to the active identity archive', () => {
    const identity = saveArchiveIdentity('体教2401', '01')
    const saved = savePoseReportToArchive(report(), 'F4.1', '关节点轨迹分析')

    expect(saved).toMatchObject({
      anonymousId: identity.anonymousId,
      moduleCode: 'F4.1',
      moduleTitle: '关节点轨迹分析',
      duration: 8,
      sampleCount: 1,
    })
    expect(readArchiveRecords()).toHaveLength(1)
  })

  it('does not archive reports without valid samples', () => {
    const saved = savePoseReportToArchive(report({ metrics: [] }), 'F2.1', '单腿站立平衡测试')

    expect(saved).toBeNull()
    expect(readArchiveRecords()).toEqual([])
  })

  it('deduplicates records by generated id and keeps the latest first', () => {
    saveArchiveIdentity('体教2401', '01')
    savePoseReportToArchive(report({ endTime: 9_000, duration: 8 }), 'F2.1', '单腿站立平衡测试')
    savePoseReportToArchive(report({ endTime: 10_000, duration: 9 }), 'F2.1', '单腿站立平衡测试')
    savePoseReportToArchive(report({ endTime: 10_000, duration: 11 }), 'F2.1', '单腿站立平衡测试')

    const records = readArchiveRecords()

    expect(records).toHaveLength(2)
    expect(records[0]).toMatchObject({ id: 'F2.1-10000', duration: 11 })
    expect(records[1]).toMatchObject({ id: 'F2.1-9000', duration: 8 })
  })

  it('caps stored records to 200 and can clear them', () => {
    writeArchiveRecords(Array.from({ length: 201 }, (_, index) => record(index)))
    savePoseReportToArchive(report({ endTime: 999_000 }), 'F4.2', '动作稳定性分析', {
      className: '体教2401',
      studentNo: '01',
      anonymousId: 'A-001',
    })

    expect(readArchiveRecords()).toHaveLength(200)

    clearArchiveRecords()
    expect(readArchiveRecords()).toEqual([])
  })
})
