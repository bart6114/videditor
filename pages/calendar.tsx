import { useEffect, useState, useMemo } from 'react'
import Head from 'next/head'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useUser } from '@clerk/nextjs'
import { useApi } from '@/lib/api/client'
import WorkspaceLayout from '@/components/layout/WorkspaceLayout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
} from 'lucide-react'
import { SiYoutube } from '@icons-pack/react-simple-icons'
import { useYouTubeSchedulingEnabled } from '@/hooks/useFeatureFlag'

interface CalendarPost {
  id: string
  scheduledFor: string
  status: 'scheduled' | 'publishing' | 'published' | 'failed' | 'canceled'
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
  canceled: 'bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/20',
}

const STATUS_ICONS: Record<string, React.ReactNode> = {
  scheduled: <Clock className="w-3 h-3" />,
  publishing: <Loader2 className="w-3 h-3 animate-spin" />,
  published: <CheckCircle2 className="w-3 h-3" />,
  failed: <XCircle className="w-3 h-3" />,
  canceled: <XCircle className="w-3 h-3" />,
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

function formatTime(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export default function CalendarPage() {
  const router = useRouter()
  const { isSignedIn, isLoaded } = useUser()
  const { call } = useApi()
  const { enabled: schedulingEnabled, loading: flagLoading } = useYouTubeSchedulingEnabled()
  const [posts, setPosts] = useState<CalendarPost[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Calendar state
  const [currentDate, setCurrentDate] = useState(new Date())
  const currentYear = currentDate.getFullYear()
  const currentMonth = currentDate.getMonth()

  // View state
  type CalendarView = 'month' | 'day'
  const [currentView, setCurrentView] = useState<CalendarView>('month')
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)

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

  // Group posts by date
  const postsByDate = useMemo(() => {
    const grouped: Record<string, CalendarPost[]> = {}
    posts.forEach((post) => {
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
  }, [posts])

  const monthDays = useMemo(() => getMonthDays(currentYear, currentMonth), [currentYear, currentMonth])

  const navigatePreviousMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth - 1, 1))
  }

  const navigateNextMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth + 1, 1))
  }

  const navigateToToday = () => {
    setCurrentDate(new Date())
  }

  // Day view navigation
  const navigateToDay = (day: Date) => {
    setSelectedDay(day)
    setCurrentView('day')
    // Ensure we're viewing the correct month for post loading
    if (day.getMonth() !== currentMonth || day.getFullYear() !== currentYear) {
      setCurrentDate(new Date(day.getFullYear(), day.getMonth(), 1))
    }
  }

  const navigateToMonth = () => {
    setCurrentView('month')
    setSelectedDay(null)
  }

  const navigatePreviousDay = () => {
    if (!selectedDay) return
    const prevDay = new Date(selectedDay)
    prevDay.setDate(prevDay.getDate() - 1)
    navigateToDay(prevDay)
  }

  const navigateNextDay = () => {
    if (!selectedDay) return
    const nextDay = new Date(selectedDay)
    nextDay.setDate(nextDay.getDate() + 1)
    navigateToDay(nextDay)
  }

  const monthName = currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })
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
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold">Publishing Calendar</h1>
            <p className="text-muted-foreground mt-1">
              View and manage your scheduled YouTube Shorts
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={navigatePreviousMonth}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={navigateToToday}>
              Today
            </Button>
            <Button variant="outline" size="sm" onClick={navigateNextMonth}>
              <ChevronRight className="w-4 h-4" />
            </Button>
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

        {/* Day View */}
        {currentView === 'day' && selectedDay && (
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={navigateToMonth}>
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    Back
                  </Button>
                  <CardTitle className="text-lg">
                    {selectedDay.toLocaleDateString('default', {
                      weekday: 'long',
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </CardTitle>
                </div>
                <div className="flex items-center gap-2">
                  {loading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
                  <Button variant="outline" size="sm" onClick={navigatePreviousDay}>
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => navigateToDay(new Date())}>
                    Today
                  </Button>
                  <Button variant="outline" size="sm" onClick={navigateNextDay}>
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {(() => {
                const dayPosts = postsByDate[selectedDay.toDateString()] || []
                if (dayPosts.length === 0) {
                  return (
                    <div className="text-center py-12">
                      <CalendarDays className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                      <h3 className="text-lg font-medium mb-2">No posts scheduled</h3>
                      <p className="text-muted-foreground max-w-sm mx-auto">
                        No posts are scheduled for this day.
                      </p>
                    </div>
                  )
                }
                return (
                  <div className="divide-y divide-border">
                    {dayPosts.map((post) => (
                      <div key={post.id} className="py-4 first:pt-0 last:pb-0">
                        <div className="flex items-start gap-4">
                          {/* Thumbnail */}
                          <div className="w-20 h-12 rounded overflow-hidden bg-muted shrink-0">
                            {post.short.thumbnailUrl ? (
                              <Image
                                src={post.short.thumbnailUrl}
                                alt={post.title}
                                width={80}
                                height={48}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <SiYoutube className="w-6 h-6 text-muted-foreground" />
                              </div>
                            )}
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <h3 className="font-medium text-sm line-clamp-1">{post.title}</h3>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {new Date(post.scheduledFor).toLocaleString()}
                                </p>
                              </div>
                              <Badge
                                variant="outline"
                                className={`shrink-0 ${STATUS_COLORS[post.status] || ''}`}
                              >
                                <span className="flex items-center gap-1">
                                  {STATUS_ICONS[post.status]}
                                  {post.status}
                                </span>
                              </Badge>
                            </div>

                            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                              <span>
                                Project:{' '}
                                <Link
                                  href={`/projects/${post.project.id}`}
                                  className="text-primary hover:underline"
                                >
                                  {post.project.title}
                                </Link>
                              </span>
                              {post.socialAccount.channelTitle && (
                                <span>Channel: {post.socialAccount.channelTitle}</span>
                              )}
                            </div>

                            {post.status === 'published' && post.platformUrl && (
                              <a
                                href={post.platformUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 mt-2 text-xs text-primary hover:underline"
                              >
                                View on YouTube
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            )}

                            {post.status === 'failed' && post.errorMessage && (
                              <p className="mt-2 text-xs text-red-500">{post.errorMessage}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              })()}
            </CardContent>
          </Card>
        )}

        {/* Month View Calendar */}
        {currentView === 'month' && (
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">{monthName}</CardTitle>
              {loading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
            </div>
          </CardHeader>
          <CardContent>
            {/* Day headers */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                <div
                  key={day}
                  className="text-center text-xs font-medium text-muted-foreground py-2"
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-1">
              {monthDays.map((day, index) => {
                const isCurrentMonth = day.getMonth() === currentMonth
                const isToday = day.toDateString() === today.toDateString()
                const dayPosts = postsByDate[day.toDateString()] || []

                return (
                  <div
                    key={index}
                    onClick={() => navigateToDay(day)}
                    className={`min-h-[100px] p-2 border rounded-lg transition-colors cursor-pointer hover:bg-muted/50 ${
                      isCurrentMonth ? 'bg-card' : 'bg-muted/30'
                    } ${isToday ? 'ring-2 ring-primary' : 'border-border'}`}
                  >
                    <div
                      className={`text-sm font-medium mb-1 ${
                        isCurrentMonth ? 'text-foreground' : 'text-muted-foreground'
                      } ${isToday ? 'text-primary' : ''}`}
                    >
                      {day.getDate()}
                    </div>

                    <div className="space-y-1">
                      {dayPosts.slice(0, 3).map((post) => (
                        <Link
                          key={post.id}
                          href={`/projects/${post.project.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className={`block p-1.5 rounded text-xs border transition-colors hover:opacity-80 ${
                            STATUS_COLORS[post.status] || STATUS_COLORS.scheduled
                          }`}
                        >
                          <div className="flex items-center gap-1 mb-0.5">
                            <SiYoutube size={10} />
                            <span className="font-medium truncate">
                              {formatTime(post.scheduledFor)}
                            </span>
                            {STATUS_ICONS[post.status]}
                          </div>
                          <div className="truncate text-[10px] opacity-80">{post.title}</div>
                        </Link>
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
          </CardContent>
        </Card>
        )}

        {/* Upcoming Posts List - only in month view */}
        {currentView === 'month' && posts.length > 0 && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-lg">All Posts This Month</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="divide-y divide-border">
                {posts.map((post) => (
                  <div key={post.id} className="py-4 first:pt-0 last:pb-0">
                    <div className="flex items-start gap-4">
                      {/* Thumbnail */}
                      <div className="w-20 h-12 rounded overflow-hidden bg-muted shrink-0">
                        {post.short.thumbnailUrl ? (
                          <Image
                            src={post.short.thumbnailUrl}
                            alt={post.title}
                            width={80}
                            height={48}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <SiYoutube className="w-6 h-6 text-muted-foreground" />
                          </div>
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h3 className="font-medium text-sm line-clamp-1">{post.title}</h3>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {new Date(post.scheduledFor).toLocaleString()}
                            </p>
                          </div>
                          <Badge
                            variant="outline"
                            className={`shrink-0 ${STATUS_COLORS[post.status] || ''}`}
                          >
                            <span className="flex items-center gap-1">
                              {STATUS_ICONS[post.status]}
                              {post.status}
                            </span>
                          </Badge>
                        </div>

                        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                          <span>
                            Project:{' '}
                            <Link
                              href={`/projects/${post.project.id}`}
                              className="text-primary hover:underline"
                            >
                              {post.project.title}
                            </Link>
                          </span>
                          {post.socialAccount.channelTitle && (
                            <span>Channel: {post.socialAccount.channelTitle}</span>
                          )}
                        </div>

                        {post.status === 'published' && post.platformUrl && (
                          <a
                            href={post.platformUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 mt-2 text-xs text-primary hover:underline"
                          >
                            View on YouTube
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}

                        {post.status === 'failed' && post.errorMessage && (
                          <p className="mt-2 text-xs text-red-500">{post.errorMessage}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Empty State - only in month view */}
        {currentView === 'month' && !loading && posts.length === 0 && (
          <div className="text-center py-12">
            <CalendarDays className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No scheduled posts this month</h3>
            <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
              Schedule your first short from any project, or connect YouTube to get started.
            </p>
            <div className="flex items-center justify-center gap-3">
              <Button asChild variant="outline">
                <Link href="/settings/organization">Connect YouTube</Link>
              </Button>
              <Button asChild>
                <Link href="/projects">Browse Projects</Link>
              </Button>
            </div>
          </div>
        )}
      </div>
    </WorkspaceLayout>
  )
}
