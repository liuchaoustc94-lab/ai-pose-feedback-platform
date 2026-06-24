import {
  calculateAngle,
  extractMetrics,
  generateReport,
  type PoseLandmark,
  type PoseMetrics,
} from './poseMetrics'

function landmark(x: number, y: number, visibility = 0.95): PoseLandmark {
  return { x, y, visibility }
}

function makeLandmarks() {
  const landmarks = Array.from({ length: 33 }, () => landmark(0, 0, 0.95))

  landmarks[0] = landmark(0.5, 0.1)
  landmarks[11] = landmark(0.4, 0.3)
  landmarks[12] = landmark(0.6, 0.32)
  landmarks[13] = landmark(0.35, 0.45)
  landmarks[14] = landmark(0.65, 0.45)
  landmarks[15] = landmark(0.3, 0.6)
  landmarks[16] = landmark(0.7, 0.6)
  landmarks[23] = landmark(0.45, 0.6)
  landmarks[24] = landmark(0.55, 0.63)
  landmarks[25] = landmark(0.45, 0.78)
  landmarks[26] = landmark(0.55, 0.78)
  landmarks[27] = landmark(0.45, 0.94)
  landmarks[28] = landmark(0.55, 0.94)

  return landmarks
}

function metric(overrides: Partial<PoseMetrics> = {}): PoseMetrics {
  return {
    shoulderSymmetry: 1,
    hipSymmetry: 1,
    kneeAngle: { name: '膝关节角度', left: 170, right: 170, unit: '°' },
    elbowAngle: { name: '肘关节角度', left: null, right: null, unit: '°' },
    ankleAngle: { name: '踝关节角度', left: null, right: null, unit: '°' },
    hipAngle: { name: '髋关节角度', left: null, right: null, unit: '°' },
    centerOfGravity: { x: 0.5, y: 0.6 },
    headPosition: { x: 0.5, y: 0.1 },
    timestamp: 1_000,
    ...overrides,
  }
}

describe('poseMetrics', () => {
  it('calculates anatomical angles in degrees', () => {
    expect(calculateAngle({ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 })).toBe(90)
    expect(calculateAngle({ x: -1, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 0 })).toBe(180)
  })

  it('extracts symmetry, center of gravity, head position, and joint angles', () => {
    const metrics = extractMetrics({ poseLandmarks: makeLandmarks() }, 12345)

    expect(metrics).not.toBeNull()
    expect(metrics?.timestamp).toBe(12345)
    expect(metrics?.shoulderSymmetry).toBe(2)
    expect(metrics?.hipSymmetry).toBe(3)
    expect(metrics?.centerOfGravity).toEqual({ x: 0.5, y: 0.615 })
    expect(metrics?.headPosition).toEqual({ x: 0.5, y: 0.1 })
    expect(metrics?.kneeAngle.left).toBe(180)
    expect(metrics?.elbowAngle.right).toBeGreaterThan(150)
  })

  it('returns null when no pose landmarks are present', () => {
    expect(extractMetrics({ poseLandmarks: [] })).toBeNull()
    expect(extractMetrics({})).toBeNull()
  })

  it('ignores landmarks below the visibility threshold', () => {
    const landmarks = makeLandmarks()
    landmarks[11] = landmark(0.4, 0.3, 0.2)

    const metrics = extractMetrics({ poseLandmarks: landmarks })

    expect(metrics?.shoulderSymmetry).toBeNull()
    expect(metrics?.elbowAngle.left).toBeNull()
  })

  it('generates an empty-data report without recommendations that imply a real sample', () => {
    const report = generateReport([])

    expect(report.duration).toBe(0)
    expect(report.metrics).toEqual([])
    expect(report.summary.postureQuality).toBe('needs_improvement')
    expect(report.summary.recommendations).toEqual(['未检测到有效姿态数据，请重新进行测试'])
  })

  it('grades posture quality from averaged symmetry values and computes duration', () => {
    const report = generateReport([
      metric({ shoulderSymmetry: 2, hipSymmetry: 1, timestamp: 1_000 }),
      metric({ shoulderSymmetry: 4, hipSymmetry: 3, timestamp: 6_200 }),
    ])

    expect(report.summary.avgShoulderSymmetry).toBe(3)
    expect(report.summary.avgHipSymmetry).toBe(2)
    expect(report.summary.postureQuality).toBe('good')
    expect(report.duration).toBe(5)
    expect(report.startTime).toBe(1_000)
    expect(report.endTime).toBe(6_200)
  })

  it('adds knee findings for bent knees and default recommendations for good posture', () => {
    const report = generateReport([
      metric({
        shoulderSymmetry: 0.5,
        hipSymmetry: 0.5,
        kneeAngle: { name: '膝关节角度', left: 140, right: 155, unit: '°' },
      }),
    ])

    expect(report.summary.postureQuality).toBe('excellent')
    expect(report.summary.keyFindings).toContain('左膝关节角度为 140°，膝关节处于弯曲状态')
    expect(report.summary.keyFindings).toContain('右膝关节角度为 155°，膝关节处于弯曲状态')
    expect(report.summary.recommendations).toContain('整体姿态良好，建议保持当前训练计划')
  })
})
