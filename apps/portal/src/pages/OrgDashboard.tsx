import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation } from 'react-router-dom'
import { api } from '../api'
import { StatusBadge } from '../components/ui'
import type { Organisation } from '../domain/types'
import { canOperate } from '../domain/verification'
import { formatDate } from '../i18n'
import { useSession } from '../state/session'

// Owner / coordinator view of their registrations and verification status (US-1.06, 1.07, 12.03 badge).
export function OrgDashboard() {
  const { t, i18n } = useTranslation()
  const { session } = useSession()
  const [orgs, setOrgs] = useState<Organisation[] | null>(null)
  const flash = (useLocation().state as { flash?: string } | null)?.flash

  useEffect(() => {
    if (session) void api.organisations.mine(session.phone).then(setOrgs)
  }, [session])

  if (!session) return null
  if (!orgs) return <p className="muted">{t('app.loading')}</p>

  const isBusiness = session.role === 'businessOwner'

  return (
    <section>
      <h1>{t('org.title')}</h1>
      {flash && (
        <p className="success" role="status">
          <span aria-hidden="true">✓</span> {flash}
        </p>
      )}
      {orgs.length === 0 && (
        <div className="card empty">
          <p>{t('org.none')}</p>
          <Link className="btn btn-primary" to={isBusiness ? '/register/business' : '/register/ngo'}>
            <span aria-hidden="true">➕</span> {isBusiness ? t('org.registerBusinessCta') : t('org.registerNgoCta')}
          </Link>
        </div>
      )}
      <div className="stack">
        {orgs.map((org) => {
          const lastReason = [...org.history].reverse().find((h) => h.reason)?.reason
          return (
            <article key={org.id} className="card org-card">
              <header className="org-head">
                <div>
                  <span className="chip">{t(`org.kind.${org.kind}`)}</span>
                  <h2>
                    {org.name}
                    {org.verification === 'verified' && (
                      <span className="verified-badge" title={t('org.verifiedBadge')}>
                        <span aria-hidden="true">✓</span> {t('org.verifiedBadge')}
                      </span>
                    )}
                  </h2>
                </div>
                <StatusBadge status={org.verification} />
              </header>
              <p>{t(`statusHelp.${org.kind}.${org.verification}`)}</p>
              {lastReason && org.verification !== 'verified' && (
                <div className="callout">
                  <strong>{t('org.lastReason')}</strong>
                  <p dir="auto">{lastReason}</p>
                </div>
              )}
              {!canOperate(org) && (
                <p className="locked">
                  <span aria-hidden="true">🔒</span> {org.kind === 'business' ? t('org.listingsLocked') : t('org.offersLocked')}
                </p>
              )}
              <dl className="facts">
                <div>
                  <dt>{t('org.registrationNo')}</dt>
                  <dd>
                    <bdi>{org.registrationNo}</bdi>
                  </dd>
                </div>
                {org.kind === 'business' && (
                  <div>
                    <dt>{t('org.licenceNo')}</dt>
                    <dd>
                      <bdi>{org.licenceNo}</bdi>
                    </dd>
                  </div>
                )}
                <div>
                  <dt>{t('admin.colSubmitted')}</dt>
                  <dd>{formatDate(org.createdAt, i18n.language)}</dd>
                </div>
              </dl>
              {org.kind === 'business' ? (
                <>
                  <h3>{t('org.branches')}</h3>
                  <ul className="list">
                    {org.branches.map((b, i) => (
                      <li key={i}>
                        <strong>{b.name}</strong> · {t(`areas.${b.area}`)} · <bdi dir="ltr">{`${b.opensAt}–${b.closesAt}`}</bdi>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <dl className="facts">
                  <div>
                    <dt>{t('org.serviceAreas')}</dt>
                    <dd>{org.serviceAreas.map((a) => t(`areas.${a}`)).join(t('app.listSeparator'))}</dd>
                  </div>
                  <div>
                    <dt>{t('org.foodTypes')}</dt>
                    <dd>{org.foodTypes.map((f) => t(`food.${f}`)).join(t('app.listSeparator'))}</dd>
                  </div>
                  <div>
                    <dt>{t('form.capacity')}</dt>
                    <dd>{t('org.capacity', { kg: org.capacityKgPerDay })}</dd>
                  </div>
                </dl>
              )}
            </article>
          )
        })}
      </div>
    </section>
  )
}
