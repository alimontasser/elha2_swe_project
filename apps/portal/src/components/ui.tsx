import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { ApiError } from '../api'
import type { VerificationStatus } from '../domain/types'

const STATUS_ICON: Record<VerificationStatus, string> = {
  pending: '⏳',
  verified: '✓',
  rejected: '✕',
  infoRequested: '?',
}

// Colour is never the only signal (NFR-17): every badge has an icon and a text label.
export function StatusBadge({ status }: { status: VerificationStatus }) {
  const { t } = useTranslation()
  return (
    <span className={`badge badge-${status}`}>
      <span aria-hidden="true">{STATUS_ICON[status]}</span> {t(`status.${status}`)}
    </span>
  )
}

export function ErrorText({ error }: { error: unknown }) {
  const { t, i18n } = useTranslation()
  if (!error) return null
  let message = t('errors.generic')
  if (error instanceof ApiError) {
    const time = error.retryAt
      ? new Intl.DateTimeFormat(i18n.language === 'ar' ? 'ar-EG' : 'en-GB', { timeStyle: 'short', timeZone: 'Africa/Cairo' }).format(
          new Date(error.retryAt),
        )
      : ''
    message = t(`errors.${error.code}`, { time, defaultValue: t('errors.generic') })
  }
  return (
    <p className="error" role="alert">
      {message}
    </p>
  )
}

export function Field({ label, hint, children, htmlFor }: { label: string; hint?: string; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="field">
      <label htmlFor={htmlFor}>{label}</label>
      {children}
      {hint && <p className="hint">{hint}</p>}
    </div>
  )
}
