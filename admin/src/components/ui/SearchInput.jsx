import React, { useState, useEffect } from 'react'
import { Search, X } from 'lucide-react'

export const SearchInput = ({ onSearch, placeholder = 'Search...', debounceDelay = 300 }) => {
  const [value, setValue] = useState('')
  const [timeoutId, setTimeoutId] = useState(null)

  useEffect(() => {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }

    const id = setTimeout(() => {
      onSearch(value)
    }, debounceDelay)

    setTimeoutId(id)

    return () => {
      if (id) clearTimeout(id)
    }
  }, [value, onSearch, debounceDelay])

  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-dark-400 dark:text-dark-500" />
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-10 pr-10 py-2 border-2 border-dark-200 dark:border-dark-700 rounded-lg bg-white dark:bg-dark-800 text-dark-900 dark:text-dark-50 placeholder-dark-400 dark:placeholder-dark-500 focus:outline-none focus:border-primary-600 dark:focus:border-primary-500 focus:ring-2 focus:ring-primary-100 dark:focus:ring-primary-900"
      />
      {value && (
        <button
          onClick={() => setValue('')}
          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-dark-400 dark:text-dark-500 hover:text-dark-600 dark:hover:text-dark-400"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  )
}
