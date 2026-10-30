import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api'
import { ErrorText, StatusBadge } from '../components/ui'
import type { Organisation, VerificationStatus } from '../domain/types'
import { canTransition } from '../domain/verification'
import { formatDate } from '../i18n'
import { useSession } from '../state/session'

type Decision = Extract<VerificationStatus, 'verified' | 'rejected' | 'infoRequested'>

// US-13.01: view documents; approve, reject with a reason, or request more information.
export function AdminOrgDetail() {
  const { t, i18n } = useTranslation()
  const { id = '' } = useParams()
  const { session } = useSession()
  const [org, setOrg] = useState<Organisation | null | undefined>(undefined)
  const [pending, setPending] = useState<Decision | null>(null)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const [done, setDone] = useState(false)

  useEffect(() => {
    void api.admin.get(id).then((o) => setOrg(o ?? null))
  }, [id])

  if (org === undefined) return <p className="muted">{t('app.loading')}</p>
  if (org === null)
    return (
      <p>
        {t('errors.notFound')} <Link to="/admin">{t('app.back')}</Link>
      </p>
    )

  async function decide(status: Decision) {
    if (!session || !org) return
    setBusy(true)
    setError(null)
    try {
      const updated = await api.admin.setVerification(org.id, status, session.phone, status === 'verified' ? undefined : reason)
      setOrg(updated)
      setPending(null)
      setReason('')
      setDone(true)
    } catch (e) {
      setError(e)
    } finally {
      setBusy(false)
    }
  }

  const actions: { status: Decision; label: string; icon: string; cls: string }[] = [
    { status: 'verified', label: t('admin.approve'), icon: '✓', cls: 'btn-primary' },
    { status: 'infoRequested', label: t('admin.requestInfo'), icon: '?', cls: 'btn-secondary' },
    { status: 'rejected', label: t('admin.reject'), icon: '✕', cls: 'btn-danger' },
  ]
  const available = actions.filter((a) => canTransition(org.verification, a.status))

  return (
    <section>
      <Link to="/admin" className="btn btn-link">
        <span aria-hidden="true" className="flip">←</span> {t('app.back')}
      </Link>
      <div className="org-head">
        <div>
          <span className="chip">{t(`org.kind.${org.kind}`)}</span>
          <h1>{org.name}</h1>
        </div>
        <StatusBadge status={org.verification} />
      </div>
      {done && (
        <p className="success" role="status">
          <span aria-hidden="true">✓</span> {t('admin.decided')}
        </p>
      )}

      <div className="grid-2 align-start">
        <div className="card">
          <h2>{t('admin.details')}</h2>
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
              <dt>{t('admin.owner')}</dt>
              <dd>
                <bdi dir="ltr">{org.ownerPhone}</bdi>
              </dd>
            </div>
            {org.kind === 'ngo' && (
              <>
                <div>
                  <dt>{t('admin.coordinators')}</dt>
                  <dd>
                    {org.coordinatorPhones.map((p) => (
                      <bdi key={p} dir="ltr" className="phone">
                        {p}
                      </bdi>
                    ))}
                  </dd>
                </div>
                <div>
                  <dt>{t('org.serviceAreas')}</dt>
                  <dd>{org.serviceAreas.map((a) => t(`areas.${a}`)).join('، ')}</dd>
                </div>
                <div>
                  <dt>{t('org.foodTypes')}</dt>
                  <dd>{org.foodTypes.map((f) => t(`food.${f}`)).join('، ')}</dd>
                </div>
                <div>
                  <dt>{t('form.capacity')}</dt>
                  <dd>{t('org.capacity', { kg: org.capacityKgPerDay })}</dd>
                </div>
              </>
            )}
          </dl>
          {org.kind === 'business' && (
            <>
              <h3>{t('org.branches')}</h3>
              <ul className="list">
                {org.branches.map((b, i) => (
                  <li key={i}>
                    <strong>{b.name}</strong> · {t(`areas.${b.area}`)} · {b.address} · <bdi dir="ltr">{`${b.opensAt}–${b.closesAt}`}</bdi>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        <div className="stack">
          <div className="card">
            <h2>{t('admin.documents')}</h2>
            <ul className="list">
              {org.documents.map((d) => (
                <li key={d.kind} className="doc-row">
                  <span className="doc-label">
                    <span aria-hidden="true">📄</span> {t(`form.doc.${d.kind}`)}
                  </span>
                  <bdi className="file-name">{d.fileName}</bdi>
                  <button type="button" className="btn btn-secondary btn-small" disabled title={t('app.comingSprint', { n: 2 })}>
                    {t('admin.view')}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {available.length > 0 && (
            <div className="card">
              <div className="action-row">
                {available.map((a) => (
                  <button
                    key={a.status}
                    type="button"
                    className={`btn ${a.cls}`}
                    disabled={busy}
                    onClick={() => (a.status === 'verified' ? void decide('verified') : (setPending(a.status), setError(null)))}
                  >
                    <span aria-hidden="true">{a.icon}</span> {a.label}
                  </button>
                ))}
              </div>
              {pending && (
                <div className="reason-box">
                  <label htmlFor="reason">{pending === 'rejected' ? t('admin.reasonLabelReject') : t('admin.reasonLabelInfo')}</label>
                  <textarea
                    id="reason"
                    rows={3}
                    placeholder={t('admin.reasonPlaceholder')}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                  <div className="action-row">
                    <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void decide(pending)}>
                      {t('admin.confirm')}
                    </button>
                    <button type="button" className="btn btn-ghost" onClick={() => setPending(null)}>
                      {t('admin.cancel')}
                    </button>
                  </div>
                </div>
              )}
              <ErrorText error={error} />
            </div>
          )}

          <div className="card">
            <h2>{t('admin.history')}</h2>
            <ol className="timeline">
              {org.history.map((h, i) => (
                <li key={i}>
                  <StatusBadge status={h.status} /> <span className="muted">{formatDate(h.at, i18n.language)}</span>{' '}
                  <span className="muted">
                    {t('admin.historyBy')}{' '}
                    <bdi dir="ltr">{h.byPhone}</bdi>
                  </span>
                  {h.reason && <p className="quote">{h.reason}</p>}
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </section>
  )
}
