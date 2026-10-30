import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { api } from '../api'
import { setLanguage } from '../i18n'
import { useSession } from '../state/session'

interface NavItem {
  to: string
  label: string
  icon: string
  sprint?: number
}

export function LanguageToggle() {
  const { t, i18n } = useTranslation()
  return (
    <button
      type="button"
      className="btn btn-ghost"
      aria-label={t('app.languageLabel')}
      onClick={() => setLanguage(i18n.language === 'ar' ? 'en' : 'ar')}
    >
      <span aria-hidden="true">🌐</span> {t('app.language')}
    </button>
  )
}

export function DemoBanner() {
  const { t } = useTranslation()
  return (
    <div className="demo-banner" role="note">
      <span aria-hidden="true">🧪</span> {t('app.demoBanner')}
    </div>
  )
}

export function Layout() {
  const { t } = useTranslation()
  const { session, signOut } = useSession()
  const navigate = useNavigate()
  const location = useLocation()
  const [unread, setUnread] = useState(0)

  useEffect(() => {
    if (!session) return
    let active = true
    void api.notifications.list(session.phone).then((list) => {
      if (active) setUnread(list.filter((n) => !n.readAt).length)
    })
    return () => {
      active = false
    }
  }, [session, location.pathname])

  if (!session) return null

  const items: NavItem[] =
    session.role === 'admin'
      ? [{ to: '/admin', label: t('nav.verification'), icon: '🛡️' }]
      : session.role === 'businessOwner'
        ? [
            { to: '/organisation', label: t('nav.organisation'), icon: '🏪' },
            { to: '/register/business', label: t('nav.registerBusiness'), icon: '➕' },
            { to: '/orders', label: t('nav.todaysOrders'), icon: '🧾', sprint: 3 },
            { to: '/listings', label: t('nav.listings'), icon: '🥖', sprint: 2 },
          ]
        : [
            { to: '/organisation', label: t('nav.organisation'), icon: '🤝' },
            { to: '/register/ngo', label: t('nav.registerNgo'), icon: '➕' },
            { to: '/offers', label: t('nav.offers'), icon: '📦', sprint: 3 },
          ]

  return (
    <div className="shell">
      <DemoBanner />
      <header className="topbar">
        <div className="brand">
          <img src="./favicon.svg" alt="" width={32} height={32} />
          <div>
            <strong>{t('app.name')}</strong>
            <span className="muted">{t('app.tagline')}</span>
          </div>
        </div>
        <div className="topbar-actions">
          <span className="muted who">
            {t(`roles.${session.role}`)} · <bdi>{session.phone}</bdi>
          </span>
          <LanguageToggle />
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              api.resetDemo()
              navigate(0)
            }}
          >
            <span aria-hidden="true">↺</span> {t('app.resetDemo')}
          </button>
          <button type="button" className="btn btn-ghost" onClick={signOut}>
            <span aria-hidden="true">⎋</span> {t('app.signOut')}
          </button>
        </div>
      </header>
      <div className="body">
        <nav className="sidebar" aria-label="Main">
          {items.map((item) => (
            <NavLink key={item.to} to={item.to} className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
              <span aria-hidden="true">{item.icon}</span>
              <span>{item.label}</span>
              {item.sprint && <span className="chip">{t('app.comingSprint', { n: item.sprint })}</span>}
            </NavLink>
          ))}
          <NavLink to="/notifications" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
            <span aria-hidden="true">🔔</span>
            <span>{t('nav.notifications')}</span>
            {unread > 0 && (
              <span className="count" aria-label={t('notifications.unread', { count: unread })}>
                {unread}
              </span>
            )}
          </NavLink>
        </nav>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
