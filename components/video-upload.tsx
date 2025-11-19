import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, FileVideo, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { useApi } from '@/lib/api/client'
import { useUser, useAuth } from '@clerk/nextjs'
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
  const { getToken } = useAuth()

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      const videoFile = acceptedFiles[0]

      // Validate file type
      if (!videoFile.type.startsWith('video/')) {
        setError('Please upload a valid video file')
        return
      }

      // Validate file size (1GB max)
      if (videoFile.size > 1024 * 1024 * 1024) {
        setError('File size must be less than 1GB')
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

  const uploadVideo = async () => {
    if (!file || !user) return

    setUploading(true)
    setProgress(0)
    setError(null)

    try {
      // Request presigned upload URL from the API
      const { projectId, uploadUrl, contentType } = await call<{
        projectId: string
        uploadUrl: string
        contentType: string
      }>('/v1/uploads', {
        method: 'POST',
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type,
          fileSizeBytes: file.size,
        }),
      })

      // Validate presigned URL
      if (!uploadUrl || !uploadUrl.startsWith('https://')) {
        throw new Error('Invalid upload URL received from server')
      }

      if (!projectId) {
        throw new Error('No project ID received from server')
      }

      console.log('[Upload] Backend signed Content-Type:', contentType)
      console.log('[Upload] Browser detected file.type:', file.type)
      console.log('[Upload] Uploading to:', uploadUrl.split('?')[0]) // Log without query params

      // Upload file directly to Tigris using XMLHttpRequest for progress tracking
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.open('PUT', uploadUrl, true)
        // CRITICAL: Use the exact contentType that was signed into the presigned URL
        // Using a different value will cause 403 Forbidden from Tigris
        xhr.setRequestHeader('Content-Type', contentType)
        console.log('[Upload] Sending PUT request with Content-Type:', contentType)

        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const percentage = Math.round((event.loaded / event.total) * 100)
            setProgress(percentage)
          }
        }

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            setProgress(100)
            resolve()
          } else {
            reject(new Error(`Upload failed with status ${xhr.status}: ${xhr.statusText}`))
          }
        }

        xhr.onerror = () => {
          reject(new Error('Network error during upload'))
        }

        xhr.ontimeout = () => {
          reject(new Error('Upload timed out'))
        }

        xhr.send(file)
      })

      // Notify the API that upload finished so processing can begin
      await call('/v1/uploads/complete', {
        method: 'POST',
        body: JSON.stringify({ projectId }),
      })

      // Upload complete - queue processing will handle transcription
      setFile(null)
      setProgress(0)
      onUploadComplete(projectId)
    } catch (error: any) {
      console.error('Upload failed:', error)
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
          className={`
            group relative border-2 border-dashed rounded-lg cursor-pointer transition-all duration-300
            ${isDragActive
              ? 'border-primary bg-primary/10 p-12'
              : 'border-border hover:border-primary p-3 hover:p-12'
            }
            ${uploading ? 'opacity-50 cursor-not-allowed' : ''}
          `}
        >
          <input {...getInputProps()} />
          <div className="text-center">
            <Upload className={`mx-auto text-muted-foreground transition-all duration-300 ${
              isDragActive ? 'w-12 h-12 mb-4 text-primary' : 'w-6 h-6 group-hover:w-12 group-hover:h-12 group-hover:mb-4 group-hover:text-primary'
            }`} />
            {isDragActive ? (
              <p className="text-lg text-primary">Drop your video here...</p>
            ) : (
              <>
                <p className="text-sm text-muted-foreground group-hover:text-lg group-hover:mb-2 transition-all duration-300">
                  Upload Video
                </p>
                <p className="text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-all duration-300 max-h-0 group-hover:max-h-20 group-hover:mb-4 overflow-hidden">
                  or drag & drop
                </p>
                <p className="text-xs text-muted-foreground/70 opacity-0 group-hover:opacity-100 transition-all duration-300 max-h-0 group-hover:max-h-20 overflow-hidden">
                  MP4, MOV, AVI, MKV, WebM • Resumable upload for any file size
                </p>
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="border border-border rounded-lg p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <FileVideo className="w-10 h-10 text-primary" />
              <div>
                <p className="font-medium text-foreground">{file.name}</p>
                <p className="text-sm text-muted-foreground">{formatFileSize(file.size)}</p>
              </div>
            </div>
            {!uploading && (
              <button
                onClick={() => setFile(null)}
                className="text-muted-foreground hover:text-foreground transition-colors duration-200"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          {uploading && (
            <div className="space-y-2">
              <Progress value={progress} />
              <p className="text-sm text-muted-foreground text-center">
                Uploading... {Math.round(progress)}%
              </p>
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 bg-destructive/10 border border-destructive/30 rounded-lg text-destructive text-sm">
              {error}
            </div>
          )}

          {!uploading && (
            <Button onClick={uploadVideo} className="w-full mt-4">
              Upload & Start Processing
            </Button>
          )}
        </div>
      )}

      {error && !file && (
        <div className="mt-4 p-3 bg-destructive/10 border border-destructive/30 rounded-lg text-destructive text-sm">
          {error}
        </div>
      )}
    </div>
  )
}
