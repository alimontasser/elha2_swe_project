import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { api, ApiError } from '../api'
import { DocumentPicker } from '../components/DocumentPicker'
import { ErrorText, Field } from '../components/ui'
import { normaliseEgyptianMobile } from '../domain/phone'
import { CAIRO_AREAS, FOOD_CATEGORIES, type Area, type FoodCategory, type OrgDocument } from '../domain/types'
import { useSession } from '../state/session'

function toggle<T>(list: T[], item: T): T[] {
  return list.includes(item) ? list.filter((x) => x !== item) : [...list, item]
}

// US-1.07: register an NGO; donation offers stay blocked until an admin verifies it.
export function RegisterNgo() {
  const { t } = useTranslation()
  const { session } = useSession()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [registrationNo, setRegistrationNo] = useState('')
  const [serviceAreas, setServiceAreas] = useState<Area[]>([])
  const [foodTypes, setFoodTypes] = useState<FoodCategory[]>([])
  const [capacity, setCapacity] = useState('100')
  const [coordinators, setCoordinators] = useState('')
  const [documents, setDocuments] = useState<OrgDocument[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)

  const complete = name.trim() && registrationNo.trim() && serviceAreas.length > 0 && foodTypes.length > 0 && Number(capacity) > 0

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!session) return
    setError(null)
    const lines = coordinators.split('\n').map((l) => l.trim()).filter(Boolean)
    const phones = lines.map(normaliseEgyptianMobile)
    if (phones.some((p) => p === null)) {
      setError(new ApiError('invalidPhone'))
      return
    }
    setBusy(true)
    try {
      await api.organisations.registerNgo(session.phone, {
        name: name.trim(),
        registrationNo: registrationNo.trim(),
        serviceAreas,
        foodTypes,
        capacityKgPerDay: Number(capacity),
        coordinatorPhones: phones as string[],
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
      <h1>{t('nav.registerNgo')}</h1>
      <form className="card form" onSubmit={onSubmit} noValidate>
        <Field label={t('form.name')} htmlFor="name">
          <input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
        </Field>
        <Field label={t('form.ngoRegistrationNo')} htmlFor="reg">
          <input id="reg" dir="ltr" value={registrationNo} onChange={(e) => setRegistrationNo(e.target.value)} required />
        </Field>

        <fieldset className="field">
          <legend>{t('form.serviceAreas')}</legend>
          <div className="choice-row">
            {CAIRO_AREAS.map((a) => (
              <label key={a} className={`choice${serviceAreas.includes(a) ? ' selected' : ''}`}>
                <input type="checkbox" checked={serviceAreas.includes(a)} onChange={() => setServiceAreas((l) => toggle(l, a))} />
                {t(`areas.${a}`)}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="field">
          <legend>{t('form.foodTypes')}</legend>
          <div className="choice-row">
            {FOOD_CATEGORIES.map((f) => (
              <label key={f} className={`choice${foodTypes.includes(f) ? ' selected' : ''}`}>
                <input type="checkbox" checked={foodTypes.includes(f)} onChange={() => setFoodTypes((l) => toggle(l, f))} />
                {t(`food.${f}`)}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="grid-2">
          <Field label={t('form.capacity')} htmlFor="cap">
            <input id="cap" type="number" min={1} dir="ltr" value={capacity} onChange={(e) => setCapacity(e.target.value)} />
          </Field>
          <Field label={t('form.coordinators')} hint={t('form.coordinatorsHint')} htmlFor="coord">
            <textarea id="coord" dir="ltr" rows={3} value={coordinators} onChange={(e) => setCoordinators(e.target.value)} />
          </Field>
        </div>

        <DocumentPicker kinds={['ngoRegistration']} value={documents} onChange={setDocuments} />

        <ErrorText error={error} />
        <button className="btn btn-primary" disabled={busy || !complete}>
          <span aria-hidden="true">📨</span> {busy ? t('form.submitting') : t('form.submit')}
        </button>
      </form>
    </section>
  )
}
