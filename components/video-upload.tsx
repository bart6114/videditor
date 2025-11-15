import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, FileVideo, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { useApi } from '@/lib/api/client'
import { useUser } from '@clerk/nextjs'
import { formatFileSize } from '@/lib/utils'

interface VideoUploadProps {
  onUploadComplete: (projectId: string) => void
}

export function VideoUpload({ onUploadComplete }: VideoUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const { call } = useApi()
  const { user } = useUser()

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
    if (!file || !user) return

    setUploading(true)
    setProgress(0)
    setError(null)

    try {
      // Get video duration
      const duration = await getVideoDuration(file)

      // Request presigned upload URL from Worker
      const { projectId, uploadUrl, objectKey } = await call<{
        projectId: string
        uploadUrl: string
        objectKey: string
      }>('/api/upload', {
        method: 'POST',
        body: JSON.stringify({
          filename: file.name,
          fileSize: file.size,
          contentType: file.type,
        }),
      })

      // Upload directly to R2 using presigned URL
      setProgress(10)

      // For now, we'll use a simple XMLHttpRequest to track progress
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest()

        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            const percentComplete = (e.loaded / e.total) * 90 + 10
            setProgress(Math.round(percentComplete))
          }
        })

        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve()
          } else {
            reject(new Error(`Upload failed with status ${xhr.status}`))
          }
        })

        xhr.addEventListener('error', () => reject(new Error('Upload failed')))

        // Note: R2 multipart upload would be needed for large files
        // For now, direct PUT should work for files under 500MB
        xhr.open('PUT', uploadUrl, true)
        xhr.setRequestHeader('Content-Type', file.type)
        xhr.send(file)
      })

      setProgress(100)

      // Update project with duration
      await call(`/api/projects/${projectId}`, {
        method: 'PATCH',
        body: JSON.stringify({ duration }),
      })

      // Trigger transcription
      await call('/api/transcribe', {
        method: 'POST',
        body: JSON.stringify({ projectId }),
      })

      setFile(null)
      setProgress(0)
      onUploadComplete(projectId)
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
