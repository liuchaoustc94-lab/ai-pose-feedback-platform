import type { PoseReport } from './poseMetrics'

export interface ArchiveIdentity {
  className: string
  studentNo: string
  anonymousId: string
}

export interface TrainingArchiveRecord {
  id: string
  anonymousId: string
  moduleCode: string
  moduleTitle: string
  timestamp: number
  duration: number
  avgShoulderSymmetry: number
  avgHipSymmetry: number
  postureQuality: PoseReport['summary']['postureQuality']
  keyFindings: string[]
  recommendations: string[]
  sampleCount: number
}

const identityKey = 'ai-feedback-training-identity'
const recordsKey = 'ai-feedback-training-records'

function hashIdentity(value: string) {
  let hash = 0
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0
  }
  return hash.toString(36).toUpperCase().padStart(6, '0').slice(0, 6)
}

export function createAnonymousId(className: string, studentNo: string) {
  const normalizedClass = className.trim().replace(/\s+/g, '').toUpperCase()
  const normalizedNo = studentNo.trim().replace(/\s+/g, '').toUpperCase()
  return `${normalizedClass || 'CLASS'}-${hashIdentity(`${normalizedClass}:${normalizedNo}`)}`
}

export function readArchiveIdentity(): ArchiveIdentity | null {
  const raw = localStorage.getItem(identityKey)
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as ArchiveIdentity
    if (!parsed.className || !parsed.studentNo || !parsed.anonymousId) return null
    return parsed
  } catch {
    return null
  }
}

export function saveArchiveIdentity(className: string, studentNo: string) {
  const identity: ArchiveIdentity = {
    className: className.trim(),
    studentNo: studentNo.trim(),
    anonymousId: createAnonymousId(className, studentNo),
  }
  localStorage.setItem(identityKey, JSON.stringify(identity))
  return identity
}

export function readArchiveRecords(): TrainingArchiveRecord[] {
  const raw = localStorage.getItem(recordsKey)
  if (!raw) return []

  try {
    const parsed = JSON.parse(raw) as TrainingArchiveRecord[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function writeArchiveRecords(records: TrainingArchiveRecord[]) {
  localStorage.setItem(recordsKey, JSON.stringify(records))
}

export function savePoseReportToArchive(
  report: PoseReport,
  moduleCode: string,
  moduleTitle: string,
  identity = readArchiveIdentity()
) {
  if (report.metrics.length === 0) return null

  const activeIdentity =
    identity ?? saveArchiveIdentity('体教2401', '01')
  const record: TrainingArchiveRecord = {
    id: `${moduleCode}-${report.endTime}`,
    anonymousId: activeIdentity.anonymousId,
    moduleCode,
    moduleTitle,
    timestamp: report.endTime,
    duration: report.duration,
    avgShoulderSymmetry: report.summary.avgShoulderSymmetry,
    avgHipSymmetry: report.summary.avgHipSymmetry,
    postureQuality: report.summary.postureQuality,
    keyFindings: report.summary.keyFindings,
    recommendations: report.summary.recommendations,
    sampleCount: report.metrics.length,
  }

  const records = readArchiveRecords()
  const nextRecords = [
    record,
    ...records.filter((item) => item.id !== record.id),
  ].slice(0, 200)

  writeArchiveRecords(nextRecords)
  return record
}

export function clearArchiveRecords() {
  localStorage.removeItem(recordsKey)
}
