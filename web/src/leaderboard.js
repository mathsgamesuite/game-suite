export function topUniqueScores(scores, limit = 10) {
  const bestByUser = new Map()

  for (const entry of scores) {
    const currentBest = bestByUser.get(entry.user_id)
    if (!currentBest || entry.score > currentBest.score) {
      bestByUser.set(entry.user_id, entry)
    }
  }

  return [...bestByUser.values()]
    .sort((left, right) => right.score - left.score)
    .slice(0, limit)
}