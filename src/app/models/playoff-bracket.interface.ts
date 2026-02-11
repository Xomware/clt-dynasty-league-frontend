export interface PlayoffBracketMatch {
  r: number              // Round number (1, 2, 3...)
  m: number              // Match ID within this bracket
  t1: number | null      // Roster ID of team 1 (null if from previous round)
  t2: number | null      // Roster ID of team 2 (null if from previous round)
  w: number | null       // Winner's roster ID (null if not yet played)
  l: number | null       // Loser's roster ID (null if not yet played)
  t1_from?: {
    w?: number           // Winner of match ID
    l?: number           // Loser of match ID
  }
  t2_from?: {
    w?: number
    l?: number
  }
  p?: number             // Placement (1 = champion, 3 = 3rd place, etc.)
}
