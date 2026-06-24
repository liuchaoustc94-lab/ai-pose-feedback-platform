export interface PoseLandmark {
  x: number
  y: number
  visibility?: number
}

export interface PoseResultsLike {
  poseLandmarks?: PoseLandmark[]
}

export interface JointAngle {
  name: string
  left: number | null
  right: number | null
  unit: string
}

export interface PoseMetrics {
  shoulderSymmetry: number | null
  hipSymmetry: number | null
  kneeAngle: JointAngle
  elbowAngle: JointAngle
  ankleAngle: JointAngle
  hipAngle: JointAngle
  centerOfGravity: { x: number; y: number } | null
  headPosition: { x: number; y: number } | null
  timestamp: number
}

export interface PoseReport {
  metrics: PoseMetrics[]
  summary: {
    avgShoulderSymmetry: number
    avgHipSymmetry: number
    postureQuality: 'excellent' | 'good' | 'fair' | 'needs_improvement'
    recommendations: string[]
    keyFindings: string[]
  }
  duration: number
  startTime: number
  endTime: number
}

export function calculateAngle(
  a: { x: number; y: number },
  b: { x: number; y: number },
  c: { x: number; y: number }
): number {
  const radians =
    Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x)
  let angle = Math.abs((radians * 180.0) / Math.PI)
  if (angle > 180) angle = 360 - angle
  return Math.round(angle)
}

export function isVisibleLandmark(landmark: PoseLandmark | undefined): landmark is PoseLandmark {
  return !!landmark && typeof landmark.visibility === 'number' && landmark.visibility > 0.5
}

export function extractMetrics(results: PoseResultsLike, timestamp = Date.now()): PoseMetrics | null {
  if (!results.poseLandmarks || results.poseLandmarks.length === 0) return null

  const lm = results.poseLandmarks

  const leftShoulder = lm[11]
  const rightShoulder = lm[12]
  const leftElbow = lm[13]
  const rightElbow = lm[14]
  const leftWrist = lm[15]
  const rightWrist = lm[16]
  const leftHip = lm[23]
  const rightHip = lm[24]
  const leftKnee = lm[25]
  const rightKnee = lm[26]
  const leftAnkle = lm[27]
  const rightAnkle = lm[28]
  const nose = lm[0]

  const kneeAngle: JointAngle = {
    name: '膝关节角度',
    left: isVisibleLandmark(leftHip) && isVisibleLandmark(leftKnee) && isVisibleLandmark(leftAnkle)
      ? calculateAngle(leftHip, leftKnee, leftAnkle)
      : null,
    right: isVisibleLandmark(rightHip) && isVisibleLandmark(rightKnee) && isVisibleLandmark(rightAnkle)
      ? calculateAngle(rightHip, rightKnee, rightAnkle)
      : null,
    unit: '°',
  }

  const elbowAngle: JointAngle = {
    name: '肘关节角度',
    left: isVisibleLandmark(leftShoulder) && isVisibleLandmark(leftElbow) && isVisibleLandmark(leftWrist)
      ? calculateAngle(leftShoulder, leftElbow, leftWrist)
      : null,
    right: isVisibleLandmark(rightShoulder) && isVisibleLandmark(rightElbow) && isVisibleLandmark(rightWrist)
      ? calculateAngle(rightShoulder, rightElbow, rightWrist)
      : null,
    unit: '°',
  }

  const ankleAngle: JointAngle = {
    name: '踝关节角度',
    left: isVisibleLandmark(leftKnee) && isVisibleLandmark(leftAnkle)
      ? calculateAngle(leftKnee, leftAnkle, { x: leftAnkle.x, y: leftAnkle.y + 0.1 })
      : null,
    right: isVisibleLandmark(rightKnee) && isVisibleLandmark(rightAnkle)
      ? calculateAngle(rightKnee, rightAnkle, { x: rightAnkle.x, y: rightAnkle.y + 0.1 })
      : null,
    unit: '°',
  }

  const hipAngle: JointAngle = {
    name: '髋关节角度',
    left: isVisibleLandmark(leftShoulder) && isVisibleLandmark(leftHip) && isVisibleLandmark(leftKnee)
      ? calculateAngle(leftShoulder, leftHip, leftKnee)
      : null,
    right: isVisibleLandmark(rightShoulder) && isVisibleLandmark(rightHip) && isVisibleLandmark(rightKnee)
      ? calculateAngle(rightShoulder, rightHip, rightKnee)
      : null,
    unit: '°',
  }

  const shoulderSymmetry = isVisibleLandmark(leftShoulder) && isVisibleLandmark(rightShoulder)
    ? Math.round(Math.abs(leftShoulder.y - rightShoulder.y) * 1000) / 10
    : null

  const hipSymmetry = isVisibleLandmark(leftHip) && isVisibleLandmark(rightHip)
    ? Math.round(Math.abs(leftHip.y - rightHip.y) * 1000) / 10
    : null

  const centerOfGravity = isVisibleLandmark(leftHip) && isVisibleLandmark(rightHip)
    ? { x: (leftHip.x + rightHip.x) / 2, y: (leftHip.y + rightHip.y) / 2 }
    : null

  const headPosition = isVisibleLandmark(nose)
    ? { x: nose.x, y: nose.y }
    : null

  return {
    shoulderSymmetry,
    hipSymmetry,
    kneeAngle,
    elbowAngle,
    ankleAngle,
    hipAngle,
    centerOfGravity,
    headPosition,
    timestamp,
  }
}

export function generateReport(metrics: PoseMetrics[]): PoseReport {
  const validMetrics = metrics.filter((m) => m !== null)
  if (validMetrics.length === 0) {
    return {
      metrics: [],
      summary: {
        avgShoulderSymmetry: 0,
        avgHipSymmetry: 0,
        postureQuality: 'needs_improvement',
        recommendations: ['未检测到有效姿态数据，请重新进行测试'],
        keyFindings: [],
      },
      duration: 0,
      startTime: 0,
      endTime: 0,
    }
  }

  const shoulderSyms = validMetrics.map((m) => m.shoulderSymmetry).filter((v): v is number => v !== null)
  const hipSyms = validMetrics.map((m) => m.hipSymmetry).filter((v): v is number => v !== null)

  const avgShoulderSymmetry = shoulderSyms.length > 0
    ? Math.round((shoulderSyms.reduce((a, b) => a + b, 0) / shoulderSyms.length) * 10) / 10
    : 0

  const avgHipSymmetry = hipSyms.length > 0
    ? Math.round((hipSyms.reduce((a, b) => a + b, 0) / hipSyms.length) * 10) / 10
    : 0

  let postureQuality: PoseReport['summary']['postureQuality']
  if (avgShoulderSymmetry < 3 && avgHipSymmetry < 3) {
    postureQuality = 'excellent'
  } else if (avgShoulderSymmetry < 6 && avgHipSymmetry < 6) {
    postureQuality = 'good'
  } else if (avgShoulderSymmetry < 10 && avgHipSymmetry < 10) {
    postureQuality = 'fair'
  } else {
    postureQuality = 'needs_improvement'
  }

  const recommendations: string[] = []
  const keyFindings: string[] = []

  if (avgShoulderSymmetry >= 5) {
    keyFindings.push(`双肩高度差异为 ${avgShoulderSymmetry}%，存在明显的不对称`)
    recommendations.push('建议进行肩部对称性训练，如单臂哑铃侧平举')
  } else if (avgShoulderSymmetry >= 2) {
    keyFindings.push(`双肩高度差异为 ${avgShoulderSymmetry}%，轻度不对称`)
    recommendations.push('可适当增加肩部拉伸和平衡训练')
  } else {
    keyFindings.push(`双肩高度差异为 ${avgShoulderSymmetry}%，对称性良好`)
  }

  if (avgHipSymmetry >= 5) {
    keyFindings.push(`双髋高度差异为 ${avgHipSymmetry}%，骨盆可能存在倾斜`)
    recommendations.push('建议进行骨盆矫正训练，如臀桥和单腿平衡练习')
  } else if (avgHipSymmetry >= 2) {
    keyFindings.push(`双髋高度差异为 ${avgHipSymmetry}%，轻度不对称`)
    recommendations.push('可适当进行髋部稳定性和核心力量训练')
  } else {
    keyFindings.push(`双髋高度差异为 ${avgHipSymmetry}%，对称性良好`)
  }

  const lastMetric = validMetrics[validMetrics.length - 1]
  if (lastMetric.kneeAngle.left !== null) {
    const kneeAngle = lastMetric.kneeAngle.left
    if (kneeAngle < 160) {
      keyFindings.push(`左膝关节角度为 ${kneeAngle}°，膝关节处于弯曲状态`)
    }
  }
  if (lastMetric.kneeAngle.right !== null) {
    const kneeAngle = lastMetric.kneeAngle.right
    if (kneeAngle < 160) {
      keyFindings.push(`右膝关节角度为 ${kneeAngle}°，膝关节处于弯曲状态`)
    }
  }

  if (recommendations.length === 0) {
    recommendations.push('整体姿态良好，建议保持当前训练计划')
    recommendations.push('定期进行姿态检测，持续监控身体对称性变化')
  }

  const startTime = validMetrics[0]?.timestamp || Date.now()
  const endTime = validMetrics[validMetrics.length - 1]?.timestamp || Date.now()

  return {
    metrics: validMetrics,
    summary: {
      avgShoulderSymmetry,
      avgHipSymmetry,
      postureQuality,
      recommendations,
      keyFindings,
    },
    duration: Math.round((endTime - startTime) / 1000),
    startTime,
    endTime,
  }
}
