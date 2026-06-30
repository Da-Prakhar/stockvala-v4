import { format, formatDistance } from 'date-fns'

export const formatCurrency = (value, currency = 'USD', decimals = 2) => {
  if (value === null || value === undefined) return '-'

  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })

  return formatter.format(value)
}

export const formatNumber = (value, decimals = 2) => {
  if (value === null || value === undefined) return '-'

  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)
}

export const formatPercent = (value, decimals = 2) => {
  if (value === null || value === undefined) return '-'

  return `${formatNumber(value, decimals)}%`
}

export const formatDate = (date, dateFormat = 'MMM dd, yyyy') => {
  if (!date) return '-'

  try {
    return format(new Date(date), dateFormat)
  } catch (error) {
    return '-'
  }
}

export const formatDateTime = (date, dateTimeFormat = 'MMM dd, yyyy HH:mm') => {
  if (!date) return '-'

  try {
    return format(new Date(date), dateTimeFormat)
  } catch (error) {
    return '-'
  }
}

export const formatTime = (date, timeFormat = 'HH:mm:ss') => {
  if (!date) return '-'

  try {
    return format(new Date(date), timeFormat)
  } catch (error) {
    return '-'
  }
}

export const formatRelativeTime = (date) => {
  if (!date) return '-'

  try {
    return formatDistance(new Date(date), new Date(), { addSuffix: true })
  } catch (error) {
    return '-'
  }
}

export const formatPips = (value, decimals = 2) => {
  if (value === null || value === undefined) return '-'
  return `${value > 0 ? '+' : ''}${formatNumber(value, decimals)}`
}

export const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes'

  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
}

export const formatAccountType = (type) => {
  const types = {
    demo: 'Demo Account',
    live: 'Live Account',
    micro: 'Micro Account',
    standard: 'Standard Account',
  }
  return types[type] || type
}

export const formatOrderStatus = (status) => {
  const statuses = {
    pending: 'Pending',
    open: 'Open',
    closed: 'Closed',
    cancelled: 'Cancelled',
    rejected: 'Rejected',
  }
  return statuses[status] || status
}

export const formatPaymentMethod = (method) => {
  const methods = {
    bank: 'Bank Transfer',
    card: 'Credit/Debit Card',
    usdt: 'USDT (Tether)',
    upi: 'UPI',
    angadiya: 'Angadiya',
  }
  return methods[method] || method
}

export const getStatusColor = (status) => {
  const colors = {
    pending: 'yellow',
    active: 'green',
    inactive: 'gray',
    approved: 'green',
    rejected: 'red',
    failed: 'red',
    success: 'green',
    warning: 'orange',
  }
  return colors[status] || 'gray'
}
