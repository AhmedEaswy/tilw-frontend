/**
 * Carries the joined email from the waitlist form to the confirmation screen (6:63 → 6:64)
 * in memory, so the address never goes into the URL.
 */
export const useWaitlistEmail = () => useState<string>('waitlist-email', () => '')
