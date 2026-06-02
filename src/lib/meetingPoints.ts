export type EditableMeetingPointRef = {
  id?: string | null;
};

export const getRetainedMeetingPointIds = (points: EditableMeetingPointRef[]) =>
  points
    .map((point) => point.id)
    .filter((id): id is string => Boolean(id));

export const getRemovedMeetingPointIds = (
  existingIds: string[],
  points: EditableMeetingPointRef[],
) => {
  const retainedIds = new Set(getRetainedMeetingPointIds(points));
  return existingIds.filter((id) => !retainedIds.has(id));
};
