export const LEAVE_REASON_MIN_WORDS = 25;
export const LEAVE_REASON_MAX_WORDS = 300;

export function countWords(value: string) {
  return value
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

export function isLeaveReasonWithinLimit(value: string) {
  const wordCount = countWords(value);
  return wordCount >= LEAVE_REASON_MIN_WORDS && wordCount <= LEAVE_REASON_MAX_WORDS;
}
