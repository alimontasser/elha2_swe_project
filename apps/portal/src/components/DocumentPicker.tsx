import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import type { DocumentKind, OrgDocument } from '../domain/types'

// Demo: only the file name is kept. The real build uploads through the IFiles adapter
// to a private Supabase Storage bucket (SDD v1.1 §4.1.3).
export function DocumentPicker({
  kinds,
  value,
  onChange,
}: {
  kinds: DocumentKind[]
  value: OrgDocument[]
  onChange: (docs: OrgDocument[]) => void
}) {
  const { t } = useTranslation()
  const baseId = useId()
  return (
    <fieldset className="field">
      <legend>
        {t('form.documents')} <span className="req">*</span>
      </legend>
      <p className="hint">{t('form.documentsHint')}</p>
      {kinds.map((kind) => {
        const current = value.find((d) => d.kind === kind)
        const id = `${baseId}-${kind}`
        return (
          <div key={kind} className="doc-row">
            <span className="doc-label">
              <span aria-hidden="true">📄</span> {t(`form.doc.${kind}`)}
            </span>
            <label htmlFor={id} className="btn btn-secondary">
              {t('form.chooseFile')}
            </label>
            <input
              id={id}
              type="file"
              accept=".pdf,image/*"
              className="visually-hidden"
              data-testid={`file-${kind}`}
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (!file) return
                onChange([...value.filter((d) => d.kind !== kind), { kind, fileName: file.name }])
              }}
            />
            <span className={current ? 'file-name' : 'muted'}>
              {current ? (
                <>
                  <span aria-hidden="true">✓</span> <bdi>{current.fileName}</bdi>
                </>
              ) : (
                t('form.noFile')
              )}
            </span>
          </div>
        )
      })}
    </fieldset>
  )
}
