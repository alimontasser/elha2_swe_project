import { useTranslation } from 'react-i18next'

const SAMPLE = [
  { code: '4821', customer: 'Mona A.', item: 'Surprise bag', window: '21:00–22:00', amount: 60, collected: false },
  { code: '1937', customer: 'Karim S.', item: 'Surprise bag', window: '21:00–22:00', amount: 60, collected: true },
  { code: '5502', customer: 'Nour H.', item: 'Pastry box', window: '21:00–22:00', amount: 40, collected: false },
]

// Wireframe (i) from SDD v1.1 §5.2, static sample data. Built for real in Sprint 3 (US-6.04).
export function TodaysOrders() {
  const { t, i18n } = useTranslation()
  const egp = new Intl.NumberFormat(i18n.language === 'ar' ? 'ar-EG' : 'en-EG', { style: 'currency', currency: 'EGP', maximumFractionDigits: 0 })
  return (
    <section>
      <h1>
        {t('orders.title')} · {t('orders.branch')}
      </h1>
      <p className="callout">
        <span aria-hidden="true">🚧</span> {t('orders.preview')}
      </p>
      <div className="card scan-box">
        <button className="btn btn-primary" disabled>
          <span aria-hidden="true">📷</span> {t('orders.scan')}
        </button>
        <label className="muted" htmlFor="code">
          {t('orders.typeCode')}
        </label>
        <input id="code" dir="ltr" inputMode="numeric" maxLength={4} className="code-input" disabled />
      </div>
      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>{t('orders.colCode')}</th>
              <th>{t('orders.colCustomer')}</th>
              <th>{t('orders.colItem')}</th>
              <th>{t('orders.colWindow')}</th>
              <th>{t('orders.colPayment')}</th>
              <th>{t('orders.colStatus')}</th>
            </tr>
          </thead>
          <tbody>
            {SAMPLE.map((o) => (
              <tr key={o.code}>
                <td>
                  <bdi dir="ltr">{o.code}</bdi>
                </td>
                <td>{o.customer}</td>
                <td>{o.item}</td>
                <td>
                  <bdi dir="ltr">{o.window}</bdi>
                </td>
                <td>{egp.format(o.amount)}</td>
                <td>
                  <span className={`badge ${o.collected ? 'badge-verified' : 'badge-pending'}`}>
                    <span aria-hidden="true">{o.collected ? '✓' : '⏳'}</span> {o.collected ? t('orders.collected') : t('orders.waiting')}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted">{t('orders.autoDonate')}</p>
    </section>
  )
}

export function ComingSoon({ sprint, title }: { sprint: number; title: string }) {
  const { t } = useTranslation()
  return (
    <section>
      <h1>{title}</h1>
      <div className="card empty">
        <span aria-hidden="true">🚧</span> {t('app.comingSprint', { n: sprint })}
      </div>
    </section>
  )
}
