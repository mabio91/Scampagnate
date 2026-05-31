export type EditableMeetingPointRef = {
  id?: string | null;
  name?: string | null;
  location?: string | null;
  time?: string | null;
};

export type PrimaryMeetingPointSource = {
  location?: string | null;
  locationLabel?: string | null;
  time?: string | null;
};

export type PrimaryMeetingPoint = {
  name: string;
  location: string;
  time: string;
};

export const PRIMARY_MEETING_POINT_FALLBACK_NAME = "Luogo di ritrovo";
export const PRIMARY_MEETING_POINT_FALLBACK_LOCATION = "Da definire";
export const PRIMARY_MEETING_POINT_FALLBACK_TIME = "09:00";

const cleanText = (value?: string | null) => value?.trim() || "";

const normalizeTime = (value?: string | null) => {
  const cleanValue = cleanText(value);
  return cleanValue ? cleanValue.slice(0, 5) : PRIMARY_MEETING_POINT_FALLBACK_TIME;
};

export const buildPrimaryMeetingPoint = (source: PrimaryMeetingPointSource): PrimaryMeetingPoint => ({
  name: cleanText(source.locationLabel) || PRIMARY_MEETING_POINT_FALLBACK_NAME,
  location: cleanText(source.location) || PRIMARY_MEETING_POINT_FALLBACK_LOCATION,
  time: normalizeTime(source.time),
});

const isMatchingPrimaryMeetingPoint = (
  point: EditableMeetingPointRef,
  source: PrimaryMeetingPointSource,
) => {
  const primary = buildPrimaryMeetingPoint(source);
  return (
    cleanText(point.name) === primary.name &&
    cleanText(point.location) === primary.location &&
    normalizeTime(point.time) === primary.time
  );
};

export const ensurePrimaryMeetingPoint = <T extends EditableMeetingPointRef>(
  points: T[],
  source: PrimaryMeetingPointSource,
  createPoint: (point: PrimaryMeetingPoint) => T,
  previousSource?: PrimaryMeetingPointSource | null,
) => {
  const primary = buildPrimaryMeetingPoint(source);
  const sourceCandidates = [source, previousSource].filter(Boolean) as PrimaryMeetingPointSource[];
  const existingPrimaryIndex = points.findIndex((point) =>
    sourceCandidates.some((candidate) => isMatchingPrimaryMeetingPoint(point, candidate)),
  );

  if (existingPrimaryIndex >= 0) {
    const existingPrimary = points[existingPrimaryIndex];
    return [
      { ...existingPrimary, ...primary },
      ...points.filter((_, index) => index !== existingPrimaryIndex),
    ];
  }

  return [createPoint(primary), ...points];
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
