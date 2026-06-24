import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('public platform entry patch', () => {
  const html = readFileSync(resolve(process.cwd(), 'public/platform.html'), 'utf8')

  it('keeps camera-based F2/F4 modules wired to live pose analysis', () => {
    expect(html).toContain('patchCameraBasedModuleEntries')
    expect(html).toContain("['F2.1', '单腿站立平衡测试']")
    expect(html).toContain("['F4.2', '动作稳定性分析']")
    expect(html).toContain("window.location.href = `/pose-analysis?lesson=${encodeURIComponent(code)}`")
  })

  it('keeps the training archive card wired to the real local archive route', () => {
    expect(html).toContain('进入我的训练档案')
    expect(html).toContain("window.location.href = '/training-archive'")
    expect(html).toContain('delegateTrainingArchive')
  })
})
