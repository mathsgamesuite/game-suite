import { describe, expect, it } from 'vitest'
import { topUniqueScores } from './leaderboard'

describe('topUniqueScores', () => {
  it('keeps each account personal best and ranks unique players', () => {
    const scores = [
      { user_id: 'alice', display_name: 'Alice', score: 400 },
      { user_id: 'bob', display_name: 'Bob', score: 700 },
      { user_id: 'alice', display_name: 'Alice', score: 900 },
      { user_id: 'carol', display_name: 'Carol', score: 600 },
      { user_id: 'bob', display_name: 'Bob', score: 500 },
    ]

    expect(topUniqueScores(scores)).toEqual([
      { user_id: 'alice', display_name: 'Alice', score: 900 },
      { user_id: 'bob', display_name: 'Bob', score: 700 },
      { user_id: 'carol', display_name: 'Carol', score: 600 },
    ])
  })

  it('limits the result to ten accounts', () => {
    const scores = Array.from({ length: 12 }, (_, index) => ({
      user_id: `user-${index}`,
      display_name: `Player ${index}`,
      score: 1000 - index,
    }))

    expect(topUniqueScores(scores)).toHaveLength(10)
    expect(topUniqueScores(scores).at(-1).score).toBe(991)
  })
})