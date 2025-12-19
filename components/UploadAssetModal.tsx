import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, FileVideo, X, Video, Film, Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { useApi } from '@/lib/api/client'
import { useAuth } from '@clerk/nextjs'
import { formatFileSize } from '@/lib/utils'
import type { AssetType } from '@shared/index'

interface UploadAssetModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  onUploadComplete: () => void
}

type UploadStep = 'select-type' | 'upload'

export function UploadAssetModal({
  open,
  onOpenChange,
  projectId,
  onUploadComplete,
}: UploadAssetModalProps) {
  const { call } = useApi()
  const { getToken } = useAuth()

  const [step, setStep] = useState<UploadStep>('select-type')
  const [assetType, setAssetType] = useState<AssetType | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const resetState = () => {
    setStep('select-type')
    setAssetType(null)
    setFile(null)
    setUploading(false)
    setProgress(0)
    setError(null)
  }

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      resetState()
    }
    onOpenChange(newOpen)
  }

  const handleSelectType = (type: AssetType) => {
    setAssetType(type)
    setStep('upload')
  }

  const handleBack = () => {
    setStep('select-type')
    setAssetType(null)
    setFile(null)
    setError(null)
  }

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      const videoFile = acceptedFiles[0]

      // Validate file type
      if (!videoFile.type.startsWith('video/')) {
        setError('Please upload a valid video file')
        return
      }

      // Validate file size (2GB max)
      if (videoFile.size > 2 * 1024 * 1024 * 1024) {
        setError('File size must be less than 2GB')
        return
      }

      setFile(videoFile)
      setError(null)
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'video/*': ['.mp4', '.mov']
    },
    maxFiles: 1,
    disabled: uploading,
  })

  const uploadVideo = async () => {
    if (!file || !assetType) return

    setUploading(true)
    setProgress(0)
    setError(null)

    try {
      // Request presigned upload URL from the API
      const { mediaAssetId, uploadUrl, contentType } = await call<{
        mediaAssetId: string
        uploadUrl: string
        contentType: string
      }>('/v1/uploads', {
        method: 'POST',
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type,
          fileSizeBytes: file.size,
          projectId,
          assetType,
        }),
      })

      // Validate presigned URL
      if (!uploadUrl || !uploadUrl.startsWith('https://')) {
        throw new Error('Invalid upload URL received from server')
      }

      // Upload file directly to Tigris using XMLHttpRequest for progress tracking
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.open('PUT', uploadUrl, true)
        xhr.setRequestHeader('Content-Type', contentType)

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
        body: JSON.stringify({ projectId, mediaAssetId }),
      })

      // Success - close modal and notify parent
      handleOpenChange(false)
      onUploadComplete()
    } catch (error: any) {
      console.error('Upload failed:', error)
      setError(error.message || 'Failed to upload video')
    } finally {
      setUploading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="font-sans sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-foreground">
            {step === 'select-type' ? 'Upload Asset' : `Upload ${assetType === 'long_form' ? 'Long-form Video' : 'Short-form Clip'}`}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {step === 'select-type'
              ? 'Choose what type of content you want to upload.'
              : assetType === 'long_form'
                ? 'Upload a source video to generate shorts from.'
                : 'Upload an existing short-form clip.'}
          </DialogDescription>
        </DialogHeader>

        {step === 'select-type' && (
          <div className="grid grid-cols-2 gap-4 py-4">
            <button
              onClick={() => handleSelectType('long_form')}
              className="flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-border hover:border-primary/50 hover:bg-primary/5 transition-all duration-200"
            >
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                <Video className="w-7 h-7 text-primary" />
              </div>
              <div className="text-center">
                <p className="font-medium text-foreground">Long-form Video</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Source video for generating shorts
                </p>
              </div>
            </button>

            <button
              onClick={() => handleSelectType('short_form')}
              className="flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-border hover:border-primary/50 hover:bg-primary/5 transition-all duration-200"
            >
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                <Film className="w-7 h-7 text-primary" />
              </div>
              <div className="text-center">
                <p className="font-medium text-foreground">Short-form Clip</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Existing clip ready for publishing
                </p>
              </div>
            </button>
          </div>
        )}

        {step === 'upload' && (
          <div className="py-4">
            {!file ? (
              <div
                {...getRootProps()}
                className={`
                  border-2 border-dashed rounded-xl cursor-pointer transition-all duration-200 p-8
                  ${isDragActive
                    ? 'border-primary bg-primary/10'
                    : 'border-border hover:border-primary/50 hover:bg-secondary/30'
                  }
                  ${uploading ? 'opacity-50 cursor-not-allowed' : ''}
                `}
              >
                <input {...getInputProps()} />
                <div className="text-center">
                  <div className="mx-auto mb-3 w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <Upload className="w-6 h-6 text-primary" />
                  </div>
                  {isDragActive ? (
                    <p className="text-sm font-medium text-primary">Drop your video here...</p>
                  ) : (
                    <>
                      <p className="text-sm font-medium text-foreground mb-1">
                        Drag & drop or click to browse
                      </p>
                      <p className="text-xs text-muted-foreground">
                        MP4, MOV • Up to 2GB
                      </p>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div className="border border-border rounded-xl p-4 bg-card">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <FileVideo className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-sm text-foreground truncate max-w-[200px]">
                        {file.name}
                      </p>
                      <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
                    </div>
                  </div>
                  {!uploading && (
                    <button
                      onClick={() => setFile(null)}
                      className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-all duration-200"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {uploading && (
                  <div className="space-y-2">
                    <Progress value={progress} className="h-2" />
                    <p className="text-xs text-muted-foreground text-center">
                      Uploading... {Math.round(progress)}%
                    </p>
                  </div>
                )}
              </div>
            )}

            {error && (
              <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
                {error}
              </div>
            )}

            <div className="flex items-center justify-between mt-4">
              <Button
                variant="ghost"
                onClick={handleBack}
                disabled={uploading}
              >
                Back
              </Button>
              <Button
                onClick={uploadVideo}
                disabled={!file || uploading}
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Upload
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
