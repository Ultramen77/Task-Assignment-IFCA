/* eslint-disable react/set-state-in-effect */
import { useState, useMemo, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTasks } from '../context/TaskContext'
import { getRemainingDays } from '../lib/dateUtils'
import StatusBadge from '../components/StatusBadge'
import TaskTypeBadge from '../components/TaskTypeBadge'
import DeadlineIndicator from '../components/DeadlineIndicator'
import EmptyState from '../components/EmptyState'
import TaskDetail from '../components/TaskDetail'
import { exportTeamAri } from '../lib/excelTeamAri'
import TaskForm from '../components/TaskForm'
import { IconSearch, IconChevronDown, IconPlus, IconChevronLeft, IconChevronRight, IconArrowUp, IconArrowDown, IconX, IconAdjustmentsHorizontal, IconMenu2 } from '@tabler/icons-react'

type SortField = 'id' | 'consultant' | 'type' | 'client' | 'screenReport' | 'status' | 'programmer' | 'targetDate'
type SortOrder = 'asc' | 'desc'

export default function TasksPage() {
  const { tasks, clients, consultants, programmers, loading, error } = useTasks()
  const [searchParams, setSearchParams] = useSearchParams()

  // Panel state
  const [activePanel, setActivePanel] = useState<'detail' | 'create' | 'edit' | null>(null)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)

  // Filters State
  const [searchQuery, setSearchQuery] = useState('')
  const [filterConsultant, setFilterConsultant] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterClient, setFilterClient] = useState('')
  const [filterProgrammer, setFilterProgrammer] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterSqlServer, setFilterSqlServer] = useState('')
  const [filterDatabase, setFilterDatabase] = useState('')
  const [filterOverdueOnly, setFilterOverdueOnly] = useState(false)
  const [showFilters, setShowFilters] = useState(false)

  // Export selection — checkbox per row (so export tidak harus semua)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // Sorting State
  const [sortField, setSortField] = useState<SortField>('id')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10 // Increased from 8 to 10 for better desktop flow

  // Sync state with search params (e.g. navigation from Dashboard or sidebar)
  const urlFilter = searchParams.get('filter')
  const urlStatus = searchParams.get('status')
  const urlId = searchParams.get('id')

  const ALLOWED_STATUSES = ['QC','Open','Assign','Done','Reject','Reopen','Hold','In Progress'] as const

  useEffect(() => {
    // Status param from sidebar has priority — e.g. /tasks?status=QC
    if (urlStatus && (ALLOWED_STATUSES as readonly string[]).includes(urlStatus)) {
      setFilterStatus(urlStatus)
      setFilterOverdueOnly(false)
      setCurrentPage(1)
      return
    }
    // Reset filters and apply presets based on the main category filter
    if (urlFilter) {
      setFilterConsultant('')
      setFilterType('')
      setFilterClient('')
      setFilterProgrammer('')
      setFilterStatus('')
      setFilterOverdueOnly(false)

      if (urlFilter === 'open') {
        setFilterStatus('Open')
      } else if (urlFilter === 'assigned') {
        setFilterStatus('Assign')
      } else if (urlFilter === 'completed') {
        setFilterStatus('Done')
      } else if (urlFilter === 'overdue') {
        setFilterOverdueOnly(true)
      }
    }
    // When navigating to /tasks?filter=all or plain /tasks, clear status-driven filter
    if (!urlFilter && !urlStatus) {
      // keep current dropdown value — don't force reset, just paginate
    }
    setCurrentPage(1)
  }, [urlFilter, urlStatus])

  useEffect(() => {
    if (urlId) {
      setSelectedTaskId(urlId)
      setActivePanel('detail')
    }
  }, [urlId])

  // Auto-prune selection if task removed/archived
  useEffect(() => {
    setSelectedIds(prev => {
      const keep = new Set<string>()
      const validIds = new Set(tasks.map(x => x.id))
      prev.forEach(id => { if (validIds.has(id)) keep.add(id) })
      return keep.size === prev.size ? prev : keep
    })
  }, [tasks])

  // Get distinct metadata for filter dropdowns directly from tasks
  const sqlServers = useMemo(() => {
    const set = new Set(tasks.map(t => t.sqlServer).filter(Boolean))
    return Array.from(set)
  }, [tasks])

  const databases = useMemo(() => {
    const set = new Set(tasks.map(t => t.database).filter(Boolean))
    return Array.from(set)
  }, [tasks])

  const consultantOptions = useMemo(() => {
    const fromMaster = consultants.map(c => c.name)
    const fromTasks = tasks.map(t => t.consultant).filter(Boolean) as string[]
    return Array.from(new Set([...fromMaster, ...fromTasks])).sort((a, b) => a.localeCompare(b))
  }, [consultants, tasks])

  const typeOptions = useMemo(() => {
    const distinct = Array.from(new Set(tasks.map(t => t.type).filter(Boolean) as string[]))
    const base = ['Bugs', 'Improvements'] as string[]
    return Array.from(new Set([...base, ...distinct])).sort()
  }, [tasks])

  // Get current header category title based on urlFilter / urlStatus
  const getHeaderTitle = () => {
    if (urlStatus && (ALLOWED_STATUSES as readonly string[]).includes(urlStatus)) {
      return `${urlStatus} Tasks`
    }
    switch (urlFilter) {
      case 'open':
        return 'Open Tasks'
      case 'assigned':
        return 'Assigned Tasks'
      case 'overdue':
        return 'Overdue Tasks'
      case 'completed':
        return 'Completed Tasks'
      case 'archived':
        return 'Archived Tasks'
      default:
        return 'All Active Tasks'
    }
  }

  // Count active filters (except sidebar query params)
  const activeFiltersCount = useMemo(() => {
    let count = 0
    if (filterConsultant) count++
    if (filterType) count++
    if (filterClient) count++
    if (filterProgrammer) count++
    const statusDrivenBySidebar = !!(urlStatus && (ALLOWED_STATUSES as readonly string[]).includes(urlStatus)) || urlFilter === 'open' || urlFilter === 'assigned' || urlFilter === 'completed'
    if (filterStatus && !statusDrivenBySidebar) count++
    if (filterSqlServer) count++
    if (filterDatabase) count++
    if (filterOverdueOnly && urlFilter !== 'overdue') count++
    if (searchQuery.trim()) count++
    return count
  }, [filterConsultant, filterType, filterClient, filterProgrammer, filterStatus, filterSqlServer, filterDatabase, filterOverdueOnly, searchQuery, urlFilter, urlStatus])

  // Process & Filter Tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      // 1. Sidebar Category Filters (completed/archived)
      if (urlFilter === 'archived') {
        if (!task.archived) return false
      } else {
        if (task.archived) return false
        if (urlFilter === 'completed' && task.status !== 'Done') return false
      }

      // 2. Global search match
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase()
        const match =
          task.id.toLowerCase().includes(query) ||
          task.client.toLowerCase().includes(query) ||
          task.screenReport.toLowerCase().includes(query) ||
          task.request.toLowerCase().includes(query) ||
          task.consultant.toLowerCase().includes(query) ||
          task.programmer.toLowerCase().includes(query) ||
          task.sqlServer.toLowerCase().includes(query) ||
          task.database.toLowerCase().includes(query) ||
          task.notes.toLowerCase().includes(query)

        if (!match) return false
      }

      // 3. Dropdown Filters
      if (filterConsultant && task.consultant !== filterConsultant) return false
      if (filterType && task.type !== filterType) return false
      if (filterClient && task.client !== filterClient) return false
      if (filterProgrammer && task.programmer !== filterProgrammer) return false
      if (filterStatus && task.status !== filterStatus) return false
      if (filterSqlServer && task.sqlServer !== filterSqlServer) return false
      if (filterDatabase && task.database !== filterDatabase) return false

      // 4. Overdue filter
      if (filterOverdueOnly) {
        if (task.status === 'Done' || !task.targetDate) return false
        const rem = getRemainingDays(task.targetDate)
        if (rem === null || rem >= 0) return false
      }

      return true
    })
  }, [tasks, urlFilter, searchQuery, filterConsultant, filterType, filterClient, filterProgrammer, filterStatus, filterSqlServer, filterDatabase, filterOverdueOnly])

  // Sort Tasks
  const sortedTasks = useMemo(() => {
    return [...filteredTasks].sort((a, b) => {
      let valA = a[sortField] ?? ''
      let valB = b[sortField] ?? ''

      if (sortField === 'id') {
        const numA = parseInt(a.id.replace('TASK-', ''))
        const numB = parseInt(b.id.replace('TASK-', ''))
        return sortOrder === 'asc' ? numA - numB : numB - numA
      }

      if (sortField === 'targetDate') {
        const dateA = valA ? new Date(valA).getTime() : 9999999999999
        const dateB = valB ? new Date(valB).getTime() : 9999999999999
        return sortOrder === 'asc' ? dateA - dateB : dateB - dateA
      }

      valA = String(valA).toLowerCase()
      valB = String(valB).toLowerCase()

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1
      return 0
    })
  }, [filteredTasks, sortField, sortOrder])

  // Pagination logic
  const paginatedTasks = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage
    return sortedTasks.slice(startIndex, startIndex + itemsPerPage)
  }, [sortedTasks, currentPage, itemsPerPage])

  const totalPages = Math.ceil(sortedTasks.length / itemsPerPage)

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortOrder('asc')
    }
  }

  const handleRowClick = (taskId: string) => {
    setSelectedTaskId(taskId)
    setActivePanel('detail')
    const params = new URLSearchParams(searchParams)
    params.set('id', taskId)
    setSearchParams(params)
  }

  const handleClosePanel = () => {
    setActivePanel(null)
    setSelectedTaskId(null)
    const params = new URLSearchParams(searchParams)
    params.delete('id')
    setSearchParams(params)
  }

  const handleExport = async (mode: 'selection' | 'filtered' | 'all' = 'selection') => {
    try {
      if (mode === 'selection' && selectedIds.size > 0) {
        const picked = filteredTasks.filter(x => selectedIds.has(x.id))
        const list = picked.length ? picked : tasks.filter(x => selectedIds.has(x.id))
        if (!list.length) { alert('Tidak ada task terpilih yang cocok dengan filter.'); return }
        await exportTeamAri(list)
        return
      }
      if (mode === 'filtered') {
        if (!filteredTasks.length) { alert('Tidak ada data untuk di-export (filter kosong).'); return }
        await exportTeamAri(filteredTasks)
        return
      }
      // all = semua task aktif (atau filtered jika ada)
      const list = filteredTasks.length ? filteredTasks : tasks.filter(x => !x.archived)
      if (!list.length) { alert('Tidak ada data untuk di-export.'); return }
      await exportTeamAri(list)
    } catch (err: any) {
      alert(err.message || 'Export gagal')
    }
  }
  const selectedCount = selectedIds.size
  const filteredIds = new Set(filteredTasks.map(x => x.id))
  const allFilteredSelected = filteredTasks.length > 0 && filteredTasks.every(x => selectedIds.has(x.id))
  const toggleAllFiltered = () => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (allFilteredSelected) {
        filteredTasks.forEach(x => next.delete(x.id))
      } else {
        filteredTasks.forEach(x => next.add(x.id))
      }
      return next
    })
  }
  const toggleOne = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  const handleOpenCreate = () => {
    setActivePanel('create')
    setSelectedTaskId(null)
  }

  const handleEditClick = (taskId: string) => {
    setSelectedTaskId(taskId)
    setActivePanel('edit')
  }

  // chips helpers for active filters
  const filterChips: { label: string; onClear: () => void }[] = []
  if (filterConsultant) filterChips.push({ label: `Consultant: ${filterConsultant}`, onClear: () => setFilterConsultant('') })
  if (filterType) filterChips.push({ label: `Type: ${filterType}`, onClear: () => setFilterType('') })
  if (filterClient) filterChips.push({ label: `Client: ${filterClient}`, onClear: () => setFilterClient('') })
  if (filterProgrammer) filterChips.push({ label: `Programmer: ${filterProgrammer}`, onClear: () => setFilterProgrammer('') })
  if (filterStatus) filterChips.push({ label: `Status: ${filterStatus}`, onClear: () => setFilterStatus('') })
  if (filterSqlServer) filterChips.push({ label: `SQL: ${filterSqlServer}`, onClear: () => setFilterSqlServer('') })
  if (filterDatabase) filterChips.push({ label: `DB: ${filterDatabase}`, onClear: () => setFilterDatabase('') })
  if (filterOverdueOnly) filterChips.push({ label: 'Overdue', onClear: () => setFilterOverdueOnly(false) })
  if (searchQuery.trim()) filterChips.push({ label: `Search: "${searchQuery.trim()}"`, onClear: () => setSearchQuery('') })

  const clearAllFilters = () => {
    setSearchQuery('')
    setFilterConsultant('')
    setFilterType('')
    setFilterClient('')
    setFilterProgrammer('')
    setFilterStatus('')
    setFilterSqlServer('')
    setFilterDatabase('')
    setFilterOverdueOnly(false)
  }

  return (
    <div className="flex h-[calc(100vh-80px)] relative overflow-hidden gap-4 text-sm">
      {/* List Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {error && (
          <div className="mb-4 rounded-2xl glass border-red-400/20 bg-red-500/10 p-3 text-xs font-mono text-red-300 flex justify-between items-center shrink-0">
            <span>Error: {error}</span>
            <button onClick={() => window.location.reload()} className="underline font-bold">[Retry]</button>
          </div>
        )}

        {/* Page Title & Search Header — compact */}
        <div className="flex flex-col gap-2 mb-3">
          <div className="flex flex-wrap gap-2 items-center justify-between">
            <h2 className="text-base font-semibold tracking-tight text-slate-800 flex items-center gap-2">
              <span>{getHeaderTitle()}</span>
              <span className="text-xs glass-subtle text-slate-500 px-2 py-0.5 rounded-full font-mono font-normal border border-slate-200 bg-white">
                {filteredTasks.length} tasks
              </span>
            </h2>
            <div className="flex items-center gap-1.5 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"><IconSearch size={15} stroke={1.75} /></span>
                <input
                  type="text"
                  placeholder="Search tasks..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full rounded-full bg-white border border-slate-200 pl-7 pr-3 py-2 focus:outline-none focus:border-violet-300 focus:ring-1 focus:ring-violet-200 placeholder:text-slate-400 text-slate-700 text-xs"
                />
              </div>
              <button
                onClick={() => setShowFilters(v => !v)}
                aria-expanded={showFilters}
                aria-controls="filter-panel"
                className={`shrink-0 inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-semibold font-mono transition-colors ${activeFiltersCount > 0 ? 'bg-slate-900 text-white border-slate-900 shadow' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'} ${showFilters ? 'ring-1 ring-violet-300' : ''}`}
              >
                <span className="hidden sm:inline">Filter</span>
                <span className="sm:hidden"><IconAdjustmentsHorizontal size={15} stroke={1.75} /></span>
                {activeFiltersCount > 0 && <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${activeFiltersCount > 0 && !showFilters ? 'bg-white text-slate-900' : 'bg-white/20 text-white'}`}>{activeFiltersCount}</span>}
                <span className={`transition-transform ${showFilters ? 'rotate-180' : ''}`}><IconChevronDown size={14} stroke={1.75} /></span>
              </button>
              <button
                onClick={handleOpenCreate}
                className="shrink-0 rounded-full bg-slate-900 text-white px-4 py-2 text-xs font-semibold hover:bg-slate-800 transition-colors shadow"
              >
                <span className="hidden sm:inline">New Task</span>
                <span className="sm:hidden"><IconPlus size={16} stroke={2} /></span>
              </button>
            </div>
          </div>
          {/* desktop export — keep visible on sm+ outside panel */}
          <div className="hidden sm:flex items-center gap-1.5">
            <button
              onClick={() => handleExport('selection')}
              disabled={selectedCount===0}
              className="rounded-full bg-white border border-slate-200 text-slate-700 px-3 py-1.5 text-xs font-semibold hover:bg-slate-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              title={selectedCount? `Export ${selectedCount} terpilih ke TEAM ARI (.xlsx)` : 'Pilih task dulu (centang di tabel)'}
            >
              Export Pilihan{selectedCount? ` (${selectedCount})`:''}
            </button>
            <button
              onClick={() => handleExport('filtered')}
              disabled={filteredTasks.length===0}
              className="rounded-full bg-white border border-slate-200 text-slate-600 px-3 py-1.5 text-xs font-semibold hover:bg-slate-50 transition-colors disabled:opacity-30"
              title="Export hasil filter saat ini"
            >
              Export Filter ({filteredTasks.length})
            </button>
            {activeFiltersCount > 0 && (
              <button
                onClick={clearAllFilters}
                className="rounded-full bg-white border border-slate-200 text-slate-600 px-3 py-1.5 text-xs font-mono hover:bg-slate-50"
              >
                Clear filters ({activeFiltersCount})
              </button>
            )}
          </div>
        </div>

        {selectedCount > 0 && (
          <div className="flex items-center gap-2 text-xs font-mono mb-2">
            <span className="text-slate-500">{selectedCount} terpilih</span>
            <button onClick={() => setSelectedIds(new Set())} className="rounded-full bg-white border border-slate-200 px-2.5 py-1 text-slate-500 hover:text-slate-700">Clear pilihan</button>
            <button onClick={() => handleExport('selection')} className="rounded-full bg-slate-900 text-white px-3 py-1 font-semibold">Export Pilihan</button>
          </div>
        )}

        {/* Active filter chips — visible even when panel collapsed */}
        {filterChips.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 mb-3">
            {filterChips.map(chip => (
              <span key={chip.label} className="inline-flex items-center gap-1 rounded-full bg-violet-50 border border-violet-200 text-violet-700 px-2.5 py-1 text-[11px] font-mono">
                {chip.label}
                <button onClick={chip.onClear} className="ml-0.5 rounded-full hover:bg-violet-100 w-4 h-4 grid place-items-center leading-none" aria-label={`Clear ${chip.label}`}><IconX size={12} stroke={2} /></button>
              </span>
            ))}
            <button onClick={clearAllFilters} className="text-[11px] font-mono text-slate-400 hover:text-slate-600 underline">Clear all</button>
          </div>
        )}

        {/* Collapsible Filter Panel — accordion */}
        <div
          id="filter-panel"
          className={`grid transition-all duration-200 ease-out ${showFilters ? 'grid-rows-[1fr] opacity-100 mb-3' : 'grid-rows-[0fr] opacity-0'}`}
        >
          <div className="overflow-hidden">
            <div className="glass rounded-2xl p-3 border border-slate-200 bg-white/80">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold tracking-widest text-slate-400 uppercase font-mono">Filters</span>
                <div className="flex items-center gap-1.5">
                  {activeFiltersCount > 0 && <span className="text-[11px] font-mono text-slate-500">{activeFiltersCount} aktif</span>}
                  <button onClick={clearAllFilters} disabled={activeFiltersCount===0} className="text-[11px] font-mono text-slate-500 hover:text-slate-700 disabled:opacity-30 underline">Reset</button>
                  <button onClick={() => setShowFilters(false)} className="rounded-full bg-slate-900 text-white px-2.5 py-1 text-[11px] font-mono">Tutup</button>
                </div>
              </div>
              <div className="grid grid-cols-1 grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 gap-2 text-xs font-mono">
                <select
                  value={filterConsultant}
                  onChange={e => setFilterConsultant(e.target.value)}
                  className={`w-full rounded-xl bg-white border px-2.5 py-2.5 text-xs focus:outline-none focus:border-violet-300 focus:ring-1 focus:ring-violet-200 ${filterConsultant ? 'border-violet-300 bg-violet-50 font-semibold text-violet-700' : 'border-slate-200 text-slate-600'}`}
                >
                  <option value="">Consultant</option>
                  {consultantOptions.map(name => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
                <select
                  value={filterType}
                  onChange={e => setFilterType(e.target.value)}
                  className={`w-full rounded-xl bg-white border px-2.5 py-2.5 text-xs focus:outline-none focus:border-violet-300 focus:ring-1 focus:ring-violet-200 ${filterType ? 'border-violet-300 bg-violet-50 font-semibold text-violet-700' : 'border-slate-200 text-slate-600'}`}
                >
                  <option value="">Type</option>
                  {typeOptions.map(tp => (
                    <option key={tp} value={tp}>{tp}</option>
                  ))}
                </select>
                <select
                  value={filterClient}
                  onChange={e => setFilterClient(e.target.value)}
                  className={`w-full rounded-xl bg-white border px-2.5 py-2.5 text-xs focus:outline-none focus:border-violet-300 focus:ring-1 focus:ring-violet-200 ${filterClient ? 'border-violet-300 bg-violet-50 font-semibold text-violet-700' : 'border-slate-200 text-slate-600'}`}
                >
                  <option value="">Client</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                  ))}
                </select>
                <select
                  value={filterProgrammer}
                  onChange={e => setFilterProgrammer(e.target.value)}
                  className={`w-full rounded-xl bg-white border px-2.5 py-2.5 text-xs focus:outline-none focus:border-violet-300 focus:ring-1 focus:ring-violet-200 ${filterProgrammer ? 'border-violet-300 bg-violet-50 font-semibold text-violet-700' : 'border-slate-200 text-slate-600'}`}
                >
                  <option value="">Programmer</option>
                  {programmers.map(p => (
                    <option key={p.id} value={p.name}>{p.name}</option>
                  ))}
                </select>
                <select
                  value={filterStatus}
                  onChange={e => setFilterStatus(e.target.value)}
                  className={`w-full rounded-xl bg-white border px-2.5 py-2.5 text-xs focus:outline-none focus:border-violet-300 focus:ring-1 focus:ring-violet-200 ${filterStatus ? 'border-violet-300 bg-violet-50 font-semibold text-violet-700' : 'border-slate-200 text-slate-600'}`}
                  disabled={!!urlStatus || urlFilter === 'open' || urlFilter === 'assigned' || urlFilter === 'completed'}
                >
                  <option value="">Status</option>
                  <option value="QC">QC</option>
                  <option value="Open">Open</option>
                  <option value="Assign">Assign</option>
                  <option value="Done">Done</option>
                  <option value="Reject">Reject</option>
                  <option value="Reopen">Reopen</option>
                  <option value="Hold">Hold</option>
                  <option value="In Progress">In Progress</option>
                </select>
                <select
                  value={filterSqlServer}
                  onChange={e => setFilterSqlServer(e.target.value)}
                  className={`w-full rounded-xl bg-white border px-2.5 py-2.5 text-xs focus:outline-none focus:border-violet-300 focus:ring-1 focus:ring-violet-200 ${filterSqlServer ? 'border-violet-300 bg-violet-50 font-semibold text-violet-700' : 'border-slate-200 text-slate-600'}`}
                >
                  <option value="">SQL Server</option>
                  {sqlServers.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <select
                  value={filterDatabase}
                  onChange={e => setFilterDatabase(e.target.value)}
                  className={`w-full rounded-xl bg-white border px-2.5 py-2.5 text-xs focus:outline-none focus:border-violet-300 focus:ring-1 focus:ring-violet-200 ${filterDatabase ? 'border-violet-300 bg-violet-50 font-semibold text-violet-700' : 'border-slate-200 text-slate-600'}`}
                >
                  <option value="">Database</option>
                  {databases.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
                <label className={`flex items-center justify-center gap-1.5 rounded-xl border px-2.5 py-2.5 cursor-pointer select-none bg-white ${filterOverdueOnly ? 'border-violet-300 bg-violet-50 font-semibold text-violet-700' : 'border-slate-200 text-slate-600'}`}>
                  <input
                    type="checkbox"
                    checked={filterOverdueOnly}
                    onChange={e => setFilterOverdueOnly(e.target.checked)}
                    className="rounded border-slate-300 text-violet-600 focus:ring-violet-500 h-3.5 w-3.5"
                    disabled={urlFilter === 'overdue'}
                  />
                  <span className="text-xs">Overdue</span>
                </label>
              </div>
              {/* mobile export inside panel */}
              <div className="flex sm:hidden gap-2 mt-3">
                <button onClick={() => handleExport('selection')} disabled={selectedCount===0} className="flex-1 rounded-full bg-white border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-30">Export Pilihan{selectedCount? ` (${selectedCount})`:''}</button>
                <button onClick={() => handleExport('filtered')} disabled={filteredTasks.length===0} className="flex-1 rounded-full bg-white border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 disabled:opacity-30">Export Filter ({filteredTasks.length})</button>
              </div>
            </div>
          </div>
        </div>

        {/* Tasks Table */}
        <div className="flex-1 glass rounded-2xl overflow-auto min-h-0 relative">
          {loading ? (
            <div className="p-6" role="status" aria-label="Loading tasks">
              <div className="space-y-3">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="skeleton h-4 w-4 shrink-0" />
                    <div className="skeleton h-4 w-20 shrink-0" />
                    <div className="skeleton h-4 w-24 shrink-0" />
                    <div className="skeleton h-4 w-24 shrink-0" />
                    <div className="skeleton h-4 w-40 shrink-0" />
                    <div className="skeleton h-4 min-w-0 flex-1" />
                    <div className="skeleton h-5 w-20 shrink-0 rounded-full" />
                    <div className="skeleton h-4 w-24 shrink-0" />
                  </div>
                ))}
              </div>
            </div>
          ) : sortedTasks.length === 0 ? (
            <div className="p-12 h-full flex items-center justify-center">
              <EmptyState
                title="No tasks match the current filters."
                description="Try clearing some filter criteria, revising your keyword search, or navigate to a different view."
                actionLabel="Reset all filters"
                onAction={clearAllFilters}
              />
            </div>
          ) : (
            <table className="min-w-full divide-y divide-white/5 text-left text-[12px] font-sans table-fixed">
              <thead className="bg-white/[0.04] backdrop-blur sticky top-0 z-10 font-mono text-[10px] text-slate-400 uppercase tracking-wider">
                <tr>
                  <th className="px-2 py-2 w-8">
                    <input type="checkbox" checked={allFilteredSelected} onChange={toggleAllFiltered} className="rounded border-slate-300 bg-white text-violet-500 focus:ring-violet-500" title={allFilteredSelected? 'Batal pilih semua (halaman filter)' : 'Pilih semua (hasil filter)'} />
                  </th>
                  {[
                    { field: 'id', label: 'ID', width: 'w-24' },
                    { field: 'consultant', label: 'Consultant', width: 'w-28' },
                    { field: 'type', label: 'Type', width: 'w-28' },
                    { field: 'client', label: 'Client', width: 'w-48' },
                    { field: 'screenReport', label: 'Screen / Report', width: 'w-52' },
                    { field: 'status', label: 'Status', width: 'w-24' },
                    { field: 'programmer', label: 'Programmer', width: 'w-32' },
                    { field: 'targetDate', label: 'Target', width: 'w-28' },
                  ].map(col => (
                    <th
                      key={col.field}
                      scope="col"
                      onClick={() => handleSort(col.field as SortField)}
                      className={`px-3 py-2 font-bold cursor-pointer hover:bg-white/5 ${col.width}`}
                    >
                      <div className="flex items-center gap-1.5">
                        <span>{col.label}</span>
                        {sortField === col.field && (
                          <span className="text-[10px] text-slate-400">{sortOrder === 'asc' ? <IconArrowDown size={11} stroke={2} /> : <IconArrowUp size={11} stroke={2} />}</span>
                        )}
                      </div>
                    </th>
                  ))}
                  <th scope="col" className="px-3 py-2 font-bold w-32">
                    Days Left
                  </th>
                  <th scope="col" className="px-3 py-2 font-bold w-16 text-center">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {paginatedTasks.map(task => {
                  const isSelected = selectedTaskId === task.id
                  return (
                    <tr
                      key={task.id}
                      onClick={() => handleRowClick(task.id)}
                      className={`cursor-pointer hover:bg-white/[0.04] transition-colors align-top ${
                        isSelected ? 'bg-white/5' : ''
                      }`}
                    >
                      <td className="px-2 py-2" onClick={e => e.stopPropagation()}>
                        <input type="checkbox" checked={selectedIds.has(task.id)} onChange={() => toggleOne(task.id)} className="rounded border-slate-300 bg-white text-violet-500 focus:ring-violet-500" />
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 font-bold text-slate-800 font-mono">{task.id}</td>
                      <td className="px-3 py-2 text-slate-500 break-words">{task.consultant}</td>
                      <td className="whitespace-nowrap px-3 py-2">
                        <TaskTypeBadge type={task.type} />
                      </td>
                      <td className="px-3 py-2 text-slate-800 break-words font-semibold">
                        {task.client}
                      </td>
                      <td className="px-3 py-2 text-slate-500 break-words">{task.screenReport}</td>
                      <td className="whitespace-nowrap px-3 py-2">
                        <StatusBadge status={task.status} />
                      </td>
                      <td className="px-3 py-2 text-slate-500 break-words">
                        {task.programmer || <span className="italic text-slate-400">unassigned</span>}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-slate-500 font-mono">{task.targetDate || '-'}</td>
                      <td className="whitespace-nowrap px-3 py-2">
                        <DeadlineIndicator task={task} />
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleRowClick(task.id)
                          }}
                          className="text-[11px] text-violet-300 hover:text-violet-200 hover:underline font-semibold"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        
        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="flex justify-between items-center mt-3 pt-3 border-t border-slate-100 font-sans text-xs">
            <div className="text-slate-400">
              Showing {(currentPage - 1) * itemsPerPage + 1} -{' '}
              {Math.min(currentPage * itemsPerPage, sortedTasks.length)} of {sortedTasks.length} tasks
            </div>
            <div className="flex items-center gap-1 font-mono">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
                className="rounded-full glass-subtle border border-slate-200 px-2.5 py-1 text-slate-500 hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed"
                aria-label="Previous page"
              >
                <IconChevronLeft size={14} stroke={2} />
              </button>
              <span className="px-2 text-slate-500">
                Page {currentPage} of {totalPages}
              </span>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
                className="rounded-full glass-subtle border border-slate-200 px-2.5 py-1 text-slate-500 hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed"
                aria-label="Next page"
              >
                <IconChevronRight size={14} stroke={2} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Task Detail Modal */}
      {activePanel === 'detail' && selectedTaskId && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={handleClosePanel}
          />
          <div className="relative w-full sm:max-w-[680px] h-[100dvh] sm:h-[90dvh] sm:max-h-[90dvh] flex flex-col rounded-t-2xl sm:rounded-2xl overflow-hidden animate-in slide-in-from-bottom sm:zoom-in-95 duration-200"
            style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-light)', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.35)' }}
          >
            <div className="sm:hidden flex justify-center pt-3 pb-1 shrink-0">
              <div className="w-10 h-1 rounded-full bg-slate-300" />
            </div>
            <TaskDetail
              taskId={selectedTaskId}
              onClose={handleClosePanel}
              onEdit={handleEditClick}
            />
          </div>
        </div>
      )}

      {/* Task Form Modal (Create / Edit) */}
      {(activePanel === 'create' || activePanel === 'edit') && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={handleClosePanel}
          />
          {/* Dialog */}
          <div className="relative w-full sm:max-w-[600px] h-[100dvh] sm:h-[90dvh] sm:max-h-[90dvh] flex flex-col rounded-t-2xl sm:rounded-2xl overflow-hidden animate-in slide-in-from-bottom sm:zoom-in-95 duration-200"
            style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-light)', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.35)' }}
          >
            {/* Mobile drag handle */}
            <div className="sm:hidden flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-slate-300" />
            </div>
            {activePanel === 'create' ? (
              <TaskForm
                onClose={handleClosePanel}
                onSubmitSuccess={handleClosePanel}
              />
            ) : selectedTaskId ? (
              <TaskForm
                taskId={selectedTaskId}
                onClose={() => setActivePanel('detail')}
                onSubmitSuccess={() => setActivePanel('detail')}
              />
            ) : null}
          </div>
        </div>
      )}
    </div>
  )
}
