import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { api } from '../api'
import type { AppNotification } from '../domain/types'
import { formatDate } from '../i18n'
import { useSession } from '../state/session'

// In the demo, notifications sent through INotify land here instead of going out by FCM (US-11.01).
export function Notifications() {
  const { t, i18n } = useTranslation()
  const { session } = useSession()
  const [list, setList] = useState<AppNotification[] | null>(null)

  useEffect(() => {
    if (session) void api.notifications.list(session.phone).then(setList)
  }, [session])

  if (!session) return null
  if (!list) return <p className="muted">{t('app.loading')}</p>
  const unread = list.filter((n) => !n.readAt).length

  return (
    <section>
      <div className="org-head">
        <h1>{t('notifications.title')}</h1>
        {unread > 0 && (
          <button
            className="btn btn-secondary"
            onClick={async () => {
              await api.notifications.markAllRead(session.phone)
              setList(await api.notifications.list(session.phone))
            }}
          >
            {t('notifications.markAllRead')}
          </button>
        )}
      </div>
      {list.length === 0 ? (
        <div className="card empty">{t('notifications.empty')}</div>
      ) : (
        <ul className="stack notif-list">
          {list.map((n) => (
            <li key={n.id} className={`card notif${n.readAt ? '' : ' unread'}`}>
              <span aria-hidden="true" className="notif-icon">
                {n.type === 'orgVerified' ? '✓' : n.type === 'orgRejected' ? '✕' : '🔔'}
              </span>
              <div>
                <p>{t(`notifications.${n.type}`, { org: n.orgName, reason: n.reason ?? '' })}</p>
                <span className="muted">{formatDate(n.sentAt, i18n.language)}</span>
              </div>
              <Link className="btn btn-link" to={n.deepLink}>
                {t('notifications.open')}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
