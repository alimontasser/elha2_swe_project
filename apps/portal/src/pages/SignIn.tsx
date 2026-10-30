import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import { DemoBanner, LanguageToggle } from '../components/Layout'
import { ErrorText, Field } from '../components/ui'
import { HOME_FOR_ROLE } from '../domain/roles'
import type { Role } from '../domain/types'
import { useSession } from '../state/session'

const ROLES: Role[] = ['businessOwner', 'ngoCoordinator', 'admin']

// US-1.01: sign in with an Egyptian mobile number and a one-time code.
export function SignIn() {
  const { t } = useTranslation()
  const { setSession } = useSession()
  const navigate = useNavigate()
  const [step, setStep] = useState<'phone' | 'code'>('phone')
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [role, setRole] = useState<Role>('businessOwner')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)

  async function run(action: () => Promise<void>) {
    setBusy(true)
    setError(null)
    try {
      await action()
    } catch (e) {
      setError(e)
    } finally {
      setBusy(false)
    }
  }

  function onSendCode(e: FormEvent) {
    e.preventDefault()
    void run(async () => {
      await api.auth.sendCode(phone)
      setStep('code')
    })
  }

  function onVerify(e: FormEvent) {
    e.preventDefault()
    void run(async () => {
      const session = await api.auth.verifyCode(phone, code, role)
      setSession(session)
      navigate(HOME_FOR_ROLE[session.role], { replace: true })
    })
  }

  return (
    <div className="signin-page">
      <DemoBanner />
      <div className="signin-top">
        <LanguageToggle />
      </div>
      <div className="card signin-card">
        <div className="brand brand-large">
          <img src="./favicon.svg" alt="" width={48} height={48} />
          <div>
            <strong>{t('app.name')}</strong>
            <span className="muted">{t('app.tagline')}</span>
          </div>
        </div>
        <h1>{t('signIn.title')}</h1>
        <p className="muted">{t('signIn.subtitle')}</p>

        {step === 'phone' ? (
          <form onSubmit={onSendCode} noValidate>
            <Field label={t('signIn.phoneLabel')} hint={t('signIn.phoneHint')} htmlFor="phone">
              <input
                id="phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                dir="ltr"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
              />
            </Field>
            <ErrorText error={error} />
            <button className="btn btn-primary btn-block" disabled={busy || !phone.trim()}>
              <span aria-hidden="true">✉️</span> {t('signIn.sendCode')}
            </button>
          </form>
        ) : (
          <form onSubmit={onVerify} noValidate>
            <p className="success">
              {t('signIn.codeSentTo')}{' '}
              <bdi dir="ltr">{phone}</bdi>
            </p>
            <Field label={t('signIn.codeLabel')} hint={t('signIn.codeHint')} htmlFor="code">
              <input
                id="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                dir="ltr"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                required
              />
            </Field>
            <fieldset className="field">
              <legend>{t('signIn.roleLabel')}</legend>
              <div className="choice-row">
                {ROLES.map((r) => (
                  <label key={r} className={`choice${role === r ? ' selected' : ''}`}>
                    <input type="radio" name="role" value={r} checked={role === r} onChange={() => setRole(r)} />
                    {t(`roles.${r}`)}
                  </label>
                ))}
              </div>
            </fieldset>
            <ErrorText error={error} />
            <button className="btn btn-primary btn-block" disabled={busy || code.length !== 6}>
              <span aria-hidden="true">→</span> {t('signIn.verify')}
            </button>
            <button
              type="button"
              className="btn btn-link"
              onClick={() => {
                setStep('phone')
                setCode('')
                setError(null)
              }}
            >
              {t('signIn.changeNumber')}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
