/**
 * Returns the current NFL season year.
 * NFL seasons span two calendar years. The season is identified by the year it starts.
 * If we're in Jan-Mar, it's still the previous year's season.
 */
export function getCurrentSeason(): string {
  const now = new Date()
  const month = now.getMonth() // 0-indexed
  const year = now.getFullYear()
  // NFL season starts in September. Jan-Mar belongs to previous year's season.
  return month <= 2 ? String(year - 1) : String(year)
}
