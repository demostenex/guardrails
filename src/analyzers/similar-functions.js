import { calculateTokenSimilarity } from "./function-shape.js";

export function findSimilarGroups(candidates, threshold) {
  const parent = candidates.map((_, index) => index);
  const pairs = [];

  for (let left = 0; left < candidates.length; left += 1) {
    for (let right = left + 1; right < candidates.length; right += 1) {
      const similarity = compareCandidates(candidates[left], candidates[right], threshold);

      if (similarity < threshold) {
        continue;
      }

      union(parent, left, right);
      pairs.push({ left, right, similarity });
    }
  }

  return collectSimilarGroups(candidates, parent, pairs);
}

function compareCandidates(left, right, threshold) {
  if (left.normalizedBody === right.normalizedBody) {
    return 0;
  }

  const lengthRatio =
    Math.min(left.shapeTokens.length, right.shapeTokens.length) /
    Math.max(left.shapeTokens.length, right.shapeTokens.length);

  if (lengthRatio < Math.max(0.5, threshold - 0.25)) {
    return 0;
  }

  return calculateTokenSimilarity(left.shapeTokens, right.shapeTokens);
}

function collectSimilarGroups(candidates, parent, pairs) {
  const groups = new Map();

  for (let index = 0; index < candidates.length; index += 1) {
    const root = find(parent, index);
    const group = groups.get(root) ?? { candidates: [], similarity: 0 };
    group.candidates.push(candidates[index]);
    groups.set(root, group);
  }

  for (const pair of pairs) {
    const group = groups.get(find(parent, pair.left));
    group.similarity = Math.max(group.similarity, pair.similarity);
  }

  return [...groups.values()].filter((group) => group.candidates.length > 1);
}

function union(parent, left, right) {
  const leftRoot = find(parent, left);
  const rightRoot = find(parent, right);

  if (leftRoot !== rightRoot) {
    parent[rightRoot] = leftRoot;
  }
}

function find(parent, index) {
  while (parent[index] !== index) {
    parent[index] = parent[parent[index]];
    index = parent[index];
  }

  return index;
}
