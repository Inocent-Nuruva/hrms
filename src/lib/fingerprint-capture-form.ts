/** A capture needs an explicitly selected, unused device fingerprint slot. */
export function canCaptureFingerprint(
  verifyModeReady: boolean,
  selectedSlot: string,
  occupiedSlots: readonly string[],
): boolean {
  const slot = selectedSlot.trim();
  return verifyModeReady && /^(?:[1-9]|10)$/.test(slot) && !occupiedSlots.includes(slot);
}
