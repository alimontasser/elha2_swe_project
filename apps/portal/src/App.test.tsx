import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import App from './App'
import i18n, { setLanguage } from './i18n'

describe('portal shell (US-1.02, NFR-16)', () => {
  beforeEach(async () => {
    window.localStorage.clear()
    await act(async () => {
      setLanguage('ar')
    })
  })

  it('opens in Arabic with a right-to-left document', () => {
    render(<App />)
    expect(document.documentElement.dir).toBe('rtl')
    expect(document.documentElement.lang).toBe('ar')
    expect(screen.getByRole('heading', { name: 'تسجيل الدخول لبوابة إلحق' })).toBeInTheDocument()
  })

  it('switches to English left-to-right instantly', async () => {
    render(<App />)
    await userEvent.click(screen.getByRole('button', { name: 'تغيير اللغة' }))
    expect(i18n.language).toBe('en')
    expect(document.documentElement.dir).toBe('ltr')
    expect(await screen.findByRole('heading', { name: 'Sign in to the Elha2 portal' })).toBeInTheDocument()
  })
})
