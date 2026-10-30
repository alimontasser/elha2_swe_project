import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { StatusBadge } from '../components/ui'
import type { Organisation, VerificationStatus } from '../domain/types'
import { formatDate } from '../i18n'

const FILTERS: (VerificationStatus | 'all')[] = ['pending', 'infoRequested', 'verified', 'rejected', 'all']

// US-13.01: the administrator's verification queue, oldest submission first.
export function AdminQueue() {
  const { t, i18n } = useTranslation()
  const [filter, setFilter] = useState<VerificationStatus | 'all'>('pending')
  const [loaded, setLoaded] = useState<{ filter: VerificationStatus | 'all'; orgs: Organisation[] } | null>(null)
  const orgs = loaded?.filter === filter ? loaded.orgs : null

  useEffect(() => {
    let active = true
    void api.admin.listForReview(filter).then((list) => {
      if (active) setLoaded({ filter, orgs: list })
    })
    return () => {
      active = false
    }
  }, [filter])

  return (
    <section>
      <h1>{t('admin.title')}</h1>
      <p className="muted">{t('admin.subtitle')}</p>
      <div className="tabs" role="tablist" aria-label={t('admin.filter')}>
        {FILTERS.map((f) => (
          <button
            key={f}
            role="tab"
            aria-selected={filter === f}
            className={`tab${filter === f ? ' active' : ''}`}
            onClick={() => setFilter(f)}
          >
            {f === 'all' ? t('admin.all') : t(`status.${f}`)}
          </button>
        ))}
      </div>
      {!orgs ? (
        <p className="muted">{t('app.loading')}</p>
      ) : orgs.length === 0 ? (
        <div className="card empty">{t('admin.empty')}</div>
      ) : (
        <div className="card table-wrap">
          <table>
            <thead>
              <tr>
                <th>{t('admin.colName')}</th>
                <th>{t('admin.colKind')}</th>
                <th>{t('admin.colSubmitted')}</th>
                <th>{t('admin.colStatus')}</th>
                <th>
                  <span className="visually-hidden">{t('admin.open')}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {orgs.map((o) => (
                <tr key={o.id}>
                  <td>
                    <strong>{o.name}</strong>
                  </td>
                  <td>{t(`org.kind.${o.kind}`)}</td>
                  <td>{formatDate(o.createdAt, i18n.language)}</td>
                  <td>
                    <StatusBadge status={o.verification} />
                  </td>
                  <td>
                    <Link className="btn btn-secondary btn-small" to={`/admin/organisations/${o.id}`}>
                      {t('admin.open')}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
