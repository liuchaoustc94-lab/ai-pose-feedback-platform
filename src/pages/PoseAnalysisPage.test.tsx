import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import PoseAnalysisPage from './PoseAnalysisPage'
import type { PoseReport } from '../lib/poseMetrics'

const navigateMock = vi.fn()
const savePoseReportToArchiveMock = vi.fn()
const stopDetectionMock = vi.fn()

const validReport: PoseReport = {
  metrics: [
    {
      shoulderSymmetry: 1,
      hipSymmetry: 1,
      kneeAngle: { name: '膝关节角度', left: 170, right: 170, unit: '°' },
      elbowAngle: { name: '肘关节角度', left: null, right: null, unit: '°' },
      ankleAngle: { name: '踝关节角度', left: null, right: null, unit: '°' },
      hipAngle: { name: '髋关节角度', left: null, right: null, unit: '°' },
      centerOfGravity: { x: 0.5, y: 0.5 },
      headPosition: { x: 0.5, y: 0.1 },
      timestamp: 1_000,
    },
  ],
  summary: {
    avgShoulderSymmetry: 1,
    avgHipSymmetry: 1,
    postureQuality: 'excellent',
    keyFindings: ['双肩高度差异为 1%，对称性良好'],
    recommendations: ['整体姿态良好，建议保持当前训练计划'],
  },
  duration: 5,
  startTime: 1_000,
  endTime: 6_000,
}

vi.mock('react-router', async () => {
  const actual = await vi.importActual<typeof import('react-router')>('react-router')
  return {
    ...actual,
    useNavigate: () => navigateMock,
  }
})

vi.mock('../lib/trainingArchive', () => ({
  savePoseReportToArchive: (...args: unknown[]) => savePoseReportToArchiveMock(...args),
}))

vi.mock('../hooks/useMediaPipePose', () => ({
  useMediaPipePose: () => ({
    videoRef: { current: null },
    canvasRef: { current: null },
    isReady: true,
    isDetecting: true,
    currentMetrics: null,
    report: validReport,
    error: null,
    cameraActive: false,
    videoDevices: [],
    selectedDeviceId: '',
    previewInfo: null,
    setSelectedDeviceId: vi.fn(),
    startCamera: vi.fn(),
    stopCamera: vi.fn(),
    startDetection: vi.fn(),
    stopDetection: stopDetectionMock,
  }),
}))

function renderPage(initialEntry = '/pose-analysis') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/pose-analysis" element={<PoseAnalysisPage />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('PoseAnalysisPage', () => {
  beforeEach(() => {
    navigateMock.mockClear()
    savePoseReportToArchiveMock.mockClear()
    stopDetectionMock.mockClear()
  })

  it('customizes copy for lesson-specific pose modules', () => {
    renderPage('/pose-analysis?lesson=F4.1')

    expect(screen.getByText('F4.1 · 关节点轨迹分析')).toBeInTheDocument()
    expect(screen.getByText('实时识别人体骨架，观察动作过程中的关节角度和左右差异。')).toBeInTheDocument()
  })

  it('saves a generated report to the local archive once the report phase opens', async () => {
    const user = userEvent.setup()
    renderPage('/pose-analysis?lesson=F2.1')

    await user.click(screen.getByRole('button', { name: '停止并生成报告' }))

    expect(stopDetectionMock).toHaveBeenCalled()
    await waitFor(() => {
      expect(savePoseReportToArchiveMock).toHaveBeenCalledWith(
        validReport,
        'F2.1',
        '单腿站立平衡测试'
      )
    })
  })

  it('uses the default pose-analysis module when no lesson parameter is present', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(screen.getByRole('button', { name: '停止并生成报告' }))

    await waitFor(() => {
      expect(savePoseReportToArchiveMock).toHaveBeenCalledWith(
        validReport,
        'POSE',
        '姿态识别与分析'
      )
    })
  })
})
