import React, { useState, useMemo } from 'react'
import { ChevronUp, ChevronDown } from 'lucide-react'

export const DataTable = ({
  columns,
  data,
  onRowClick,
  rowSelection = false,
  onSelectionChange,
  pageSize = 10,
}) => {
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' })
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedRows, setSelectedRows] = useState(new Set())

  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }))
    setCurrentPage(1)
  }

  const sortedData = useMemo(() => {
    if (!sortConfig.key) return data
    return [...data].sort((a, b) => {
      const aValue = a[sortConfig.key]
      const bValue = b[sortConfig.key]
      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1
      return 0
    })
  }, [data, sortConfig])

  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize
    return sortedData.slice(startIndex, startIndex + pageSize)
  }, [sortedData, currentPage, pageSize])

  const totalPages = Math.ceil(sortedData.length / pageSize) || 1

  const handleSelectAll = (checked) => {
    if (checked) {
      const newSelected = new Set(paginatedData.map((_, i) => i))
      setSelectedRows(newSelected)
      onSelectionChange?.(newSelected)
    } else {
      setSelectedRows(new Set())
      onSelectionChange?.(new Set())
    }
  }

  const handleSelectRow = (index, checked) => {
    const newSelected = new Set(selectedRows)
    if (checked) newSelected.add(index)
    else newSelected.delete(index)
    setSelectedRows(newSelected)
    onSelectionChange?.(newSelected)
  }

  if (!data || data.length === 0) {
    return (
      <div className="py-10 text-center text-dark-400 dark:text-dark-500 text-sm">
        No data available
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-dark-200 dark:border-dark-700">
            {rowSelection && (
              <th className="px-4 py-3 w-10">
                <input
                  type="checkbox"
                  checked={selectedRows.size === paginatedData.length && paginatedData.length > 0}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                  className="rounded"
                />
              </th>
            )}
            {columns.map((column) => (
              <th
                key={column.key}
                onClick={() => column.sortable && handleSort(column.key)}
                className={`px-4 py-3 text-left text-[11px] font-semibold text-dark-500 dark:text-dark-400 uppercase tracking-wider ${
                  column.sortable ? 'cursor-pointer hover:text-dark-700 dark:hover:text-dark-200 transition-colors' : ''
                }`}
              >
                <div className="flex items-center gap-1.5">
                  {column.label}
                  {column.sortable && sortConfig.key === column.key && (
                    sortConfig.direction === 'asc' ? (
                      <ChevronUp className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5" />
                    )
                  )}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {paginatedData.map((row, rowIndex) => (
            <tr
              key={rowIndex}
              onClick={() => onRowClick?.(row)}
              className="hover:bg-dark-50 dark:hover:bg-dark-700/40 transition-colors border-b border-dark-100 dark:border-dark-700/30 cursor-pointer"
            >
              {rowSelection && (
                <td className="px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={selectedRows.has(rowIndex)}
                    onChange={(e) => handleSelectRow(rowIndex, e.target.checked)}
                    onClick={(e) => e.stopPropagation()}
                    className="rounded"
                  />
                </td>
              )}
              {columns.map((column) => (
                <td key={column.key} className="px-4 py-3 text-sm text-dark-700 dark:text-dark-200">
                  {column.render ? column.render(row[column.key], row) : (row[column.key] ?? '—')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-dark-200 dark:border-dark-700/40">
          <div className="text-xs text-dark-500 dark:text-dark-500">
            {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, sortedData.length)} of {sortedData.length}
          </div>
          <div className="flex gap-1.5">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 rounded-md bg-dark-100 hover:bg-dark-200 dark:bg-dark-700 dark:hover:bg-dark-600 border border-dark-200 dark:border-dark-600 text-dark-600 dark:text-dark-300 text-xs font-medium disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              Prev
            </button>
            <span className="text-xs text-dark-500 flex items-center px-2">
              {currentPage}/{totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1 rounded-md bg-dark-100 hover:bg-dark-200 dark:bg-dark-700 dark:hover:bg-dark-600 border border-dark-200 dark:border-dark-600 text-dark-600 dark:text-dark-300 text-xs font-medium disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
