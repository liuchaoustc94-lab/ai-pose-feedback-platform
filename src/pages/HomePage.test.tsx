import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import HomePage from './HomePage'

describe('HomePage', () => {
  it('renders the core teaching platform sections', () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    )

    expect(screen.getByRole('heading', { name: '看见看不见的运动机制' })).toBeInTheDocument()
    expect(screen.getAllByText('信息加工')).toHaveLength(2)
    expect(screen.getByText('感觉系统与本体感觉')).toBeInTheDocument()
    expect(screen.getByText('注意分配与双任务范式')).toBeInTheDocument()
    expect(screen.getByText('动作协调、控制与反馈')).toBeInTheDocument()
    expect(screen.getByText('实验记录与数据导出')).toBeInTheDocument()
  })
})
