/**
 * A WhatsApp number as people type it. Mirrors the backend (`App\Support\PhoneNumber`): the country code is required
 * (`+` or `00`); spaces, dashes, dots, brackets, direction marks and Arabic digits are accepted.
 * Returns `+` and 8–15 digits, or null.
 */
export function normalizePhone(input: string): string | null {
  const value = input
    .replace(/[٠-٩۰-۹]/g, d => String(d.charCodeAt(0) & 0xf))
    .replace(/[\s().\-؜‎‏‪-‮⁦-⁩]+/g, '')
    .replace(/^00/, '+')
  return /^\+[1-9]\d{7,14}$/.test(value) ? value : null
}

/** Opens a chat with a stored number (`+` and digits). */
export const whatsappChatUrl = (phone: string) => `https://wa.me/${phone.replace(/\D/g, '')}`

/** Keeps a number left-to-right inside an Arabic sentence (toasts and other plain strings). */
export const isolateLtr = (text: string) => `⁦${text}⁩`
