import { type FormEvent, useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { api } from '../api'
import { ErrorText, Field } from '../components/ui'
import {
  FOOD_CATEGORIES,
  PRODUCT_UNITS,
  type FoodCategory,
  type ProductForReview,
  type ProductReviewFilter,
  type ProductUnit,
} from '../domain/types'
import { formatDate } from '../i18n'

const FILTERS: ProductReviewFilter[] = ['pending', 'aiAccepted', 'rejected', 'all']
const STATUS_ICON = { known: '✓', pendingReview: '⏳', rejected: '✕' } as const

// US-2.03: the AI reviews the names shoppers give unknown barcodes. Administrators decide what it
// was unsure about, and can overrule it; every decision keeps who made it and why.
export function AdminProducts() {
  const { t } = useTranslation()
  const [filter, setFilter] = useState<ProductReviewFilter>('pending')
  const [loaded, setLoaded] = useState<{ filter: ProductReviewFilter; items: ProductForReview[] } | null>(null)
  const [error, setError] = useState<unknown>(null)
  const [saved, setSaved] = useState(false)
  const items = loaded?.filter === filter ? loaded.items : null

  const reload = useCallback(
    (f: ProductReviewFilter) =>
      api.products.list(f).then(
        (list) => {
          setError(null)
          setLoaded({ filter: f, items: list })
        },
        (e: unknown) => setError(e),
      ),
    [],
  )

  useEffect(() => {
    void reload(filter)
  }, [filter, reload])

  return (
    <section>
      <h1>{t('products.title')}</h1>
      <p className="muted">{t('products.subtitle')}</p>
      <div className="tabs" role="tablist" aria-label={t('products.filter')}>
        {FILTERS.map((f) => (
          <button key={f} role="tab" aria-selected={filter === f} className={`tab${filter === f ? ' active' : ''}`} onClick={() => {
              setFilter(f)
              setSaved(false)
            }}>
            {t(`products.tab.${f}`)}
          </button>
        ))}
      </div>
      {saved && (
        <p className="success" role="status">
          <span aria-hidden="true">✓</span> {t('products.saved')}
        </p>
      )}
      <ErrorText error={error} />
      {!items ? (
        !error && <p className="muted">{t('app.loading')}</p>
      ) : items.length === 0 ? (
        <div className="card empty">{t('products.empty')}</div>
      ) : (
        <ul className="product-list">
          {items.map((p) => (
            <ProductCard
              key={p.barcode}
              product={p}
              onDecided={() => {
                setSaved(true)
                void reload(filter)
              }}
            />
          ))}
        </ul>
      )}
    </section>
  )
}

function ProductCard({ product: p, onDecided }: { product: ProductForReview; onDecided: () => void }) {
  const { t, i18n } = useTranslation()
  const [mode, setMode] = useState<'view' | 'accept' | 'reject'>('view')
  const name = (i18n.language === 'ar' ? p.nameAr : p.nameEn) ?? p.nameAr ?? p.nameEn
  const decidedBy = p.reviewedBy === 'admin' ? t('products.byAdmin') : p.reviewedBy === 'ai' ? t('products.byAi') : t('products.waiting')

  return (
    <li className="card product-card">
      <div className="product-head">
        <div>
          <strong>{name ?? <span className="muted">{t('products.textNotKept')}</span>}</strong>
          <div className="muted">
            {t('products.barcode')} <bdi dir="ltr">{p.barcode}</bdi> · {t('products.namedOn', { date: formatDate(p.suggestedAt, i18n.language) })}
          </div>
        </div>
        <span className={`badge badge-product-${p.status}`}>
          <span aria-hidden="true">{STATUS_ICON[p.status]}</span> {t(`products.status.${p.status}`)}
        </span>
      </div>
      {p.status === 'known' && (
        <p>
          {p.category && <span className="chip">{t(`food.${p.category}`)}</span>}{' '}
          {p.quantity !== null && p.unit && (
            <span className="chip">
              {p.quantity} {t(`products.unit.${p.unit}`)}
            </span>
          )}{' '}
          {p.catalogueId && <span className="chip">{t('products.catalogue', { id: p.catalogueId })}</span>}
        </p>
      )}
      {p.reviewNote && (
        <p className="review-note">
          <strong>{decidedBy}:</strong> <bdi>{p.reviewNote}</bdi>
        </p>
      )}
      {mode === 'view' ? (
        <div className="actions">
          <button type="button" className="btn btn-primary btn-small" onClick={() => setMode('accept')}>
            <span aria-hidden="true">✓</span> {p.status === 'known' ? t('products.edit') : t('products.accept')}
          </button>
          {p.status !== 'rejected' && (
            <button type="button" className="btn btn-danger btn-small" onClick={() => setMode('reject')}>
              <span aria-hidden="true">✕</span> {t('products.reject')}
            </button>
          )}
        </div>
      ) : mode === 'accept' ? (
        <AcceptForm product={p} onCancel={() => setMode('view')} onDone={onDecided} />
      ) : (
        <RejectForm product={p} onCancel={() => setMode('view')} onDone={onDecided} />
      )}
    </li>
  )
}

function AcceptForm({ product: p, onCancel, onDone }: { product: ProductForReview; onCancel: () => void; onDone: () => void }) {
  const { t, i18n } = useTranslation()
  const [nameAr, setNameAr] = useState(p.nameAr ?? '')
  const [nameEn, setNameEn] = useState(p.nameEn ?? '')
  const [category, setCategory] = useState<FoodCategory>(p.category ?? p.candidates[0]?.category ?? 'dry')
  const [catalogueId, setCatalogueId] = useState(p.catalogueId ?? '')
  const [quantity, setQuantity] = useState(p.quantity?.toString() ?? '')
  const [unit, setUnit] = useState<ProductUnit>(p.unit ?? 'piece')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const id = `p-${p.barcode}`

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const size = Number(quantity)
    try {
      await api.products.decide(p.barcode, {
        decision: 'accept',
        nameAr: nameAr.trim(),
        nameEn: nameEn.trim(),
        category,
        catalogueId: catalogueId || null,
        quantity: size > 0 ? size : null,
        unit: size > 0 ? unit : null,
      })
      onDone()
    } catch (err) {
      setError(err)
      setBusy(false)
    }
  }

  return (
    <form className="decision-form" onSubmit={submit}>
      <div className="grid-2">
        <Field label={t('products.nameAr')} htmlFor={`${id}-ar`}>
          <input id={`${id}-ar`} value={nameAr} onChange={(e) => setNameAr(e.target.value)} required maxLength={60} dir="rtl" />
        </Field>
        <Field label={t('products.nameEn')} htmlFor={`${id}-en`}>
          <input id={`${id}-en`} value={nameEn} onChange={(e) => setNameEn(e.target.value)} required maxLength={60} dir="ltr" />
        </Field>
        <Field label={t('products.category')} htmlFor={`${id}-cat`}>
          <select id={`${id}-cat`} value={category} onChange={(e) => setCategory(e.target.value as FoodCategory)}>
            {FOOD_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {t(`food.${c}`)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('products.catalogueItem')} hint={t('products.catalogueHint')} htmlFor={`${id}-item`}>
          <select id={`${id}-item`} value={catalogueId} onChange={(e) => setCatalogueId(e.target.value)}>
            <option value="">{t('products.noCatalogueItem')}</option>
            {[...p.candidates, ...(p.catalogueId && !p.candidates.some((c) => c.id === p.catalogueId) ? [{ id: p.catalogueId, nameAr: p.catalogueId, nameEn: p.catalogueId }] : [])].map((c) => (
              <option key={c.id} value={c.id}>
                {i18n.language === 'ar' ? c.nameAr : c.nameEn}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('products.size')} hint={t('products.sizeHint')} htmlFor={`${id}-qty`}>
          <input id={`${id}-qty`} type="number" min="0" step="any" inputMode="decimal" dir="ltr" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
        </Field>
        <Field label={t('products.unitLabel')} htmlFor={`${id}-unit`}>
          <select id={`${id}-unit`} value={unit} onChange={(e) => setUnit(e.target.value as ProductUnit)}>
            {PRODUCT_UNITS.map((u) => (
              <option key={u} value={u}>
                {t(`products.unit.${u}`)}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <ErrorText error={error} />
      <div className="actions">
        <button className="btn btn-primary" disabled={busy || !nameAr.trim() || !nameEn.trim()}>
          <span aria-hidden="true">✓</span> {t('products.saveAccept')}
        </button>
        <button type="button" className="btn btn-secondary" onClick={onCancel}>
          {t('products.cancel')}
        </button>
      </div>
    </form>
  )
}

function RejectForm({ product: p, onCancel, onDone }: { product: ProductForReview; onCancel: () => void; onDone: () => void }) {
  const { t } = useTranslation()
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const id = `r-${p.barcode}`

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await api.products.decide(p.barcode, { decision: 'reject', note: reason.trim() })
      onDone()
    } catch (err) {
      setError(err)
      setBusy(false)
    }
  }

  return (
    <form className="decision-form" onSubmit={submit}>
      <Field label={t('products.reason')} hint={t('products.reasonHint')} htmlFor={id}>
        <textarea id={id} value={reason} onChange={(e) => setReason(e.target.value)} required maxLength={200} rows={2} />
      </Field>
      <ErrorText error={error} />
      <div className="actions">
        <button className="btn btn-danger" disabled={busy || !reason.trim()}>
          <span aria-hidden="true">✕</span> {t('products.saveReject')}
        </button>
        <button type="button" className="btn btn-secondary" onClick={onCancel}>
          {t('products.cancel')}
        </button>
      </div>
    </form>
  )
}
