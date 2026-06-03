export type EditableMeetingPointRef = {
  id?: string | null;
};

export type MeetingPointTimeRef = {
  time?: string | null;
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

export const sortMeetingPointsChronologically = <T extends MeetingPointTimeRef>(
  points: readonly T[] | null | undefined,
): T[] =>
  [...(points || [])]
    .map((point, index) => ({
      point,
      index,
      minutes: getMeetingPointMinutesSinceMidnight(point.time),
    }))
    .sort((left, right) => {
      if (left.minutes !== null && right.minutes !== null && left.minutes !== right.minutes) {
        return left.minutes - right.minutes;
      }
      if (left.minutes !== null && right.minutes === null) return -1;
      if (left.minutes === null && right.minutes !== null) return 1;
      return left.index - right.index;
    })
    .map(({ point }) => point);

const getMeetingPointMinutesSinceMidnight = (time?: string | null) => {
  const normalized = time?.trim().replace(/\./g, ":");
  if (!normalized) return null;

  const [hourPart, minutePart] = normalized.split(":");
  if (!/^\d{1,2}$/.test(hourPart)) return null;

  const hour = Number(hourPart);
  if (hour < 0 || hour >= 24) return null;

  if (minutePart === undefined || minutePart === "") return hour * 60;
  if (!/^\d{1,2}$/.test(minutePart)) return null;

  const minute = Number(minutePart);
  if (minute < 0 || minute >= 60) return null;

  return hour * 60 + minute;
};
