import { useEffect, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { GetServerSideProps } from 'next'
import dynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase/client'
import { requireAuth } from '@/lib/utils/auth'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Scissors,
  ArrowLeft,
  Sparkles,
  Download,
  Play,
  Clock,
  Loader2,
} from 'lucide-react'
import { formatDuration } from '@/lib/utils'
import type { Database } from '@/types/database'

const ReactPlayer = dynamic(() => import('react-player'), { ssr: false })

type Project = Database['public']['Tables']['projects']['Row']
type Short = Database['public']['Tables']['shorts']['Row']
type Transcription = Database['public']['Tables']['transcriptions']['Row']

export const getServerSideProps: GetServerSideProps = requireAuth

export default function ProjectDetail() {
  const router = useRouter()
  const { id } = router.query
  const supabase = createClient()

  const [project, setProject] = useState<Project | null>(null)
  const [shorts, setShorts] = useState<Short[]>([])
  const [transcription, setTranscription] = useState<Transcription | null>(null)
  const [loading, setLoading] = useState(true)
  const [analyzing, setAnalyzing] = useState(false)
  const [customPrompt, setCustomPrompt] = useState('')
  const [currentTime, setCurrentTime] = useState(0)
  const [selectedShort, setSelectedShort] = useState<Short | null>(null)

  useEffect(() => {
    if (id) {
      loadProjectData()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function loadProjectData() {
    if (!id || typeof id !== 'string') return

    try {
      // Load project
      const { data: projectData, error: projectError } = await supabase
        .from('projects')
        .select('*')
        .eq('id', id)
        .single()

      if (projectError) throw projectError
      setProject(projectData)

      // Load transcription
      const { data: transcriptionData } = await supabase
        .from('transcriptions')
        .select('*')
        .eq('project_id', id)
        .single()

      setTranscription(transcriptionData)

      // Load shorts
      const { data: shortsData } = await supabase
        .from('shorts')
        .select('*')
        .eq('project_id', id)
        .order('start_time', { ascending: true })

      setShorts(shortsData || [])
    } catch (error) {
      console.error('Error loading project:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleAnalyze() {
    setAnalyzing(true)

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: id,
          customPrompt,
        }),
      })

      if (!response.ok) throw new Error('Analysis failed')

      await loadProjectData()
    } catch (error) {
      console.error('Error analyzing:', error)
    } finally {
      setAnalyzing(false)
    }
  }

  async function handleDownloadShort(short: Short) {
    // In production, this would download the actual cut video
    // For now, we'll just show an alert
    alert(`Download short: ${short.title}\nFrom ${formatDuration(short.start_time)} to ${formatDuration(short.end_time)}`)
  }

  async function handleDownloadAll() {
    alert(`Download all ${shorts.length} shorts as a ZIP file`)
  }

  function seekToTime(time: number) {
    setCurrentTime(time)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    )
  }

  if (!project) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Project not found</p>
      </div>
    )
  }

  return (
    <>
      <Head>
        <title>{project.title} - VidEditor</title>
      </Head>

      <main className="min-h-screen bg-gray-50">
        {/* Header */}
        <nav className="bg-white border-b">
          <div className="container mx-auto px-4 py-4">
            <Link href="/projects" className="inline-flex items-center text-gray-600 hover:text-blue-600">
              <ArrowLeft className="w-5 h-5 mr-2" />
              Back to Projects
            </Link>
          </div>
        </nav>

        <div className="container mx-auto px-4 py-8">
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Video Player */}
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>{project.title}</CardTitle>
                  <CardDescription>
                    Duration: {formatDuration(project.duration)}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="aspect-video bg-black rounded-lg overflow-hidden">
                    <ReactPlayer
                      url={project.video_url}
                      controls
                      width="100%"
                      height="100%"
                      onProgress={({ playedSeconds }) => setCurrentTime(playedSeconds)}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Transcription */}
              {transcription && (
                <Card>
                  <CardHeader>
                    <CardTitle>Transcription</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-gray-700 leading-relaxed">
                      {transcription.text}
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Shorts Panel */}
            <div className="space-y-6">
              {/* Analysis */}
              {transcription && shorts.length === 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-purple-600" />
                      Generate Shorts
                    </CardTitle>
                    <CardDescription>
                      Use AI to find the most engaging moments
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <label className="text-sm font-medium mb-2 block">
                        Custom Instructions (optional)
                      </label>
                      <Input
                        placeholder="e.g., Focus on educational content"
                        value={customPrompt}
                        onChange={(e) => setCustomPrompt(e.target.value)}
                        disabled={analyzing}
                      />
                    </div>
                    <Button
                      onClick={handleAnalyze}
                      disabled={analyzing}
                      className="w-full"
                    >
                      {analyzing ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Analyzing...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4 mr-2" />
                          Analyze with AI
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* Shorts List */}
              {shorts.length > 0 && (
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>Suggested Shorts</CardTitle>
                        <CardDescription>{shorts.length} clips found</CardDescription>
                      </div>
                      <Button size="sm" onClick={handleDownloadAll}>
                        <Download className="w-4 h-4 mr-2" />
                        All
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {shorts.map((short) => (
                      <Card
                        key={short.id}
                        className="cursor-pointer hover:shadow-md transition-shadow"
                        onClick={() => setSelectedShort(short)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between mb-2">
                            <h4 className="font-medium text-sm">{short.title}</h4>
                            <span className="text-xs text-gray-500 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {formatDuration(short.end_time - short.start_time)}
                            </span>
                          </div>
                          <p className="text-xs text-gray-600 mb-3">
                            {short.description}
                          </p>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation()
                                seekToTime(short.start_time)
                              }}
                              className="flex-1"
                            >
                              <Play className="w-3 h-3 mr-1" />
                              Preview
                            </Button>
                            <Button
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleDownloadShort(short)
                              }}
                              className="flex-1"
                            >
                              <Download className="w-3 h-3 mr-1" />
                              Download
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      </main>
    </>
  )
}
