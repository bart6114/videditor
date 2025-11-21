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
            group relative border-2 border-dashed rounded-xl cursor-pointer transition-all duration-300
            ${isDragActive
              ? 'border-primary bg-primary/10 shadow-glow p-10'
              : 'border-border hover:border-primary/50 hover:bg-secondary/30 p-6 hover:p-10'
            }
            ${uploading ? 'opacity-50 cursor-not-allowed' : ''}
          `}
        >
          <input {...getInputProps()} />
          <div className="text-center">
            <div className={`mx-auto mb-3 w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center transition-all duration-300 ${
              isDragActive ? 'scale-110 bg-primary/20' : 'group-hover:scale-110 group-hover:bg-primary/15'
            }`}>
              <Upload className={`text-primary transition-all duration-300 ${
                isDragActive ? 'w-7 h-7' : 'w-6 h-6 group-hover:w-7 group-hover:h-7'
              }`} />
            </div>
            {isDragActive ? (
              <p className="text-lg font-medium text-primary">Drop your video here...</p>
            ) : (
              <>
                <p className="text-base font-medium text-foreground mb-1 transition-all duration-300">
                  Upload Video
                </p>
                <p className="text-sm text-muted-foreground mb-3">
                  Drag & drop or click to browse
                </p>
                <p className="text-xs text-muted-foreground/70">
                  MP4, MOV, AVI, MKV, WebM • Up to 1GB
                </p>
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="border border-border rounded-xl p-6 bg-card shadow-soft">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <FileVideo className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="font-medium text-foreground">{file.name}</p>
                <p className="text-sm text-muted-foreground">{formatFileSize(file.size)}</p>
              </div>
            </div>
            {!uploading && (
              <button
                onClick={() => setFile(null)}
                className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-all duration-200"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          {uploading && (
            <div className="space-y-3">
              <Progress value={progress} className="h-2" />
              <p className="text-sm text-muted-foreground text-center">
                Uploading... {Math.round(progress)}%
              </p>
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
              {error}
            </div>
          )}

          {!uploading && (
            <Button onClick={uploadVideo} className="w-full mt-4" size="lg">
              <Upload className="w-4 h-4 mr-2" />
              Upload & Start Processing
            </Button>
          )}
        </div>
      )}

      {error && !file && (
        <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
          {error}
        </div>
      )}
    </div>
  )
}
