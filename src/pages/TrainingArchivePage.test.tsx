import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import TrainingArchivePage from './TrainingArchivePage'
import {
  saveArchiveIdentity,
  writeArchiveRecords,
  type TrainingArchiveRecord,
} from '../lib/trainingArchive'

const navigateMock = vi.fn()

vi.mock('react-router', async () => {
  const actual = await vi.importActual<typeof import('react-router')>('react-router')
  return {
    ...actual,
    useNavigate: () => navigateMock,
  }
})

function renderPage() {
  return render(
    <MemoryRouter>
      <TrainingArchivePage />
    </MemoryRouter>
  )
}

function record(overrides: Partial<TrainingArchiveRecord> = {}): TrainingArchiveRecord {
  return {
    id: 'F2.1-9000',
    anonymousId: saveArchiveIdentity('体教2401', '01').anonymousId,
    moduleCode: 'F2.1',
    moduleTitle: '单腿站立平衡测试',
    timestamp: new Date('2026-06-24T08:00:00+08:00').getTime(),
    duration: 8,
    avgShoulderSymmetry: 2,
    avgHipSymmetry: 3,
    postureQuality: 'good',
    keyFindings: ['对称性良好'],
    recommendations: ['保持训练'],
    sampleCount: 12,
    ...overrides,
  }
}

describe('TrainingArchivePage', () => {
  beforeEach(() => {
    localStorage.clear()
    navigateMock.mockClear()
  })

  it('renders the empty archive state with disabled destructive/export actions', () => {
    renderPage()

    expect(screen.getByText('我的训练档案')).toBeInTheDocument()
    expect(screen.getByText('还没有本地训练记录')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '导出 CSV' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '清空' })).toBeDisabled()
  })

  it('creates an anonymous identity from class and student number', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.clear(screen.getByLabelText('班级'))
    await user.type(screen.getByLabelText('班级'), '体教 2402')
    await user.clear(screen.getByLabelText('学号'))
    await user.type(screen.getByLabelText('学号'), '18')
    await user.click(screen.getByRole('button', { name: '生成并进入档案' }))

    expect(screen.getByText('匿名编号')).toBeInTheDocument()
    expect(screen.getByText(/^体教2402-[A-Z0-9]{6}$/)).toBeInTheDocument()
  })

  it('shows only records for the current anonymous identity', () => {
    const identity = saveArchiveIdentity('体教2401', '01')
    writeArchiveRecords([
      record({ anonymousId: identity.anonymousId }),
      record({
        id: 'other-1',
        anonymousId: 'OTHER-001',
        moduleCode: 'F4.1',
        moduleTitle: '关节点轨迹分析',
      }),
    ])

    renderPage()

    expect(screen.getByText('单腿站立平衡测试')).toBeInTheDocument()
    expect(screen.queryByText('关节点轨迹分析')).not.toBeInTheDocument()
    expect(screen.getAllByText('1')).toHaveLength(2)
    expect(screen.getByRole('button', { name: '导出 CSV' })).toBeEnabled()
    expect(screen.getByRole('button', { name: '清空' })).toBeEnabled()
  })

  it('navigates back to pose analysis from the call-to-action', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(screen.getByRole('button', { name: '去做一次检测' }))

    expect(navigateMock).toHaveBeenCalledWith('/pose-analysis')
  })
})
