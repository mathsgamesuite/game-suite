export const ROUND_COUNT = 10
export const NODE_COUNT = 5
export const MAX_ROUND_POINTS = 1000
export const MIN_ROUND_POINTS = 100
export const DECAY_PER_SECOND = 120

export function scoreForElapsedMs(elapsedMs) {
  const decay = (elapsedMs / 1000) * DECAY_PER_SECOND
  return Math.max(MIN_ROUND_POINTS, Math.round(MAX_ROUND_POINTS - decay))
}

export function isomorphicByBruteForce(left, right) {
  if (left.length !== right.length) return false
  const n = left.length
  const used = new Array(n).fill(false)
  const permutation = new Array(n).fill(0)

  const checkPermutation = () => {
    for (let i = 0; i < n; i += 1) {
      for (let j = 0; j < n; j += 1) {
        if (left[i][j] !== right[permutation[i]][permutation[j]]) {
          return false
        }
      }
    }
    return true
  }

  const search = (index) => {
    if (index === n) return checkPermutation()
    for (let node = 0; node < n; node += 1) {
      if (used[node]) continue
      used[node] = true
      permutation[index] = node
      if (search(index + 1)) return true
      used[node] = false
    }
    return false
  }

  return search(0)
}

export function makeRandomGraph(nodeCount = NODE_COUNT, rng = Math.random) {
  const matrix = Array.from({ length: nodeCount }, () =>
    Array.from({ length: nodeCount }, () => 0),
  )

  for (let i = 0; i < nodeCount; i += 1) {
    for (let j = i + 1; j < nodeCount; j += 1) {
      const edge = rng() > 0.5 ? 1 : 0
      matrix[i][j] = edge
      matrix[j][i] = edge
    }
  }

  return matrix
}

export function permuteGraph(graph, permutation) {
  const n = graph.length
  const output = Array.from({ length: n }, () => Array.from({ length: n }, () => 0))
  for (let i = 0; i < n; i += 1) {
    for (let j = 0; j < n; j += 1) {
      output[permutation[i]][permutation[j]] = graph[i][j]
    }
  }
  return output
}

function shuffledNodes(length, rng = Math.random) {
  const list = Array.from({ length }, (_, i) => i)
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1))
    ;[list[i], list[j]] = [list[j], list[i]]
  }
  return list
}

export function createRound(rng = Math.random) {
  const isIsomorphic = rng() > 0.5
  const left = makeRandomGraph(NODE_COUNT, rng)

  if (isIsomorphic) {
    return {
      left,
      right: permuteGraph(left, shuffledNodes(NODE_COUNT, rng)),
      isIsomorphic,
    }
  }

  let right = makeRandomGraph(NODE_COUNT, rng)
  let attempts = 0
  while (isomorphicByBruteForce(left, right) && attempts < 100) {
    right = makeRandomGraph(NODE_COUNT, rng)
    attempts += 1
  }

  return {
    left,
    right,
    isIsomorphic: false,
  }
}
