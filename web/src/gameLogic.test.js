import { describe, expect, it } from 'vitest'
import {
  NODE_COUNT,
  createRound,
  isomorphicByBruteForce,
  permuteGraph,
  scoreForElapsedMs,
} from './gameLogic'

function makePathGraph() {
  return [
    [0, 1, 0, 0],
    [1, 0, 1, 0],
    [0, 1, 0, 1],
    [0, 0, 1, 0],
  ]
}

describe('scoreForElapsedMs', () => {
  it('decays score over time and keeps a floor', () => {
    expect(scoreForElapsedMs(0)).toBe(1000)
    expect(scoreForElapsedMs(1000)).toBe(880)
    expect(scoreForElapsedMs(20000)).toBe(100)
  })
})

describe('isomorphicByBruteForce', () => {
  it('identifies isomorphic graphs', () => {
    const graph = makePathGraph()
    const permuted = permuteGraph(graph, [3, 1, 2, 0])
    expect(isomorphicByBruteForce(graph, permuted)).toBe(true)
  })

  it('rejects non-isomorphic graphs', () => {
    const path = makePathGraph()
    const cycle = [
      [0, 1, 0, 1],
      [1, 0, 1, 0],
      [0, 1, 0, 1],
      [1, 0, 1, 0],
    ]
    expect(isomorphicByBruteForce(path, cycle)).toBe(false)
  })
})

describe('createRound', () => {
  it('creates graphs with expected node count and label', () => {
    const round = createRound()
    expect(round.left.length).toBe(NODE_COUNT)
    expect(round.right.length).toBe(NODE_COUNT)
    expect(isomorphicByBruteForce(round.left, round.right)).toBe(round.isIsomorphic)
  })
})
