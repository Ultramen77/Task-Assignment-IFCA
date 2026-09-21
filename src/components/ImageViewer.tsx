import { useState } from 'react'
import { IconArrowLeft, IconArrowRight, IconX } from '@tabler/icons-react'

interface MockImage {
  id: string
  fileName: string
  fileUrl: string
  description: string
}

interface ImageViewerProps {
  images: MockImage[]
  currentIndex: number
  onClose: () => void
  onIndexChange: (index: number) => void
}

export default function ImageViewer({ images, currentIndex, onClose, onIndexChange }: ImageViewerProps) {
  const [imageError, setImageError] = useState(false)

  if (images.length === 0 || currentIndex < 0 || currentIndex >= images.length) return null
  const current = images[currentIndex]

  const next = () => {
    if (currentIndex < images.length - 1) onIndexChange(currentIndex + 1)
  }
  const prev = () => {
    if (currentIndex > 0) onIndexChange(currentIndex - 1)
  }

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-black/85 text-white">
      {/* Top Bar */}
      <div className="flex h-12 items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-medium truncate">{current.fileName}</span>
          <span className="text-xs text-white/40">({currentIndex + 1} of {images.length})</span>
        </div>
        <button
          onClick={onClose}
          aria-label="Close image viewer"
          className="rounded-lg p-2 text-white/70 hover:text-white hover:bg-white/10"
        >
          <IconX size={18} stroke={1.75} />
        </button>
      </div>

      {/* Main Preview */}
      <div className="flex flex-1 items-center justify-between px-3 pb-4 min-h-0 gap-3">
        <button
          onClick={prev}
          disabled={currentIndex === 0}
          aria-label="Previous image"
          className="rounded-lg border border-white/15 p-2.5 text-white/70 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
        >
          <IconArrowLeft size={20} stroke={1.75} />
        </button>

        <div className="flex max-h-full min-w-0 flex-col items-center justify-center">
          {imageError ? (
            <div className="flex min-h-[200px] items-center justify-center border border-white/10 px-6 text-sm text-white/40">
              Image unavailable
            </div>
          ) : (
            <img
              src={current.fileUrl}
              alt={current.description || current.fileName}
              onError={() => setImageError(true)}
              className="max-h-[75vh] max-w-full object-contain"
            />
          )}
          {current.description && (
            <p className="mt-3 text-sm text-white/70 max-w-xl text-center">{current.description}</p>
          )}
        </div>

        <button
          onClick={next}
          disabled={currentIndex === images.length - 1}
          aria-label="Next image"
          className="rounded-lg border border-white/15 p-2.5 text-white/70 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
        >
          <IconArrowRight size={20} stroke={1.75} />
        </button>
      </div>
    </div>
  )
}