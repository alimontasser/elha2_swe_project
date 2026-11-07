import type { NotificationType } from './notifications.interfaces';

// Text the server writes into notifications, in the reader's language (US-1.02).
// {placeholders} are filled from the values the sending module passes.

type Template = { title: string; body: string };

export const MESSAGES: Record<NotificationType, Record<'ar' | 'en', Template>> = {
  expiryDigest: {
    ar: { title: 'حاجات قربت تخلص', body: 'عندك {count} حاجة هتخلص خلال يومين. افتح المطبخ واستخدمها الأول.' },
    en: { title: 'Food to use soon', body: '{count} items expire within 2 days. Open your pantry and use them first.' },
  },
  reservation: {
    ar: { title: 'الحجز اتأكد', body: 'حجزك من {store} اتأكد. الاستلام {pickup}.' },
    en: { title: 'Reservation confirmed', body: 'Your order from {store} is confirmed. Pickup {pickup}.' },
  },
  pickup: {
    ar: { title: 'ميعاد الاستلام قرّب', body: 'استلم طلبك من {store} قبل {pickup}.' },
    en: { title: 'Pickup soon', body: 'Collect your order from {store} before {pickup}.' },
  },
};

/** The screen each type opens (US-11.01). */
export const DEEP_LINKS: Record<NotificationType, string> = {
  expiryDigest: '/pantry',
  reservation: '/deals',
  pickup: '/deals',
};

export function render(type: NotificationType, language: 'ar' | 'en', values: Record<string, string | number> = {}): Template {
  const fill = (text: string) => text.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ''));
  const t = MESSAGES[type][language];
  return { title: fill(t.title), body: fill(t.body) };
}

/** Values for the demo pushes sent from the app's Settings (non-production only). */
export const DEMO_VALUES: Record<NotificationType, Record<'ar' | 'en', Record<string, string | number>>> = {
  expiryDigest: { ar: { count: 3 }, en: { count: 3 } },
  reservation: { ar: { store: 'مخبز الشمس', pickup: 'النهارده 8–9 م' }, en: { store: 'Al Shams Bakery', pickup: 'today 8–9 pm' } },
  pickup: { ar: { store: 'مخبز الشمس', pickup: '9 م' }, en: { store: 'Al Shams Bakery', pickup: '9 pm' } },
};
