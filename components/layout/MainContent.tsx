'use client'

import { useUIStore } from '@/stores/ui'
import { cn } from '@/lib/utils'

export function MainContent({ children }: { children: React.ReactNode }) {
  const { sidebarOpen } = useUIStore()

  return (
    <main
      className={cn(
        'pt-14 pb-8 min-h-screen transition-all duration-300',
        sidebarOpen ? 'lg:ml-56' : 'lg:ml-16'
      )}
    >
      {children}
    </main>
  )
}
