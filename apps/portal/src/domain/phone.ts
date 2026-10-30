// Egyptian mobile numbers: 010, 011, 012 or 015 followed by 8 digits.
// Accepts a +20 / 0020 prefix and Arabic-Indic digits, and returns the local 11-digit form.
const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩'

export function normaliseEgyptianMobile(input: string): string | null {
  const ascii = input.replace(/[٠-٩]/g, (d) => String(ARABIC_DIGITS.indexOf(d)))
  let digits = ascii.replace(/[\s\-()]/g, '')
  if (digits.startsWith('+20')) digits = '0' + digits.slice(3)
  else if (digits.startsWith('0020')) digits = '0' + digits.slice(4)
  else if (digits.startsWith('20') && digits.length === 12) digits = '0' + digits.slice(2)
  return /^01[0125]\d{8}$/.test(digits) ? digits : null
}
