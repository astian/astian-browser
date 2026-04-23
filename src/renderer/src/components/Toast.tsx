import React, { useState, useEffect } from 'react'
import { X, Download, RotateCcw, CheckCircle } from 'lucide-react'

export interface Toast {
  id: string
  type: 'info' | 'success' | 'warning' | 'error'
  title: string
  message: string
  duration?: number
  action?: {
    label: string
    onClick: () => void
  }
}

interface ToastProps {
  toast: Toast
  onClose: (id: string) => void
}

const ToastItem: React.FC<ToastProps> = ({ toast, onClose }) => {
  const [progress, setProgress] = useState(100)

  useEffect(() => {
    if (!toast.duration) return

    const startTime = Date.now()
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime
      const remaining = Math.max(0, 100 - (elapsed / toast.duration!) * 100)
      setProgress(remaining)

      if (remaining === 0) {
        clearInterval(interval)
        onClose(toast.id)
      }
    }, 50)

    return () => clearInterval(interval)
  }, [toast, onClose])

  const bgColor = {
    info: 'bg-blue-900/20 border-blue-700',
    success: 'bg-green-900/20 border-green-700',
    warning: 'bg-yellow-900/20 border-yellow-700',
    error: 'bg-red-900/20 border-red-700'
  }[toast.type]

  const iconColor = {
    info: 'text-blue-400',
    success: 'text-green-400',
    warning: 'text-yellow-400',
    error: 'text-red-400'
  }[toast.type]

  const Icon = {
    info: Download,
    success: CheckCircle,
    warning: RotateCcw,
    error: X
  }[toast.type]

  return (
    <div className={`${bgColor} border rounded-lg p-4 mb-3 shadow-lg backdrop-blur-sm`}>
      <div className="flex items-start gap-3">
        <Icon className={`${iconColor} w-5 h-5 flex-shrink-0 mt-0.5`} />
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-white text-sm">{toast.title}</h3>
          <p className="text-gray-300 text-xs mt-1">{toast.message}</p>
          {toast.action && (
            <button
              onClick={() => {
                toast.action!.onClick()
                onClose(toast.id)
              }}
              className="mt-2 text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors"
            >
              {toast.action.label}
            </button>
          )}
        </div>
        <button
          onClick={() => onClose(toast.id)}
          className="text-gray-400 hover:text-gray-200 transition-colors flex-shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      {toast.duration && (
        <div className="mt-2 h-1 bg-gray-700 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              {
                info: 'bg-blue-500',
                success: 'bg-green-500',
                warning: 'bg-yellow-500',
                error: 'bg-red-500'
              }[toast.type]
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  )
}

interface ToastContainerProps {
  toasts: Toast[]
  onClose: (id: string) => void
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onClose }) => {
  return (
    <div className="fixed bottom-4 right-4 z-50 w-96 max-w-[calc(100vw-2rem)] pointer-events-none">
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <ToastItem toast={toast} onClose={onClose} />
        </div>
      ))}
    </div>
  )
}
