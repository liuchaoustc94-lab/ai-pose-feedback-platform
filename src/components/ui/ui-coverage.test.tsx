import * as React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useForm } from 'react-hook-form'
import { Calendar, CalendarDayButton } from './calendar'
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from './carousel'
import {
  ChartContainer,
  ChartLegendContent,
  ChartTooltipContent,
} from './chart'
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from './command'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from './form'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from './select'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarInput,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
} from './sidebar'
import { Toaster } from './sonner'

const uiMocks = vi.hoisted(() => ({
  carousel: {
    ref: vi.fn(),
    api: {
      canScrollPrev: vi.fn(() => true),
      canScrollNext: vi.fn(() => false),
      scrollPrev: vi.fn(),
      scrollNext: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
    },
  },
  sonnerTheme: 'dark',
  sonnerRender: vi.fn(),
}))

vi.mock('embla-carousel-react', () => ({
  default: vi.fn(() => [uiMocks.carousel.ref, uiMocks.carousel.api]),
}))

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  Tooltip: () => null,
  Legend: () => null,
}))

vi.mock('next-themes', () => ({
  useTheme: () => ({ theme: uiMocks.sonnerTheme }),
}))

vi.mock('sonner', () => ({
  Toaster: (props: Record<string, unknown>) => {
    uiMocks.sonnerRender(props)
    return <div data-testid="sonner-root" data-theme={String(props.theme)} />
  },
}))

describe('uncovered UI primitives', () => {
  beforeEach(() => {
    uiMocks.carousel.ref.mockClear()
    uiMocks.carousel.api.canScrollPrev.mockClear()
    uiMocks.carousel.api.canScrollNext.mockClear()
    uiMocks.carousel.api.scrollPrev.mockClear()
    uiMocks.carousel.api.scrollNext.mockClear()
    uiMocks.carousel.api.on.mockClear()
    uiMocks.carousel.api.off.mockClear()
    uiMocks.sonnerRender.mockClear()
    uiMocks.sonnerTheme = 'dark'
    vi.restoreAllMocks()
    document.body.innerHTML = ''
    Object.defineProperty(window, 'innerWidth', { value: 1024, configurable: true })
  })

  it('renders the calendar wrapper and focused day button', () => {
    const focusSpy = vi.spyOn(HTMLElement.prototype, 'focus')

    const { container } = render(
      <Calendar
        month={new Date(2026, 5, 1)}
        mode="single"
        selected={new Date(2026, 5, 15)}
      />
    )

    expect(container.querySelector('[data-slot="calendar"]')).toBeInTheDocument()
    expect(container.querySelector('[data-day]')).toBeInTheDocument()

    const { container: dayContainer } = render(
      <CalendarDayButton
        day={{ date: new Date(2026, 5, 16) } as never}
        modifiers={{
          focused: true,
          selected: true,
          range_start: false,
          range_end: false,
          range_middle: false,
        }}
      />
    )

    expect(focusSpy).toHaveBeenCalled()
    expect(dayContainer.querySelector('[data-selected-single="true"]')).toBeInTheDocument()
  })

  it('connects carousel controls to the embla API', async () => {
    const user = userEvent.setup()

    const { container } = render(
      <Carousel>
        <CarouselContent>
          <CarouselItem>第一项</CarouselItem>
          <CarouselItem>第二项</CarouselItem>
        </CarouselContent>
        <CarouselPrevious />
        <CarouselNext />
      </Carousel>
    )

    expect(uiMocks.carousel.api.on).toHaveBeenCalledWith('reInit', expect.any(Function))
    expect(uiMocks.carousel.api.on).toHaveBeenCalledWith('select', expect.any(Function))
    expect(container.querySelector('[data-slot="carousel"]')).toBeInTheDocument()
    expect(container.querySelectorAll('[data-slot="carousel-item"]')).toHaveLength(2)
    expect(screen.getByRole('button', { name: 'Previous slide' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Next slide' })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'Previous slide' }))
    expect(uiMocks.carousel.api.scrollPrev).toHaveBeenCalled()

    fireEvent.keyDown(screen.getByRole('region'), { key: 'ArrowRight' })
    expect(uiMocks.carousel.api.scrollNext).toHaveBeenCalled()
  })

  it('renders command palette primitives and dialog wrapper', async () => {
    render(
      <CommandDialog open title="命令面板" description="搜索动作">
        <CommandInput placeholder="搜索" />
        <CommandList>
          <CommandGroup heading="常用">
            <CommandItem>
              开始检测
              <CommandShortcut>Ctrl+Enter</CommandShortcut>
            </CommandItem>
          </CommandGroup>
          <CommandSeparator />
        </CommandList>
      </CommandDialog>
    )

    expect(await screen.findByRole('dialog', { name: '命令面板' })).toBeInTheDocument()
    expect(screen.getByRole('combobox')).toHaveAttribute('data-slot', 'command-input')
    expect(screen.getByText('常用')).toBeInTheDocument()
    expect(screen.getByText('开始检测')).toHaveAttribute('data-slot', 'command-item')
    expect(screen.getByText('Ctrl+Enter')).toHaveAttribute('data-slot', 'command-shortcut')
    expect(screen.getByText('搜索动作')).toBeInTheDocument()
    expect(screen.getAllByRole('separator').find((element) => element.getAttribute('data-slot') === 'command-separator')).toBeInTheDocument()
  })

  it('renders command empty state', () => {
    render(
      <Command>
        <CommandInput placeholder="搜索" />
        <CommandList>
          <CommandEmpty>没有结果</CommandEmpty>
        </CommandList>
      </Command>
    )

    expect(screen.getByText('没有结果')).toHaveAttribute('data-slot', 'command-empty')
    expect(screen.getByText('没有结果')).toBeInTheDocument()
  })

  it('renders form field states with and without validation errors', async () => {
    const user = userEvent.setup()

    function FormDemo() {
      const form = useForm<{ name: string; note: string }>({
        defaultValues: { name: '', note: '' },
        mode: 'onSubmit',
      })

      return (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(vi.fn())}>
            <FormField
              control={form.control}
              name="name"
              rules={{ required: '姓名必填' }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>姓名</FormLabel>
                  <FormControl>
                    <input aria-label="姓名输入" {...field} />
                  </FormControl>
                  <FormDescription>填写真实姓名</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="note"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>备注</FormLabel>
                  <FormControl>
                    <input aria-label="备注输入" {...field} />
                  </FormControl>
                  <FormDescription>可选说明</FormDescription>
                  <FormMessage>无需提示时应保持为空</FormMessage>
                </FormItem>
              )}
            />
            <button type="submit">提交</button>
          </form>
        </Form>
      )
    }

    render(<FormDemo />)

    expect(screen.getByText('姓名')).toHaveAttribute('data-slot', 'form-label')
    expect(screen.getByText('填写真实姓名')).toHaveAttribute('data-slot', 'form-description')
    expect(screen.getByText('无需提示时应保持为空')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '提交' }))

    expect(await screen.findByText('姓名必填')).toHaveAttribute('data-slot', 'form-message')
    expect(screen.getByLabelText('姓名输入')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText('姓名输入')).toHaveAttribute('aria-describedby', expect.stringContaining('form-item-description'))
  })

  it('opens select content and exposes items and separators', async () => {
    const user = userEvent.setup()

    const { container } = render(
      <Select open defaultValue="cat">
        <SelectTrigger aria-label="动物">
          <SelectValue placeholder="请选择" />
        </SelectTrigger>
        <SelectContent position="popper">
          <SelectGroup>
            <SelectLabel>宠物</SelectLabel>
            <SelectItem value="cat">猫</SelectItem>
            <SelectItem value="dog">狗</SelectItem>
          </SelectGroup>
          <SelectSeparator />
        </SelectContent>
      </Select>
    )

    expect(screen.getAllByRole('option')).toHaveLength(2)
    expect(screen.getByText('宠物')).toHaveAttribute('data-slot', 'select-label')
    expect(screen.getByRole('option', { name: '猫' })).toHaveAttribute('data-slot', 'select-item')
    expect(screen.getByRole('option', { name: '狗' })).toHaveAttribute('data-slot', 'select-item')
    expect(document.querySelector('[data-slot="select-separator"]')).toBeInTheDocument()
    expect(container.querySelector('[data-slot="select-trigger"]')).toBeInTheDocument()
    expect(screen.getByRole('option', { name: '猫' })).toBeInTheDocument()

    await user.click(screen.getByRole('option', { name: '狗' }))
  })

  it('renders chart helpers with tooltip and legend content', () => {
    const config = {
      score: { label: '姿态得分', color: '#0a4fff' },
      balance: { label: '平衡指数', theme: { light: '#134A34', dark: '#e8e8e6' } },
    }

    const payload = [
      {
        dataKey: 'score',
        name: 'score',
        value: 12,
        color: '#0a4fff',
        payload: { score: 'balance' },
        type: 'line',
      },
    ]

    const { container } = render(
      <ChartContainer config={config}>
        <ChartTooltipContent
          active
          payload={payload as never}
          label="score"
          indicator="dashed"
        />
        <ChartLegendContent
          payload={[
            {
              dataKey: 'score',
              value: 'score',
              color: '#0a4fff',
              type: 'line',
            },
          ] as never}
        />
      </ChartContainer>
    )

    expect(container.querySelector('[data-slot="chart"]')).toHaveAttribute('data-chart')
    expect(container.querySelector('style')).toHaveTextContent('--color-score: #0a4fff;')
    expect(screen.getByText('平衡指数')).toBeInTheDocument()
    expect(screen.getByText('12')).toBeInTheDocument()
    expect(screen.getAllByText('姿态得分')).toHaveLength(2)
  })

  it('renders the toaster wrapper with theme and icon mappings', () => {
    render(<Toaster position="top-center" />)

    expect(screen.getByTestId('sonner-root')).toHaveAttribute('data-theme', 'dark')
    const [props] = uiMocks.sonnerRender.mock.calls[0]
    expect(props).toEqual(expect.objectContaining({ theme: 'dark', position: 'top-center' }))
    expect(props.icons.success).toBeTruthy()
    expect(props.icons.loading).toBeTruthy()
  })

  it('renders the sidebar desktop and mobile branches', async () => {
    const user = userEvent.setup()

    function DesktopSidebar() {
      return (
        <SidebarProvider defaultOpen>
          <Sidebar>
            <SidebarHeader>
              <SidebarInput aria-label="筛选" />
            </SidebarHeader>
            <SidebarContent>
              <SidebarGroup>
                <SidebarGroupLabel>导航</SidebarGroupLabel>
                <SidebarGroupAction aria-label="新增">+</SidebarGroupAction>
                <SidebarGroupContent>
                  <SidebarMenu>
                    <SidebarMenuItem>
                      <SidebarMenuButton tooltip="首页">首页</SidebarMenuButton>
                      <SidebarMenuAction aria-label="编辑" />
                      <SidebarMenuBadge>3</SidebarMenuBadge>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuSub>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton href="/reports">报告</SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      </SidebarMenuSub>
                    </SidebarMenuItem>
                  </SidebarMenu>
                  <SidebarMenuSkeleton showIcon />
                </SidebarGroupContent>
              </SidebarGroup>
              <SidebarSeparator />
            </SidebarContent>
            <SidebarFooter>底部</SidebarFooter>
          </Sidebar>
          <SidebarTrigger />
          <SidebarRail />
          <SidebarInset>主内容</SidebarInset>
        </SidebarProvider>
      )
    }

    const { container, unmount } = render(<DesktopSidebar />)

    expect(container.querySelector('[data-slot="sidebar-wrapper"]')).toBeInTheDocument()
    expect(container.querySelector('[data-slot="sidebar"][data-state="expanded"]')).toBeInTheDocument()
    expect(screen.getByLabelText('筛选')).toHaveAttribute('data-slot', 'sidebar-input')
    expect(screen.getByText('导航')).toHaveAttribute('data-slot', 'sidebar-group-label')
    expect(screen.getByText('首页')).toHaveAttribute('data-slot', 'sidebar-menu-button')
    expect(screen.getByText('3')).toHaveAttribute('data-slot', 'sidebar-menu-badge')
    expect(screen.getByText('主内容')).toHaveAttribute('data-slot', 'sidebar-inset')

    await user.click(container.querySelector('[data-slot="sidebar-trigger"]') as HTMLButtonElement)
    expect(container.querySelector('[data-slot="sidebar"][data-state="collapsed"]')).toBeInTheDocument()
    expect(document.cookie).toContain('sidebar_state=false')

    unmount()

    Object.defineProperty(window, 'innerWidth', { value: 375, configurable: true })

    const mobileRender = render(
      <SidebarProvider defaultOpen>
        <Sidebar>
          <div>移动端侧边栏</div>
        </Sidebar>
        <SidebarTrigger />
      </SidebarProvider>
    )

    await user.click(mobileRender.container.querySelector('[data-slot="sidebar-trigger"]') as HTMLButtonElement)

    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
    expect(screen.getByRole('dialog')).toHaveAttribute('data-slot', 'sidebar')
    expect(screen.getByRole('dialog')).toHaveAttribute('data-mobile', 'true')
  })
})
