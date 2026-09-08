'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Newspaper,
  TrendingUp,
  Globe,
  Database,
  LineChart,
  Zap,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
} from 'lucide-react'
import { LinkedInIcon } from '@/components/common/LinkedInIcon'
import { cn } from '@/lib/utils'
import { useUIStore } from '@/stores/ui'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useArticles, useSweeps, useLinkedInPosts, useEntities, useMarketData } from '@/lib/hooks/useApiHooks'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, countKey: 'total' },
  { href: '/feed', label: 'News Feed', icon: Newspaper, countKey: 'articles' },
  { href: '/trends', label: 'Trends', icon: TrendingUp, countKey: null },
  { href: '/entities', label: 'Entities', icon: Globe, countKey: 'entities' },
  { href: '/sources', label: 'Sources', icon: Database, countKey: null },
  { href: '/market', label: 'Market Data', icon: LineChart, countKey: 'market' },
  { href: '/sweeps', label: 'Sweeps', icon: Zap, countKey: 'sweeps' },
  { href: '/posts', label: 'LinkedIn Posts', icon: LinkedInIcon, countKey: 'posts' },
]

function SidebarCounts() {
  const { data: articlesData } = useArticles({ limit: 1 })
  const { data: sweepsData } = useSweeps(1, 1)
  const { data: postsData } = useLinkedInPosts(undefined, 1)
  const { data: entitiesData } = useEntities(undefined, undefined, 'mentions', 1)
  const { data: marketData } = useMarketData()

  const counts: Record<string, number | undefined> = {
    total: articlesData?.total,
    articles: articlesData?.total,
    entities: entitiesData?.entities?.length,
    sweeps: sweepsData?.sweeps?.filter((s) => s.status === 'running').length,
    posts: postsData?.posts?.filter((p) => p.status === 'draft').length,
    market: marketData?.stocks?.length,
  }

  return counts
}

function SidebarNav({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const pathname = usePathname()
  const counts = SidebarCounts()

  return (
    <ScrollArea className="flex-1 py-2">
      <nav className="flex flex-col gap-1 px-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname?.startsWith(item.href + '/')
          const count = item.countKey ? counts[item.countKey] : undefined
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors relative',
                isActive
                  ? 'bg-sidebar-accent text-sidebar-primary font-medium'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground'
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span className="flex-1">{item.label}</span>}
              {!collapsed && count !== undefined && count > 0 && (
                <span className="ml-auto rounded-full bg-primary/15 px-1.5 py-0.5 text-[9px] font-medium text-primary tabular-nums">
                  {count > 99 ? '99+' : count}
                </span>
              )}
              {collapsed && count !== undefined && count > 0 && (
                <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-primary" />
              )}
            </Link>
          )
        })}
      </nav>
    </ScrollArea>
  )
}

export function Sidebar() {
  const { sidebarOpen, toggleSidebar, setSidebarOpen } = useUIStore()

  return (
    <>
      <aside
        className={cn(
          'fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-sidebar-border bg-sidebar-background transition-all duration-300 hidden lg:flex',
          sidebarOpen ? 'w-56' : 'w-16'
        )}
      >
        <div className="flex h-14 items-center justify-between border-b border-sidebar-border px-3">
          {sidebarOpen && (
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded bg-primary flex items-center justify-center">
                <span className="text-primary-foreground text-xs font-bold">N</span>
              </div>
              <span className="text-sm font-semibold text-sidebar-foreground">News Intel</span>
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleSidebar}
            className="h-8 w-8 text-sidebar-foreground"
          >
            {sidebarOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Button>
        </div>

        <SidebarNav collapsed={!sidebarOpen} onNavigate={() => {}} />

        {sidebarOpen && (
          <div className="border-t border-sidebar-border p-3">
            <div className="text-[10px] text-sidebar-foreground/40">
              Powered by g-research-agent v3
            </div>
          </div>
        )}
      </aside>

      <div className="lg:hidden">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setSidebarOpen(true)}
          className="fixed top-3 left-3 z-50 bg-sidebar-background border border-sidebar-border h-9 w-9"
        >
          <Menu className="h-4 w-4" />
        </Button>

        {sidebarOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
            <aside className="relative w-64 h-full bg-sidebar-background border-r border-sidebar-border flex flex-col">
              <div className="flex h-14 items-center justify-between border-b border-sidebar-border px-3">
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded bg-primary flex items-center justify-center">
                    <span className="text-primary-foreground text-xs font-bold">N</span>
                  </div>
                  <span className="text-sm font-semibold text-sidebar-foreground">News Intel</span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSidebarOpen(false)}
                  className="h-8 w-8 text-sidebar-foreground"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <SidebarNav collapsed={false} onNavigate={() => setSidebarOpen(false)} />
            </aside>
          </div>
        )}
      </div>
    </>
  )
}
