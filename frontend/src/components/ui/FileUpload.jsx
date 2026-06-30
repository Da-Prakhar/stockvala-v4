import React, { useState, useRef } from 'react'
import { Upload, X, File } from 'lucide-react'
import { formatFileSize } from '../../utils/formatters'

const FileUpload = ({
  onFileSelect,
  accept = '.pdf,.doc,.docx,.jpg,.jpeg,.png',
  maxSize = 5 * 1024 * 1024,
  multiple = false,
  label,
  error,
}) => {
  const [files, setFiles] = useState([])
  const [dragActive, setDragActive] = useState(false)
  const fileInputRef = useRef(null)

  const handleDrag = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    const droppedFiles = Array.from(e.dataTransfer.files)
    processFiles(droppedFiles)
  }

  const processFiles = (newFiles) => {
    const validFiles = newFiles.filter((file) => {
      if (file.size > maxSize) {
        console.warn(`File ${file.name} exceeds max size`)
        return false
      }
      return true
    })

    const filesToSet = multiple ? [...files, ...validFiles] : validFiles
    setFiles(filesToSet)
    onFileSelect(filesToSet)
  }

  const handleChange = (e) => {
    processFiles(Array.from(e.target.files))
  }

  const removeFile = (index) => {
    const newFiles = files.filter((_, i) => i !== index)
    setFiles(newFiles)
    onFileSelect(newFiles)
  }

  return (
    <div>
      {label && (
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
          {label}
        </label>
      )}

      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={`relative rounded-lg border-2 border-dashed transition-all duration-200 p-6 text-center ${
          dragActive
            ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
            : 'border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/50'
        } ${error ? 'border-red-500' : ''}`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple={multiple}
          accept={accept}
          onChange={handleChange}
          className="hidden"
        />

        <Upload className="h-8 w-8 mx-auto mb-2 text-slate-400" />
        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
          Drag and drop your files here
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          or{' '}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 font-medium"
          >
            click to select
          </button>
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
          Max file size: {formatFileSize(maxSize)}
        </p>
      </div>

      {files.length > 0 && (
        <div className="mt-4 space-y-2">
          {files.map((file, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700"
            >
              <div className="flex items-center gap-3">
                <File className="h-5 w-5 text-slate-400" />
                <div className="text-left">
                  <p className="text-sm font-medium text-slate-900 dark:text-white">
                    {file.name}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {formatFileSize(file.size)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => removeFile(index)}
                className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors"
              >
                <X className="h-4 w-4 text-slate-600 dark:text-slate-400" />
              </button>
            </div>
          ))}
        </div>
      )}

      {error && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  )
}

export default FileUpload
