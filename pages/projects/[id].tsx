import { useEffect, useState } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import dynamic from 'next/dynamic'
import { useApi } from '@/lib/api/client'
import WorkspaceLayout from '@/components/layout/WorkspaceLayout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Sparkles,
  Download,
  Play,
  Clock,
  Loader2,
} from 'lucide-react'
import type { Project, Short, Transcription } from '@/types/d1'

const ReactPlayer = dynamic(() => import('react-player'), { ssr: false })

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`
}

export default function ProjectDetail() {
  const router = useRouter()
  const { id } = router.query
  const { call } = useApi()

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
      const data = await call<{
        project: Project
        transcription: Transcription | null
        shorts: Short[]
      }>(`/api/projects/${id}`)

      setProject(data.project)
      setTranscription(data.transcription)
      setShorts(data.shorts || [])
    } catch (error) {
      console.error('Error loading project:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleAnalyze() {
    setAnalyzing(true)

    try {
      await call('/api/analyze', {
        method: 'POST',
        body: JSON.stringify({
          projectId: id,
        }),
      })

      await loadProjectData()
    } catch (error) {
      console.error('Error analyzing:', error)
    } finally {
      setAnalyzing(false)
    }
  }

  async function handleDownloadShort(short: Short) {
    try {
      const data = await call<{ downloadUrl: string }>(`/api/shorts/${short.id}/download`, {
        method: 'POST',
      })

      window.open(data.downloadUrl, '_blank')
    } catch (error) {
      console.error('Error downloading short:', error)
      alert('Failed to download short')
    }
  }

  async function handleDownloadAll() {
    alert(`Download all ${shorts.length} shorts as a ZIP file`)
  }

  function seekToTime(time: number) {
    setCurrentTime(time)
  }

  if (loading) {
    return (
      <WorkspaceLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-[#37b680]" />
        </div>
      </WorkspaceLayout>
    )
  }

  if (!project) {
    return (
      <WorkspaceLayout>
        <div className="flex items-center justify-center py-12">
          <p className="text-gray-400">Project not found</p>
        </div>
      </WorkspaceLayout>
    )
  }

  return (
    <>
      <Head>
        <title>{project.title} - VidEditor</title>
      </Head>

      <WorkspaceLayout title={project.title}>
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Video Player */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="bg-[#0f1419] border-gray-800">
              <CardHeader>
                <CardTitle className="text-white">{project.title}</CardTitle>
                <CardDescription className="text-gray-400">
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
              <Card className="bg-[#0f1419] border-gray-800">
                <CardHeader>
                  <CardTitle className="text-white">Transcription</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-300 leading-relaxed">
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
              <Card className="bg-[#0f1419] border-gray-800">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-white">
                    <Sparkles className="w-5 h-5 text-[#37b680]" />
                    Generate Shorts
                  </CardTitle>
                  <CardDescription className="text-gray-400">
                    Use AI to find the most engaging moments
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block text-gray-400">
                      Custom Instructions (optional)
                    </label>
                    <Input
                      placeholder="e.g., Focus on educational content"
                      value={customPrompt}
                      onChange={(e) => setCustomPrompt(e.target.value)}
                      disabled={analyzing}
                      className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500"
                    />
                  </div>
                  <Button
                    onClick={handleAnalyze}
                    disabled={analyzing}
                    className="w-full bg-[#37b680] hover:bg-[#37b680]/90 text-white"
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
              <Card className="bg-[#0f1419] border-gray-800">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-white">Suggested Shorts</CardTitle>
                      <CardDescription className="text-gray-400">{shorts.length} clips found</CardDescription>
                    </div>
                    <Button size="sm" onClick={handleDownloadAll} className="bg-[#37b680] hover:bg-[#37b680]/90 text-white">
                      <Download className="w-4 h-4 mr-2" />
                      All
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {shorts.map((short) => (
                    <Card
                      key={short.id}
                      className="bg-gray-800 border-gray-700 cursor-pointer hover:border-[#37b680]/50 transition-all"
                      onClick={() => setSelectedShort(short)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <h4 className="font-medium text-sm text-white">{short.title}</h4>
                          <span className="text-xs text-gray-400 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatDuration(short.end_time - short.start_time)}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 mb-3">
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
                            className="flex-1 bg-transparent border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-white"
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
                            className="flex-1 bg-[#37b680] hover:bg-[#37b680]/90 text-white"
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
      </WorkspaceLayout>
    </>
  )
}
