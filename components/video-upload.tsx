import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, FileVideo, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { createClient } from '@/lib/supabase/client'
import { formatFileSize, formatDuration } from '@/lib/utils'
import type { Database } from '@/types/database'

interface VideoUploadProps {
  onUploadComplete: (projectId: string) => void
}

export function VideoUpload({ onUploadComplete }: VideoUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      const videoFile = acceptedFiles[0]

      // Validate file type
      if (!videoFile.type.startsWith('video/')) {
        setError('Please upload a valid video file')
        return
      }

      // Validate file size (500MB max)
      if (videoFile.size > 500 * 1024 * 1024) {
        setError('File size must be less than 500MB')
        return
      }

      setFile(videoFile)
      setError(null)
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'video/*': ['.mp4', '.mov', '.avi', '.mkv', '.webm']
    },
    maxFiles: 1,
    disabled: uploading,
  })

  const getVideoDuration = (file: File): Promise<number> => {
    return new Promise((resolve) => {
      const video = document.createElement('video')
      video.preload = 'metadata'

      video.onloadedmetadata = () => {
        window.URL.revokeObjectURL(video.src)
        resolve(video.duration)
      }

      video.src = URL.createObjectURL(file)
    })
  }

  const uploadVideo = async () => {
    if (!file) return

    setUploading(true)
    setProgress(0)
    setError(null)

    try {
      // Get user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // Get video duration
      const duration = await getVideoDuration(file)

      // Upload to Supabase Storage
      const fileExt = file.name.split('.').pop()
      const fileName = `${user.id}/${Date.now()}.${fileExt}`

      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 90) return prev
          return prev + 10
        })
      }, 200)

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('videos')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false,
        })

      clearInterval(progressInterval)
      setProgress(100)

      if (uploadError) throw uploadError

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('videos')
        .getPublicUrl(fileName)

      // Create project in database
      const projectData = {
        user_id: user.id,
        title: file.name.replace(/\.[^/.]+$/, ''),
        video_url: publicUrl,
        duration,
        file_size: file.size,
        status: 'processing' as const,
      }

      const { data: projectResult, error: projectError } = await (supabase as any)
        .from('projects')
        .insert(projectData)
        .select()
        .single()

      if (projectError) throw projectError
      const project = projectResult

      // Trigger transcription
      await fetch('/api/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: project.id }),
      })

      setFile(null)
      setProgress(0)
      onUploadComplete(project.id)
    } catch (error: any) {
      console.error('Upload error:', error)
      setError(error.message || 'Failed to upload video')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="w-full">
      {!file ? (
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${
            isDragActive
              ? 'border-blue-600 bg-blue-50'
              : 'border-gray-300 hover:border-blue-400'
          } ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <input {...getInputProps()} />
          <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
          {isDragActive ? (
            <p className="text-lg text-blue-600">Drop your video here...</p>
          ) : (
            <>
              <p className="text-lg mb-2">Drag & drop your video here</p>
              <p className="text-sm text-gray-500 mb-4">or click to browse</p>
              <p className="text-xs text-gray-400">
                Supports MP4, MOV, AVI, MKV, WebM (max 500MB)
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="border rounded-lg p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <FileVideo className="w-10 h-10 text-blue-600" />
              <div>
                <p className="font-medium">{file.name}</p>
                <p className="text-sm text-gray-500">{formatFileSize(file.size)}</p>
              </div>
            </div>
            {!uploading && (
              <button
                onClick={() => setFile(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          {uploading && (
            <div className="space-y-2">
              <Progress value={progress} />
              <p className="text-sm text-gray-600 text-center">
                Uploading... {Math.round(progress)}%
              </p>
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
              {error}
            </div>
          )}

          {!uploading && (
            <Button onClick={uploadVideo} className="w-full mt-4">
              Upload & Transcribe
            </Button>
          )}
        </div>
      )}

      {error && !file && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
          {error}
        </div>
      )}
    </div>
  )
}
