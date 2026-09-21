/* eslint-disable react/set-state-in-effect */
import { useEffect, useMemo, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { TODAY_STR } from '../lib/dateUtils'
import { useTheme } from '../context/ThemeContext'
import { useTasks } from '../context/TaskContext'
import {
  IconMenu2, IconMoon, IconSun, IconX, IconDashboard, IconListCheck,
  IconClipboardCheck, IconFolderOpen, IconUserPlus, IconProgress, IconPlayerPause,
  IconRotateClockwise, IconBan, IconCircleCheck, IconAlarm, IconHistory, IconArchive,
  IconBriefcase, IconUserCog, IconCode, IconUpload, IconBook2, IconSettings, IconLogout, IconShieldLock,
  IconChevronRight, IconChevronsLeft, IconChevronsRight, type Icon,
} from '@tabler/icons-react'
import { authClient } from '../lib/auth-client'

interface NavItem {
  to: string
  label: string
  icon: Icon
}
interface NavSection {
  title: string
  items: NavItem[]
}
const SECTIONS: NavSection[] = [
  { title: 'Overview', items: [{ to: '/dashboard', label: 'Dashboard', icon: IconDashboard }] },
  {
    title: 'Tasks',
    items: [
      { to: '/tasks?filter=all', label: 'All Tasks', icon: IconListCheck },
      { to: '/tasks?status=QC', label: 'QC', icon: IconClipboardCheck },
      { to: '/tasks?status=Open', label: 'Open', icon: IconFolderOpen },
      { to: '/tasks?status=Assign', label: 'Assign', icon: IconUserPlus },
      { to: '/tasks?status=In%20Progress', label: 'In Progress', icon: IconProgress },
      { to: '/tasks?status=Hold', label: 'Hold', icon: IconPlayerPause },
      { to: '/tasks?status=Reopen', label: 'Reopen', icon: IconRotateClockwise },
      { to: '/tasks?status=Reject', label: 'Reject', icon: IconBan },
      { to: '/tasks?status=Done', label: 'Done', icon: IconCircleCheck },
      { to: '/tasks?filter=overdue', label: 'Overdue', icon: IconAlarm },
    ],
  },
  {
    title: 'History',
    items: [
      { to: '/tasks?filter=completed', label: 'Completed', icon: IconHistory },
      { to: '/tasks?filter=archived', label: 'Archived', icon: IconArchive },
    ],
  },
  {
    title: 'Master Data',
    items: [
      { to: '/master/clients', label: 'Clients', icon: IconBriefcase },
      { to: '/master/consultants', label: 'Consultants', icon: IconUserCog },
      { to: '/master/programmers', label: 'Programmers', icon: IconCode },
    ],
  },
  { title: 'Data', items: [
    { to: '/import', label: 'Import', icon: IconUpload },
    { to: '/guide', label: 'Manual Book', icon: IconBook2 },
  ] },
  { title: 'Configuration', items: [{ to: '/settings', label: 'Settings', icon: IconSettings }, { to: '/admin', label: 'Admin', icon: IconShieldLock }] },
]

function readLocalValue(key: string, fallback?: string): string | null {
  try { return localStorage.getItem(key) ?? fallback ?? null } catch { return fallback ?? null }
}
function writeLocalValue(key: string, value: string) {
  try { localStorage.setItem(key, value) } catch { /* storage unavailable */ }
}

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { theme, toggleTheme } = useTheme()
  const { refreshing } = useTasks()
  const location = useLocation()
  const navigate = useNavigate()
  const session = authClient.useSession()

  const isLinkActive = (to: string) => {
    if (to.includes('?')) return location.pathname + location.search === to
    return location.pathname === to
  }

  const activeSection = useMemo(() => {
    for (const s of SECTIONS) {
      if (s.items.some(it => isLinkActive(it.to))) return s.title
    }
    return SECTIONS[0].title
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location])

  const [collapsed, setCollapsed] = useState<boolean>(() => readLocalValue('sidebar-collapsed') === '1')
  const [openSection, setOpenSection] = useState<string | null>(() => {
    const saved = readLocalValue('sidebar-open-section')
    if (saved && SECTIONS.some(s => s.title === saved)) return saved
    return activeSection
  })

  useEffect(() => { setOpenSection(activeSection) }, [activeSection])

  const toggleCollapsed = () => {
    setCollapsed(c => {
      writeLocalValue('sidebar-collapsed', c ? '0' : '1')
      return !c
    })
  }
  const toggleSection = (title: string) => {
    setOpenSection(prev => {
      const next = prev === title ? null : title
      writeLocalValue('sidebar-open-section', next ?? '')
      return next
    })
  }

  const handleSignOut = async () => {
    await authClient.signOut()
    navigate('/login', { replace: true })
  }

  const renderNavHeader = (section: NavSection) => (
    <button
      type="button"
      onClick={() => toggleSection(section.title)}
      aria-expanded={openSection === section.title}
      className="w-full flex items-center justify-between px-3 py-1 text-[10px] font-bold tracking-widest uppercase font-mono"
      style={{ color: 'var(--text-muted)' }}
    >
      <span>{section.title}</span>
      <span className={`transition-transform duration-200 ${openSection === section.title ? 'rotate-90' : ''}`}>
        <IconChevronRight size={12} stroke={2} />
      </span>
    </button>
  )

  const navItemClass = (active: boolean) =>
    active
      ? 'bg-blue-50 text-blue-700 font-semibold shadow-sm ring-1 ring-blue-100 dark:bg-blue-500/15 dark:text-blue-200 dark:ring-blue-400/20'
      : 'text-slate-500 hover:bg-blue-50/70 hover:text-blue-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100'

  const renderNavItems = (items: NavItem[], rail: boolean) => (
    <div className={`${rail ? 'space-y-1' : 'space-y-0.5'}`}>
      {items.map((item) => {
        const active = isLinkActive(item.to)
        const Icon = item.icon
        if (rail) {
          return (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setSidebarOpen(false)}
              title={item.label}
              aria-label={item.label}
              className={`flex items-center justify-center p-2 rounded-xl transition-colors ${navItemClass(active)}`}
            >
              <Icon size={18} stroke={1.75} />
            </NavLink>
          )
        }
        return (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={() => setSidebarOpen(false)}
            className={`flex items-center gap-2.5 px-3 py-1.5 text-xs font-mono rounded-xl transition-colors ${navItemClass(active)}`}
          >
            <Icon size={14} stroke={1.75} className="shrink-0" />
            <span className="truncate">{item.label}</span>
          </NavLink>
        )
      })}
    </div>
  )

  const renderNav = (rail: boolean) => (
    <nav className={`mt-4 ${rail ? 'space-y-2' : 'space-y-3'}`}>
      {SECTIONS.map((section) => {
        if (rail) {
          return (
            <div key={section.title} className="flex flex-col items-center gap-1" title={section.title}>
              {renderNavItems(section.items, true)}
            </div>
          )
        }
        return (
          <div key={section.title} className="space-y-1">
            {renderNavHeader(section)}
            {openSection === section.title && renderNavItems(section.items, false)}
          </div>
        )
      })}
    </nav>
  )

  return (
    <div className="flex h-screen overflow-hidden font-sans relative" style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
      {/* Ambient mesh — adaptive */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute inset-0" style={{ background: 'var(--bg-primary)' }} />
        <div className="absolute -top-[30%] -left-[12%] w-[72%] h-[60%] rounded-full opacity-[0.55]" style={{ background: 'radial-gradient(ellipse at center, #dbeafe 0%, #e0f2fe 36%, transparent 70%)', filter: 'blur(50px)' }} />
        <div className="absolute -top-[12%] -right-[14%] w-[62%] h-[52%] rounded-full opacity-[0.48]" style={{ background: 'radial-gradient(ellipse at center, #e0e7ff 0%, #dbeafe 38%, transparent 70%)', filter: 'blur(48px)' }} />
        <div className="absolute bottom-[-10%] right-[12%] w-[50%] h-[42%] rounded-full opacity-[0.24]" style={{ background: 'radial-gradient(ellipse at center, #ccfbf1 0%, transparent 72%)', filter: 'blur(56px)' }} />
        <div className="absolute inset-0 opacity-[0.025]" style={{ backgroundImage: 'linear-gradient(var(--border-light) 1px, transparent 1px), linear-gradient(90deg, var(--border-light) 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
      </div>

      {/* Sidebar Desktop — glass light */}
      <aside className={`hidden shrink-0 flex-col gap-4 p-4 md:flex transition-[width] duration-200 ${collapsed ? 'w-[68px]' : 'w-[248px]'}`}>
        <div className="glass-strong rounded-2xl p-4 flex flex-col flex-1 min-h-0">
          <div className={`flex items-center gap-3 ${collapsed ? 'justify-center' : ''}`}>
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold text-xs font-mono shadow-lg shadow-blue-600/20 shrink-0">TA</div>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-bold tracking-tight truncate" style={{ color: 'var(--text-primary)' }}>Task Assignment</div>
                <div className="text-[10px] font-medium -mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>Work together, better.</div>
              </div>
            )}
          </div>
          <div className="flex-1 overflow-y-auto min-h-0">
            {renderNav(collapsed)}
          </div>
          <div className={`mt-2 ${collapsed ? 'flex justify-center' : ''}`}>
            <button
              onClick={toggleCollapsed}
              className="rounded-xl glass-subtle p-2 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
              style={{ color: 'var(--text-secondary)' }}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {collapsed ? <IconChevronsRight size={16} stroke={1.75} /> : <IconChevronsLeft size={16} stroke={1.75} />}
            </button>
          </div>
        </div>
        {!collapsed && (
          <div className="glass rounded-2xl p-3 flex items-center gap-3">
            <img src="https://i.pravatar.cc/100?img=12" alt="user" className="w-8 h-8 rounded-full object-cover ring-1" style={{ borderColor: 'var(--border-light)' }} />
            <div className="min-w-0">
              <div className="text-xs font-medium font-mono truncate" style={{ color: 'var(--text-primary)' }}>{session.data?.user.name || 'Internal'}</div>
              <div className="text-[10px] font-mono truncate" style={{ color: 'var(--text-muted)' }}>{session.data?.user.email || `System · ${TODAY_STR}`}</div>
            </div>
            <button type="button" onClick={handleSignOut} className="ml-auto rounded-lg p-1.5 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30" style={{ color: 'var(--text-muted)' }} aria-label="Keluar" title="Keluar">
              <IconLogout size={15} stroke={1.75} />
            </button>
          </div>
        )}
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && <div className="fixed inset-0 z-40 md:hidden" style={{ background: 'rgba(15, 23, 42, 0.5)' }} onClick={() => setSidebarOpen(false)} />}
      {/* Mobile drawer — glass light */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-[280px] transform p-4 transition-transform duration-200 ease-in-out md:hidden ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="glass-strong rounded-2xl p-4 h-full flex flex-col">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold text-xs font-mono shadow-lg shadow-blue-600/20">TA</div>
              <span className="text-[13px] font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>Task Assignment</span>
            </div>
            <button onClick={() => setSidebarOpen(false)} className="rounded-xl glass-subtle p-1.5" style={{ color: 'var(--text-secondary)' }} aria-label="Close menu">
              <IconX size={16} stroke={1.75} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto min-h-0">
            {renderNav(false)}
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        <header className="flex h-12 items-center justify-between gap-3 px-4 md:px-6 shrink-0" style={{ borderBottom: '1px solid var(--border-light)' }}>
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => setSidebarOpen(true)} className="rounded-xl glass p-2 md:hidden" style={{ color: 'var(--text-secondary)' }} aria-label="Open menu">
              <IconMenu2 size={18} stroke={1.75} />
            </button>
            <div className="hidden md:block text-xs font-mono truncate" style={{ color: 'var(--text-muted)' }}>Internal Task & Assignment Management</div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={toggleTheme}
              className="rounded-xl glass p-2 transition-colors"
              aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
              title={theme === 'light' ? 'Dark mode' : 'Light mode'}
            >
              {theme === 'light'
                ? <IconMoon size={18} stroke={1.75} />
                : <IconSun size={18} stroke={1.75} />}
            </button>
            <span className="hidden sm:inline-flex items-center gap-2 glass-subtle rounded-full px-3 py-1">
              <span className={`w-2 h-2 rounded-full ${refreshing ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`} />
              <span className="text-[11px] font-mono" style={{ color: 'var(--text-secondary)' }}>{refreshing ? 'Updating...' : 'Supabase'}</span>
            </span>
            <span className="text-xs font-mono hidden lg:inline" style={{ color: 'var(--text-muted)' }}>System Date: <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{TODAY_STR}</span></span>
          </div>
        </header>
        <main className="flex-1 overflow-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
