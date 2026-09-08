
import type { Metadata } from 'next'
import { ThemeProvider } from 'next-themes'
import { Sidebar } from '@/components/layout/Sidebar'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { MainContent } from '@/components/layout/MainContent'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import './globals.css'

export const metadata: Metadata = {
  title: 'News Intelligence Dashboard',
  description: 'Real-time news intelligence powered by g-research-agent v3',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen font-sans antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          <ErrorBoundary>
            <Sidebar />
            <Header />
            <MainContent>{children}</MainContent>
            <Footer />
          </ErrorBoundary>
        </ThemeProvider>
      </body>
    </html>
  )
}
