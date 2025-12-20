import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import Head from 'next/head'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useUser } from '@clerk/nextjs'
import { useApi } from '@/lib/api/client'
import WorkspaceLayout from '@/components/layout/WorkspaceLayout'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertCircle,
  ExternalLink,
  Clock,
  CheckCircle2,
  XCircle,
  CalendarDays,
  Trash2,
  Pencil,
  Calendar,
  LayoutGrid,
  List,
} from 'lucide-react'
import { toast } from 'sonner'
import { SiYoutube, SiInstagram, SiTiktok } from '@icons-pack/react-simple-icons'
import { useAnySchedulingEnabled } from '@/hooks/useFeatureFlag'
import { cn } from '@/lib/utils/cn'

type CalendarView = 'month' | 'week' | 'day'
type PlatformFilter = 'all' | 'youtube' | 'instagram' | 'tiktok'
type StatusFilter = 'all' | 'scheduled' | 'publishing' | 'published' | 'failed'

interface CalendarPost {
  id: string
  scheduledFor: string
  status: 'scheduled' | 'publishing' | 'published' | 'failed'
  title: string
  description: string | null
  platformPostId: string | null
  platformUrl: string | null
  errorMessage: string | null
  short: {
    id: string
    thumbnailUrl: string | null
    transcriptionSlice: string
  }
  project: {
    id: string
    title: string
  }
  socialAccount: {
    platform: string
    channelTitle: string | null
  }
}

const STATUS_COLORS: Record<string, string> = {
  scheduled: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
  publishing: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20',
  published: 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20',
  failed: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
}

const STATUS_ICONS: Record<string, React.ReactNode> = {
  scheduled: <Clock className="w-3 h-3" />,
  publishing: <Loader2 className="w-3 h-3 animate-spin" />,
  published: <CheckCircle2 className="w-3 h-3" />,
  failed: <XCircle className="w-3 h-3" />,
}

function PlatformIcon({ platform, size = 10 }: { platform: string; size?: number }) {
  switch (platform) {
    case 'youtube':
      return <SiYoutube size={size} />
    case 'instagram':
      return <SiInstagram size={size} />
    case 'tiktok':
      return <SiTiktok size={size} />
    default:
      return <SiYoutube size={size} />
  }
}

function getMonthDays(year: number, month: number): Date[] {
  const days: Date[] = []
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)

  // Add days from previous month to fill the first week
  const firstDayOfWeek = firstDay.getDay()
  for (let i = firstDayOfWeek - 1; i >= 0; i--) {
    const day = new Date(year, month, -i)
    days.push(day)
  }

  // Add all days in the current month
  for (let i = 1; i <= lastDay.getDate(); i++) {
    days.push(new Date(year, month, i))
  }

  // Add days from next month to fill the last week
  const remainingDays = 7 - (days.length % 7)
  if (remainingDays < 7) {
    for (let i = 1; i <= remainingDays; i++) {
      days.push(new Date(year, month + 1, i))
    }
  }

  return days
}

function getWeekDays(date: Date): Date[] {
  const days: Date[] = []
  // Get the Sunday of the week containing the given date
  const dayOfWeek = date.getDay()
  const sunday = new Date(date)
  sunday.setDate(date.getDate() - dayOfWeek)

  for (let i = 0; i < 7; i++) {
    const day = new Date(sunday)
    day.setDate(sunday.getDate() + i)
    days.push(day)
  }

  return days
}

function formatWeekRange(date: Date): string {
  const weekDays = getWeekDays(date)
  const start = weekDays[0]
  const end = weekDays[6]

  const startMonth = start.toLocaleString('default', { month: 'short' })
  const endMonth = end.toLocaleString('default', { month: 'short' })

  if (start.getMonth() === end.getMonth()) {
    return `${startMonth} ${start.getDate()}-${end.getDate()}, ${end.getFullYear()}`
  }
  return `${startMonth} ${start.getDate()} - ${endMonth} ${end.getDate()}, ${end.getFullYear()}`
}

function formatTime(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

// Format Date to local datetime-local input format (YYYY-MM-DDTHH:MM)
function formatLocalDateTime(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// Get minimum datetime (15 minutes from now)
function getMinDateTime(): string {
  const minDate = new Date(Date.now() + 15 * 60 * 1000)
  return formatLocalDateTime(minDate)
}

// Group posts by hour for timeline view
function groupPostsByHour(posts: CalendarPost[]): Record<number, CalendarPost[]> {
  const grouped: Record<number, CalendarPost[]> = {}
  posts.forEach(post => {
    const hour = new Date(post.scheduledFor).getHours()
    if (!grouped[hour]) grouped[hour] = []
    grouped[hour].push(post)
  })
  // Sort posts within each hour by minute
  Object.values(grouped).forEach(hourPosts => {
    hourPosts.sort((a, b) =>
      new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime()
    )
  })
  return grouped
}

export default function CalendarPage() {
  const router = useRouter()
  const { isSignedIn, isLoaded } = useUser()
  const { call } = useApi()
  const { enabled: schedulingEnabled, loading: flagLoading } = useAnySchedulingEnabled()
  const [posts, setPosts] = useState<CalendarPost[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  // Edit modal state
  const [editingPost, setEditingPost] = useState<CalendarPost | null>(null)
  const [editFormData, setEditFormData] = useState({ scheduledFor: '', title: '', description: '' })
  const [saving, setSaving] = useState(false)

  // Delete confirmation modal state
  const [deleteTarget, setDeleteTarget] = useState<CalendarPost | null>(null)

  // Calendar state
  const [currentDate, setCurrentDate] = useState(new Date())
  const currentYear = currentDate.getFullYear()
  const currentMonth = currentDate.getMonth()

  // View state - initialized from URL query params
  const [currentView, setCurrentView] = useState<CalendarView>('month')
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)

  // Filter state
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  // Auto-scroll ref for current hour in day view
  const currentHourRef = useRef<HTMLDivElement>(null)

  // Initialize from URL query params
  useEffect(() => {
    const { view, date, platform, status } = router.query
    if (view && ['month', 'week', 'day'].includes(view as string)) {
      setCurrentView(view as CalendarView)
    }
    if (date && typeof date === 'string') {
      const parsedDate = new Date(date)
      if (!isNaN(parsedDate.getTime())) {
        setCurrentDate(parsedDate)
        if (view === 'day') {
          setSelectedDay(parsedDate)
        }
      }
    }
    if (platform && ['all', 'youtube', 'instagram', 'tiktok'].includes(platform as string)) {
      setPlatformFilter(platform as PlatformFilter)
    }
    if (status && ['all', 'scheduled', 'publishing', 'published', 'failed'].includes(status as string)) {
      setStatusFilter(status as StatusFilter)
    }
  }, [router.query])

  // Update URL when view/date/filters change
  const updateUrl = useCallback((updates: { view?: CalendarView; date?: Date; platform?: PlatformFilter; status?: StatusFilter }) => {
    const query: Record<string, string> = {}
    const view = updates.view ?? currentView
    const date = updates.date ?? currentDate
    const platform = updates.platform ?? platformFilter
    const status = updates.status ?? statusFilter

    query.view = view
    query.date = date.toISOString().split('T')[0]
    if (platform !== 'all') query.platform = platform
    if (status !== 'all') query.status = status

    router.replace({ pathname: router.pathname, query }, undefined, { shallow: true })
  }, [router, currentView, currentDate, platformFilter, statusFilter])

  // Redirect to sign-in if not authenticated
  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.push('/sign-in')
    }
  }, [isLoaded, isSignedIn, router])

  // Load posts for the current month
  useEffect(() => {
    loadPosts()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentYear, currentMonth])

  // Auto-scroll to current hour when viewing today in day view
  useEffect(() => {
    if (currentView === 'day' && selectedDay?.toDateString() === new Date().toDateString()) {
      // Small delay to ensure DOM is rendered
      const timeout = setTimeout(() => {
        currentHourRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 100)
      return () => clearTimeout(timeout)
    }
  }, [currentView, selectedDay])

  async function loadPosts() {
    const startDate = new Date(currentYear, currentMonth, 1)
    const endDate = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59)

    setLoading(true)
    try {
      const data = await call<{ posts: CalendarPost[] }>(
        `/v1/calendar?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`
      )
      setPosts(data.posts || [])
      setError(null)
    } catch (err) {
      console.error('Error loading calendar posts:', err)
      setError(err instanceof Error ? err.message : 'Failed to load scheduled posts')
    } finally {
      setLoading(false)
    }
  }

  function handleDeleteClick(post: CalendarPost) {
    setDeleteTarget(post)
  }

  async function confirmDelete() {
    if (!deleteTarget) return

    setDeleting(deleteTarget.id)
    try {
      await call(`/v1/scheduled-posts/${deleteTarget.id}`, { method: 'DELETE' })
      setPosts(posts.filter((p) => p.id !== deleteTarget.id))
      toast.success('Scheduled post deleted')
      setDeleteTarget(null)
    } catch (err) {
      console.error('Error deleting post:', err)
      toast.error(err instanceof Error ? err.message : 'Failed to delete post')
    } finally {
      setDeleting(null)
    }
  }

  function openEditModal(post: CalendarPost) {
    setEditFormData({
      scheduledFor: formatLocalDateTime(new Date(post.scheduledFor)),
      title: post.title,
      description: post.description || '',
    })
    setEditingPost(post)
  }

  function closeEditModal() {
    setEditingPost(null)
    setEditFormData({ scheduledFor: '', title: '', description: '' })
  }

  async function handleSaveEdit() {
    if (!editingPost) return

    // Client-side validation
    const scheduledDate = new Date(editFormData.scheduledFor)
    const fifteenMinutesFromNow = new Date(Date.now() + 15 * 60 * 1000)

    if (scheduledDate < fifteenMinutesFromNow) {
      toast.error('Scheduled time must be at least 15 minutes from now')
      return
    }

    if (!editFormData.title.trim()) {
      toast.error('Title cannot be empty')
      return
    }

    setSaving(true)
    try {
      const response = await call<{ scheduledPost: { scheduledFor: string; title: string; description: string | null } }>(
        `/v1/scheduled-posts/${editingPost.id}`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            scheduledFor: scheduledDate.toISOString(),
            title: editFormData.title.trim(),
            description: editFormData.description.trim() || null,
          }),
        }
      )

      // Update posts state
      setPosts(posts.map((p) =>
        p.id === editingPost.id
          ? {
              ...p,
              scheduledFor: response.scheduledPost.scheduledFor,
              title: response.scheduledPost.title,
              description: response.scheduledPost.description,
            }
          : p
      ))

      toast.success('Scheduled post updated')
      closeEditModal()
    } catch (err) {
      console.error('Error updating post:', err)
      toast.error(err instanceof Error ? err.message : 'Failed to update post')
    } finally {
      setSaving(false)
    }
  }

  // Filter posts by platform and status
  const filteredPosts = useMemo(() => {
    return posts.filter((post) => {
      if (platformFilter !== 'all' && post.socialAccount.platform !== platformFilter) {
        return false
      }
      if (statusFilter !== 'all' && post.status !== statusFilter) {
        return false
      }
      return true
    })
  }, [posts, platformFilter, statusFilter])

  // Group filtered posts by date
  const postsByDate = useMemo(() => {
    const grouped: Record<string, CalendarPost[]> = {}
    filteredPosts.forEach((post) => {
      const dateKey = new Date(post.scheduledFor).toDateString()
      if (!grouped[dateKey]) {
        grouped[dateKey] = []
      }
      grouped[dateKey].push(post)
    })
    // Sort posts within each day by time
    Object.values(grouped).forEach((dayPosts) => {
      dayPosts.sort((a, b) => new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime())
    })
    return grouped
  }, [filteredPosts])

  const monthDays = useMemo(() => getMonthDays(currentYear, currentMonth), [currentYear, currentMonth])
  const weekDays = useMemo(() => getWeekDays(currentDate), [currentDate])

  // Navigation functions
  const navigatePrevious = () => {
    let newDate: Date
    if (currentView === 'month') {
      newDate = new Date(currentYear, currentMonth - 1, 1)
    } else if (currentView === 'week') {
      newDate = new Date(currentDate)
      newDate.setDate(newDate.getDate() - 7)
    } else {
      if (!selectedDay) return
      newDate = new Date(selectedDay)
      newDate.setDate(newDate.getDate() - 1)
      setSelectedDay(newDate)
    }
    setCurrentDate(newDate)
    updateUrl({ date: newDate })
  }

  const navigateNext = () => {
    let newDate: Date
    if (currentView === 'month') {
      newDate = new Date(currentYear, currentMonth + 1, 1)
    } else if (currentView === 'week') {
      newDate = new Date(currentDate)
      newDate.setDate(newDate.getDate() + 7)
    } else {
      if (!selectedDay) return
      newDate = new Date(selectedDay)
      newDate.setDate(newDate.getDate() + 1)
      setSelectedDay(newDate)
    }
    setCurrentDate(newDate)
    updateUrl({ date: newDate })
  }

  const navigateToToday = () => {
    const today = new Date()
    setCurrentDate(today)
    if (currentView === 'day') {
      setSelectedDay(today)
    }
    updateUrl({ date: today })
  }

  // View switching
  const switchView = (view: CalendarView) => {
    setCurrentView(view)
    if (view === 'day' && !selectedDay) {
      setSelectedDay(currentDate)
    }
    updateUrl({ view })
  }

  // Navigate to specific day
  const navigateToDay = (day: Date) => {
    setSelectedDay(day)
    setCurrentView('day')
    // Ensure we're viewing the correct month for post loading
    if (day.getMonth() !== currentMonth || day.getFullYear() !== currentYear) {
      setCurrentDate(new Date(day.getFullYear(), day.getMonth(), 1))
    }
    updateUrl({ view: 'day', date: day })
  }

  // Get display title based on current view
  const getNavigationTitle = () => {
    if (currentView === 'month') {
      return currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })
    } else if (currentView === 'week') {
      return formatWeekRange(currentDate)
    } else if (selectedDay) {
      return selectedDay.toLocaleDateString('default', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    }
    return ''
  }

  const hasActiveFilters = platformFilter !== 'all' || statusFilter !== 'all'

  const clearFilters = () => {
    setPlatformFilter('all')
    setStatusFilter('all')
    updateUrl({ platform: 'all', status: 'all' })
  }

  const today = new Date()

  // Don't show anything if not authenticated
  if (!isLoaded || !isSignedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // Show "Coming Soon" state when feature flag is disabled
  if (!flagLoading && !schedulingEnabled) {
    return (
      <WorkspaceLayout>
        <Head>
          <title>Calendar | VidEditor.ai</title>
        </Head>
        <div className="container max-w-4xl mx-auto py-16 px-4">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-muted mb-6">
              <CalendarDays className="w-10 h-10 text-muted-foreground" />
            </div>
            <span className="inline-block px-3 py-1 bg-muted rounded-full text-sm font-medium text-muted-foreground mb-4">
              Coming Soon
            </span>
            <h1 className="text-2xl font-bold mb-4">Publishing Calendar</h1>
            <p className="text-muted-foreground max-w-md mx-auto mb-8">
              Schedule and manage your YouTube Shorts from a beautiful calendar view.
              Connect your YouTube channel and publish on autopilot.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-lg mx-auto text-left">
              <div className="p-4 rounded-lg bg-muted/50 border border-border">
                <SiYoutube className="w-5 h-5 text-red-500 mb-2" />
                <h3 className="font-medium text-sm mb-1">YouTube Integration</h3>
                <p className="text-xs text-muted-foreground">Direct publishing to YouTube Shorts</p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50 border border-border">
                <Clock className="w-5 h-5 text-blue-500 mb-2" />
                <h3 className="font-medium text-sm mb-1">Schedule Ahead</h3>
                <p className="text-xs text-muted-foreground">Plan your content calendar</p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50 border border-border">
                <CheckCircle2 className="w-5 h-5 text-green-500 mb-2" />
                <h3 className="font-medium text-sm mb-1">Auto Publish</h3>
                <p className="text-xs text-muted-foreground">Posts go live automatically</p>
              </div>
            </div>
          </div>
        </div>
      </WorkspaceLayout>
    )
  }

  return (
    <WorkspaceLayout>
      <Head>
        <title>Calendar | VidEditor.ai</title>
      </Head>

      <div className="container max-w-7xl mx-auto py-8 px-4">
        {/* Header */}
        <div className="flex flex-col gap-4 mb-6">
          {/* Top row: Title and View Switcher */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold">Publishing Calendar</h1>
              <p className="text-muted-foreground mt-1">
                View and manage your scheduled posts
              </p>
            </div>

            {/* View Switcher */}
            <div className="flex items-center cyber-clip border-2 border-border bg-card p-1">
              <button
                onClick={() => switchView('month')}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 text-sm font-medium transition-all",
                  currentView === 'month'
                    ? "bg-primary text-primary-foreground cyber-clip"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <LayoutGrid className="w-4 h-4" />
                <span className="hidden sm:inline">MONTH</span>
              </button>
              <button
                onClick={() => switchView('week')}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 text-sm font-medium transition-all",
                  currentView === 'week'
                    ? "bg-primary text-primary-foreground cyber-clip"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Calendar className="w-4 h-4" />
                <span className="hidden sm:inline">WEEK</span>
              </button>
              <button
                onClick={() => switchView('day')}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 text-sm font-medium transition-all",
                  currentView === 'day'
                    ? "bg-primary text-primary-foreground cyber-clip"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <List className="w-4 h-4" />
                <span className="hidden sm:inline">DAY</span>
              </button>
            </div>
          </div>

          {/* Navigation row */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={navigatePrevious}
                  className="cyber-clip-sm"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={navigateToToday}
                  className="cyber-clip-sm px-3"
                >
                  Today
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={navigateNext}
                  className="cyber-clip-sm"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
              <h2 className="text-lg font-semibold">{getNavigationTitle()}</h2>
              {loading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
            </div>

            {/* Filters */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Platform filter */}
              <select
                value={platformFilter}
                onChange={(e) => {
                  const value = e.target.value as PlatformFilter
                  setPlatformFilter(value)
                  updateUrl({ platform: value })
                }}
                className="h-9 px-3 text-sm border-2 border-border bg-card cyber-clip-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="all">All Platforms</option>
                <option value="youtube">YouTube</option>
                <option value="instagram">Instagram</option>
                <option value="tiktok">TikTok</option>
              </select>

              {/* Status filter */}
              <select
                value={statusFilter}
                onChange={(e) => {
                  const value = e.target.value as StatusFilter
                  setStatusFilter(value)
                  updateUrl({ status: value })
                }}
                className="h-9 px-3 text-sm border-2 border-border bg-card cyber-clip-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="all">All Statuses</option>
                <option value="scheduled">Scheduled</option>
                <option value="publishing">Publishing</option>
                <option value="published">Published</option>
                <option value="failed">Failed</option>
              </select>

              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                  className="text-muted-foreground hover:text-foreground"
                >
                  Clear filters
                </Button>
              )}
            </div>
          </div>

          {/* Status legend */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-blue-500" />
              <span>Scheduled</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-yellow-500" />
              <span>Publishing</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <span>Published</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-red-500" />
              <span>Failed</span>
            </div>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-500" />
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            <Button variant="outline" size="sm" onClick={loadPosts} className="ml-auto">
              Retry
            </Button>
          </div>
        )}

        {/* Day View - Timeline */}
        {currentView === 'day' && selectedDay && (
          <Card className="cyber-clip border-2">
            <CardContent className="pt-6">
              {(() => {
                const dayPosts = postsByDate[selectedDay.toDateString()] || []
                const postsByHour = groupPostsByHour(dayPosts)
                const hours = Array.from({ length: 24 }, (_, i) => i)
                const currentHour = new Date().getHours()
                const isToday = selectedDay.toDateString() === new Date().toDateString()

                return (
                  <div className="max-h-[600px] overflow-y-auto">
                    <div className="space-y-0">
                      {hours.map((hour) => {
                        const hourPosts = postsByHour[hour] || []
                        const isCurrentHour = isToday && hour === currentHour
                        const isPastHour = isToday && hour < currentHour

                        return (
                          <div
                            key={hour}
                            ref={isCurrentHour ? currentHourRef : undefined}
                            className={cn(
                              "relative flex border-t border-border min-h-[72px]",
                              isCurrentHour && "bg-primary/5",
                              isPastHour && "opacity-60"
                            )}
                          >
                            {/* Hour label */}
                            <div className="w-16 shrink-0 py-3 px-2 text-xs text-muted-foreground font-mono border-r border-border">
                              {hour.toString().padStart(2, '0')}:00
                            </div>

                            {/* Posts container */}
                            <div className="flex-1 p-2 min-w-0">
                              {hourPosts.length > 0 ? (
                                <div className="flex flex-wrap gap-2">
                                  {hourPosts.map((post) => (
                                    <div
                                      key={post.id}
                                      className={cn(
                                        "group flex items-center gap-2 p-2 cyber-clip-sm border text-sm flex-1 min-w-[280px] max-w-full",
                                        STATUS_COLORS[post.status] || STATUS_COLORS.scheduled
                                      )}
                                    >
                                      {/* Thumbnail */}
                                      <div className="w-12 h-8 cyber-clip-sm overflow-hidden bg-muted shrink-0">
                                        {post.short.thumbnailUrl ? (
                                          <Image
                                            src={post.short.thumbnailUrl}
                                            alt={post.title}
                                            width={48}
                                            height={32}
                                            className="w-full h-full object-cover"
                                          />
                                        ) : (
                                          <div className="w-full h-full flex items-center justify-center">
                                            <PlatformIcon platform={post.socialAccount.platform} size={16} />
                                          </div>
                                        )}
                                      </div>

                                      {/* Content */}
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1.5">
                                          <PlatformIcon platform={post.socialAccount.platform} size={12} />
                                          <span className="font-mono text-xs">{formatTime(post.scheduledFor)}</span>
                                          {STATUS_ICONS[post.status]}
                                        </div>
                                        <Link
                                          href={`/projects/${post.project.id}?shortId=${post.short.id}`}
                                          className="block truncate text-xs opacity-80 hover:opacity-100 hover:underline"
                                        >
                                          {post.title}
                                        </Link>
                                      </div>

                                      {/* Actions */}
                                      {post.status === 'scheduled' && (
                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                          <button
                                            onClick={() => openEditModal(post)}
                                            className="p-1.5 hover:bg-muted cyber-clip-sm"
                                            title="Edit"
                                          >
                                            <Pencil className="w-3.5 h-3.5" />
                                          </button>
                                          <button
                                            onClick={() => handleDeleteClick(post)}
                                            disabled={deleting === post.id}
                                            className="p-1.5 hover:bg-muted hover:text-red-500 cyber-clip-sm"
                                            title="Delete"
                                          >
                                            {deleting === post.id ? (
                                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                            ) : (
                                              <Trash2 className="w-3.5 h-3.5" />
                                            )}
                                          </button>
                                        </div>
                                      )}

                                      {/* External link for published posts */}
                                      {post.status === 'published' && post.platformUrl && (
                                        <a
                                          href={post.platformUrl}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="p-1.5 hover:bg-muted cyber-clip-sm shrink-0"
                                          title="View on platform"
                                        >
                                          <ExternalLink className="w-3.5 h-3.5" />
                                        </a>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              ) : null}
                            </div>

                            {/* Current time indicator line */}
                            {isCurrentHour && (
                              <div
                                className="absolute left-16 right-0 h-0.5 bg-primary neon-glow-subtle pointer-events-none z-10"
                                style={{ top: `${(new Date().getMinutes() / 60) * 100}%` }}
                              />
                            )}
                          </div>
                        )
                      })}
                    </div>

                    {/* Empty state overlay when no posts at all */}
                    {dayPosts.length === 0 && (
                      <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm">
                        <div className="text-center">
                          <CalendarDays className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                          <h3 className="text-lg font-medium mb-2">No posts scheduled</h3>
                          <p className="text-muted-foreground max-w-sm mx-auto">
                            No posts are scheduled for this day.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })()}
            </CardContent>
          </Card>
        )}

        {/* Week View */}
        {currentView === 'week' && (
          <Card className="cyber-clip border-2">
            <CardContent className="pt-6">
              {/* Week view - horizontal scroll on mobile */}
              <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 sm:overflow-visible">
                <div className="min-w-[600px] sm:min-w-0">
                  {/* Day headers */}
                  <div className="grid grid-cols-7 gap-2 mb-4">
                    {weekDays.map((day) => {
                      const isToday = day.toDateString() === today.toDateString()
                      return (
                        <div
                          key={day.toISOString()}
                          className={cn(
                            "text-center pb-2 border-b-2",
                            isToday ? "border-primary" : "border-border"
                          )}
                        >
                          <div className="text-xs text-muted-foreground uppercase">
                            <span className="sm:hidden">{day.toLocaleString('default', { weekday: 'narrow' })}</span>
                            <span className="hidden sm:inline">{day.toLocaleString('default', { weekday: 'short' })}</span>
                          </div>
                          <div className={cn(
                            "text-lg font-semibold",
                            isToday && "text-primary"
                          )}>
                            {day.getDate()}
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Week grid */}
                  <div className="grid grid-cols-7 gap-2 min-h-[400px]">
                {weekDays.map((day) => {
                  const isToday = day.toDateString() === today.toDateString()
                  const dayPosts = postsByDate[day.toDateString()] || []

                  return (
                    <div
                      key={day.toISOString()}
                      onClick={() => navigateToDay(day)}
                      className={cn(
                        "p-2 border-2 cyber-clip-sm transition-colors cursor-pointer hover:border-primary/50",
                        isToday ? "border-primary bg-primary/5" : "border-border bg-card"
                      )}
                    >
                      <div className="space-y-2">
                        {dayPosts.map((post) => (
                          <div
                            key={post.id}
                            className={cn(
                              "p-2 cyber-clip-sm border text-xs transition-colors",
                              STATUS_COLORS[post.status] || STATUS_COLORS.scheduled
                            )}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Link
                              href={`/projects/${post.project.id}?shortId=${post.short.id}`}
                              className="block hover:opacity-80"
                            >
                              <div className="flex items-center gap-1.5 mb-1">
                                <PlatformIcon platform={post.socialAccount.platform} size={14} />
                                <span className="font-medium">
                                  {formatTime(post.scheduledFor)}
                                </span>
                                {STATUS_ICONS[post.status]}
                              </div>
                              <div className="line-clamp-2 text-[11px] opacity-80">{post.title}</div>
                            </Link>
                          </div>
                        ))}
                        {dayPosts.length === 0 && (
                          <div className="text-center text-muted-foreground text-xs py-4">
                            No posts
                          </div>
                        )}
                      </div>
                    </div>
                  )
                  })}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Month View Calendar */}
        {currentView === 'month' && (
          <Card className="cyber-clip border-2">
            <CardContent className="pt-6">
              {/* Day headers */}
              <div className="grid grid-cols-7 gap-1 mb-2">
                {[
                  { short: 'S', full: 'Sun' },
                  { short: 'M', full: 'Mon' },
                  { short: 'T', full: 'Tue' },
                  { short: 'W', full: 'Wed' },
                  { short: 'T', full: 'Thu' },
                  { short: 'F', full: 'Fri' },
                  { short: 'S', full: 'Sat' },
                ].map((day, i) => (
                  <div
                    key={i}
                    className="text-center text-xs font-medium text-muted-foreground py-2 uppercase tracking-wider"
                  >
                    <span className="sm:hidden">{day.short}</span>
                    <span className="hidden sm:inline">{day.full}</span>
                  </div>
                ))}
              </div>

              {/* Calendar grid - horizontal scroll on mobile */}
              <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 sm:overflow-visible">
                <div className="grid grid-cols-7 gap-1 min-w-[600px] sm:min-w-0">
                {monthDays.map((day, index) => {
                  const isCurrentMonth = day.getMonth() === currentMonth
                  const isToday = day.toDateString() === today.toDateString()
                  const dayPosts = postsByDate[day.toDateString()] || []

                  return (
                    <div
                      key={index}
                      onClick={() => navigateToDay(day)}
                      className={cn(
                        "min-h-[120px] p-2 border-2 cyber-clip-sm transition-all cursor-pointer",
                        "hover:border-primary/50 hover:bg-muted/30",
                        isCurrentMonth ? "bg-card" : "bg-muted/20",
                        isToday ? "border-primary neon-glow-subtle" : "border-border"
                      )}
                    >
                      <div
                        className={cn(
                          "text-sm font-medium mb-1.5",
                          isCurrentMonth ? "text-foreground" : "text-muted-foreground",
                          isToday && "text-primary"
                        )}
                      >
                        {day.getDate()}
                      </div>

                      <div className="space-y-1">
                        {dayPosts.slice(0, 3).map((post) => (
                          <div
                            key={post.id}
                            className={cn(
                              "group relative p-1.5 cyber-clip-sm text-xs border transition-colors",
                              STATUS_COLORS[post.status] || STATUS_COLORS.scheduled
                            )}
                          >
                          <Link
                            href={`/projects/${post.project.id}?shortId=${post.short.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="block hover:opacity-80"
                          >
                            <div className="flex items-center gap-1 mb-0.5">
                              <PlatformIcon platform={post.socialAccount.platform} size={14} />
                              <span className="font-medium truncate">
                                {formatTime(post.scheduledFor)}
                              </span>
                              {STATUS_ICONS[post.status]}
                            </div>
                            <div className="truncate text-[10px] opacity-80">{post.title}</div>
                          </Link>

                          {/* Hover actions - only for scheduled posts */}
                          {post.status === 'scheduled' && (
                            <div className="absolute top-0.5 right-0.5 hidden group-hover:flex items-center gap-0.5 bg-background/95 cyber-clip-sm p-0.5">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  openEditModal(post)
                                }}
                                className="p-1 hover:bg-muted cyber-clip-sm"
                                title="Edit"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleDeleteClick(post)
                                }}
                                disabled={deleting === post.id}
                                className="p-1 hover:bg-muted hover:text-red-500 cyber-clip-sm"
                                title="Delete"
                              >
                                {deleting === post.id ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Trash2 className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                      {dayPosts.length > 3 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            navigateToDay(day)
                          }}
                          className="text-xs text-muted-foreground text-center hover:text-primary hover:underline cursor-pointer w-full"
                        >
                          +{dayPosts.length - 3} more
                        </button>
                      )}
                    </div>
                  </div>
                )
                })}
              </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Empty State */}
        {!loading && filteredPosts.length === 0 && (
          <Card className="cyber-clip border-2">
            <CardContent className="py-12">
              <div className="text-center">
                <CalendarDays className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">
                  {hasActiveFilters ? 'No matching posts' : 'No scheduled posts'}
                </h3>
                <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
                  {hasActiveFilters
                    ? 'Try adjusting your filters to see more posts.'
                    : 'Schedule your first short from any project, or connect your channels to get started.'}
                </p>
                <div className="flex items-center justify-center gap-3">
                  {hasActiveFilters ? (
                    <Button variant="outline" onClick={clearFilters} className="cyber-clip-sm">
                      Clear filters
                    </Button>
                  ) : (
                    <>
                      <Button asChild variant="outline" className="cyber-clip-sm">
                        <Link href="/settings/organization">Connect your channels</Link>
                      </Button>
                      <Button asChild className="cyber-clip-sm">
                        <Link href="/projects">Browse Projects</Link>
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Edit Post Modal */}
      <Dialog open={!!editingPost} onOpenChange={(open) => !open && closeEditModal()}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader className="pb-2">
            <DialogTitle className="text-base">Edit Scheduled Post</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            {/* Scheduled Time */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                Publish at
              </label>
              <Input
                type="datetime-local"
                value={editFormData.scheduledFor}
                onChange={(e) => setEditFormData({ ...editFormData, scheduledFor: e.target.value })}
                min={getMinDateTime()}
                className="w-auto text-sm h-9"
              />
            </div>

            {/* Title */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-muted-foreground">Title</label>
                <span className="text-[10px] text-muted-foreground">{editFormData.title.length}/100</span>
              </div>
              <Input
                type="text"
                value={editFormData.title}
                onChange={(e) => setEditFormData({ ...editFormData, title: e.target.value })}
                placeholder="Enter title"
                maxLength={100}
                className="h-9"
              />
            </div>

            {/* Description */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                Description <span className="font-normal">(optional)</span>
              </label>
              <textarea
                value={editFormData.description}
                onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                placeholder="Enter description"
                rows={3}
                className="w-full px-3 py-2 rounded-md border border-input bg-transparent text-sm resize-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring placeholder:text-muted-foreground"
              />
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button variant="ghost" size="sm" onClick={closeEditModal} disabled={saving}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSaveEdit} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                  Saving
                </>
              ) : (
                'Save'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-sm cyber-clip">
          <DialogHeader className="pb-2">
            <DialogTitle className="text-base text-red-500">Delete Scheduled Post</DialogTitle>
          </DialogHeader>

          {deleteTarget && (
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-16 h-10 cyber-clip-sm overflow-hidden bg-muted shrink-0">
                  {deleteTarget.short.thumbnailUrl ? (
                    <Image
                      src={deleteTarget.short.thumbnailUrl}
                      alt={deleteTarget.title}
                      width={64}
                      height={40}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <PlatformIcon platform={deleteTarget.socialAccount.platform} size={20} />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-sm line-clamp-1">{deleteTarget.title}</h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {new Date(deleteTarget.scheduledFor).toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                    <PlatformIcon platform={deleteTarget.socialAccount.platform} size={10} />
                    {deleteTarget.socialAccount.channelTitle || deleteTarget.socialAccount.platform}
                  </p>
                </div>
              </div>

              <p className="text-sm text-muted-foreground">
                This will cancel the scheduled publishing. This action cannot be undone.
              </p>
            </div>
          )}

          <DialogFooter className="pt-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDeleteTarget(null)}
              disabled={!!deleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={confirmDelete}
              disabled={!!deleting}
              className="cyber-clip-sm"
            >
              {deleting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                  Deleting
                </>
              ) : (
                'Delete'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </WorkspaceLayout>
  )
}
