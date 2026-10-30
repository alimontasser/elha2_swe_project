import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import { DocumentPicker } from '../components/DocumentPicker'
import { ErrorText, Field } from '../components/ui'
import { CAIRO_AREAS, type Area, type Branch, type OrgDocument } from '../domain/types'
import { useSession } from '../state/session'

const emptyBranch = (): Branch => ({ name: '', area: 'newCairo', address: '', opensAt: '09:00', closesAt: '22:00' })

// US-1.06: register a business and its branches; the account stays pending until an admin approves it.
export function RegisterBusiness() {
  const { t } = useTranslation()
  const { session } = useSession()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [registrationNo, setRegistrationNo] = useState('')
  const [licenceNo, setLicenceNo] = useState('')
  const [branches, setBranches] = useState<Branch[]>([emptyBranch()])
  const [documents, setDocuments] = useState<OrgDocument[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)

  const updateBranch = (i: number, patch: Partial<Branch>) =>
    setBranches((list) => list.map((b, idx) => (idx === i ? { ...b, ...patch } : b)))

  const complete =
    name.trim() && registrationNo.trim() && licenceNo.trim() && branches.every((b) => b.name.trim() && b.address.trim())

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!session) return
    setBusy(true)
    setError(null)
    try {
      await api.organisations.registerBusiness(session.phone, {
        name: name.trim(),
        registrationNo: registrationNo.trim(),
        licenceNo: licenceNo.trim(),
        branches,
        documents,
      })
      navigate('/organisation', { state: { flash: t('form.submitted') } })
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section>
      <h1>{t('nav.registerBusiness')}</h1>
      <form className="card form" onSubmit={onSubmit} noValidate>
        <Field label={t('form.name')} htmlFor="name">
          <input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
        </Field>
        <div className="grid-2">
          <Field label={t('form.registrationNo')} htmlFor="cr">
            <input id="cr" dir="ltr" value={registrationNo} onChange={(e) => setRegistrationNo(e.target.value)} required />
          </Field>
          <Field label={t('form.licenceNo')} htmlFor="licence">
            <input id="licence" dir="ltr" value={licenceNo} onChange={(e) => setLicenceNo(e.target.value)} required />
          </Field>
        </div>

        <fieldset className="field">
          <legend>{t('form.branches')}</legend>
          {branches.map((b, i) => (
            <div key={i} className="branch">
              <div className="grid-2">
                <Field label={t('form.branchName')} htmlFor={`bname-${i}`}>
                  <input id={`bname-${i}`} value={b.name} onChange={(e) => updateBranch(i, { name: e.target.value })} required />
                </Field>
                <Field label={t('form.area')} htmlFor={`barea-${i}`}>
                  <select id={`barea-${i}`} value={b.area} onChange={(e) => updateBranch(i, { area: e.target.value as Area })}>
                    {CAIRO_AREAS.map((a) => (
                      <option key={a} value={a}>
                        {t(`areas.${a}`)}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <Field label={t('form.address')} htmlFor={`baddr-${i}`}>
                <input id={`baddr-${i}`} value={b.address} onChange={(e) => updateBranch(i, { address: e.target.value })} required />
              </Field>
              <div className="grid-2">
                <Field label={t('form.opensAt')} htmlFor={`bopen-${i}`}>
                  <input id={`bopen-${i}`} type="time" value={b.opensAt} onChange={(e) => updateBranch(i, { opensAt: e.target.value })} />
                </Field>
                <Field label={t('form.closesAt')} htmlFor={`bclose-${i}`}>
                  <input id={`bclose-${i}`} type="time" value={b.closesAt} onChange={(e) => updateBranch(i, { closesAt: e.target.value })} />
                </Field>
              </div>
              {branches.length > 1 && (
                <button type="button" className="btn btn-link danger" onClick={() => setBranches((l) => l.filter((_, idx) => idx !== i))}>
                  <span aria-hidden="true">✕</span> {t('form.removeBranch')}
                </button>
              )}
            </div>
          ))}
          <button type="button" className="btn btn-secondary" onClick={() => setBranches((l) => [...l, emptyBranch()])}>
            <span aria-hidden="true">➕</span> {t('form.addBranch')}
          </button>
        </fieldset>

        <DocumentPicker kinds={['commercialRegistration', 'foodSafetyLicence']} value={documents} onChange={setDocuments} />

        <ErrorText error={error} />
        <button className="btn btn-primary" disabled={busy || !complete}>
          <span aria-hidden="true">📨</span> {busy ? t('form.submitting') : t('form.submit')}
        </button>
      </form>
    </section>
  )
}
