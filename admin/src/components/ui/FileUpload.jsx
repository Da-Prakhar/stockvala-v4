import React, { useRef } from 'react'
import { Upload } from 'lucide-react'

export const FileUpload = ({ onFileSelect, accept = '*', label = 'Upload File', multiple = false }) => {
  const fileInputRef = useRef(null)

  const handleFileChange = (e) => {
    const files = e.target.files
    if (files) {
      if (multiple) {
        onFileSelect(Array.from(files))
      } else {
        onFileSelect(files[0])
      }
    }
  }

  return (
    <div>
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={handleFileChange}
        className="hidden"
      />
      <button
        onClick={() => fileInputRef.current?.click()}
        className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 dark:bg-primary-700 dark:hover:bg-primary-600 transition-colors"
      >
        <Upload className="w-4 h-4" />
        {label}
      </button>
    </div>
  )
}
