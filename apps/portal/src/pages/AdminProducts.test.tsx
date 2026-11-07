import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import App from '../App'
import { setLanguage } from '../i18n'

describe('admin product review page (US-2.03)', () => {
  beforeEach(async () => {
    window.localStorage.clear()
    // Signed in as the demo administrator, under the demo and the Supabase sign-in's keys alike.
    const admin = JSON.stringify({ phone: '01000000000', role: 'admin' })
    window.localStorage.setItem('elha2-portal-demo-session-v1', admin)
    window.localStorage.setItem('elha2-portal-session-v1', admin)
    window.location.hash = '#/admin/products'
    await act(async () => {
      setLanguage('ar')
    })
  })

  it('an admin accepts what the AI was unsure about, with corrected details', async () => {
    const user = userEvent.setup()
    render(<App />)
    expect(await screen.findByRole('heading', { name: 'مراجعة المنتجات' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /مراجعة المنتجات/ })).toHaveClass('active')
    expect(screen.getByRole('link', { name: /التحقق/ })).not.toHaveClass('active')

    const card = (await screen.findByText('جبنه رومي')).closest('li')!
    expect(within(card).getByText(/brand and size unclear/)).toBeInTheDocument()
    await user.click(within(card).getByRole('button', { name: /اقبل/ }))
    await user.type(within(card).getByLabelText('الاسم بالإنجليزي'), 'Roumi cheese')
    await user.selectOptions(within(card).getByLabelText('النوع'), 'dairy')
    await user.selectOptions(within(card).getByLabelText('صنف الكتالوج'), 'roumi-cheese')
    await user.type(within(card).getByLabelText('حجم العبوة'), '250')
    await user.selectOptions(within(card).getByLabelText('الوحدة'), 'g')
    await user.click(within(card).getByRole('button', { name: /احفظ كمقبول/ }))

    expect(await screen.findByRole('status')).toHaveTextContent('القرار اتحفظ.')
    expect(await screen.findByText('مفيش حاجة هنا.')).toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: 'الكل' }))
    const accepted = (await screen.findByText('جبنه رومي')).closest('li')!
    expect(within(accepted).getByText(/مقبولة/)).toBeInTheDocument()
    expect(within(accepted).getByText(/250 جم/)).toBeInTheDocument()
  })

  it('an admin overrules an AI acceptance; a reason is required', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(await screen.findByRole('tab', { name: 'قبلها الذكاء الاصطناعي' }))
    const card = (await screen.findByText('بسكويت شمعدان بالشيكولاتة')).closest('li')!
    await user.click(within(card).getByRole('button', { name: /ارفض/ }))
    const confirm = within(card).getAllByRole('button', { name: /ارفض/ }).at(-1)!
    expect(confirm).toBeDisabled()
    await user.type(within(card).getByLabelText('السبب'), 'الباركود لمنتج تاني')
    await user.click(confirm)
    expect(await screen.findByRole('status')).toHaveTextContent('القرار اتحفظ.')
    await user.click(screen.getByRole('tab', { name: 'مرفوضة' }))
    expect(await screen.findByText('الباركود لمنتج تاني')).toBeInTheDocument()
  })
})
