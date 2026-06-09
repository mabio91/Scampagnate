import type { CommunityLevel } from "@/hooks/useCommunityLevel";

export const getCurrentCommunityLevel = (
  points: number | null | undefined,
  levels: CommunityLevel[]
) => {
  if (!levels.length) return null;

  const sortedLevels = [...levels].sort((a, b) => a.min_points - b.min_points);
  const normalizedPoints = points ?? 0;
  let currentLevel = sortedLevels[0];

  for (const level of sortedLevels) {
    if (normalizedPoints >= level.min_points) {
      currentLevel = level;
    }
  }

  return currentLevel;
};
