export interface InterestCategoryOption {
  id: string;
  label: string;
  emoji: string;
}

export const INTEREST_CATEGORY_OPTIONS: InterestCategoryOption[] = [
  { id: "trekking_giornalieri", label: "Trekking giornalieri", emoji: "🥾" },
  { id: "cammini_plurigiornalieri", label: "Cammini plurigiornalieri", emoji: "🎒" },
  { id: "notti_tenda", label: "Notti in tenda", emoji: "⛺" },
  { id: "trekking_notturni", label: "Trekking notturni", emoji: "🌌" },
  { id: "aperitivi_cene", label: "Aperitivi e cene", emoji: "🍷" },
  { id: "sport_movimento", label: "Sport e movimento", emoji: "🏃" },
  { id: "giochi_sfide", label: "Giochi e sfide", emoji: "🎯" },
  { id: "weekend_fuori_porta", label: "Weekend fuori porta", emoji: "🚗" },
  { id: "degustazioni_cantine", label: "Degustazioni e cantine", emoji: "🍇" },
  { id: "mare_spiaggia", label: "Mare e spiaggia", emoji: "🏖️" },
];

const labelById = Object.fromEntries(
  INTEREST_CATEGORY_OPTIONS.map((option) => [option.id, option.label])
) as Record<string, string>;

export const CATEGORY_INTEREST_AFFINITY: Record<string, Record<string, number>> = {
  "Trekking giornalieri": {
    "Trekking giornalieri": 100,
    "Cammini plurigiornalieri": 75,
    "Notti in tenda": 50,
    "Trekking notturni": 75,
    "Aperitivi e cene": 25,
    "Sport e movimento": 50,
    "Giochi e sfide": 0,
    "Weekend fuori porta": 50,
    "Degustazioni e cantine": 25,
    "Mare e spiaggia": 25,
  },
  "Cammini plurigiornalieri": {
    "Trekking giornalieri": 75,
    "Cammini plurigiornalieri": 100,
    "Notti in tenda": 75,
    "Trekking notturni": 50,
    "Aperitivi e cene": 0,
    "Sport e movimento": 25,
    "Giochi e sfide": 0,
    "Weekend fuori porta": 50,
    "Degustazioni e cantine": 0,
    "Mare e spiaggia": 25,
  },
  "Notti in tenda": {
    "Trekking giornalieri": 50,
    "Cammini plurigiornalieri": 75,
    "Notti in tenda": 100,
    "Trekking notturni": 50,
    "Aperitivi e cene": 0,
    "Sport e movimento": 25,
    "Giochi e sfide": 0,
    "Weekend fuori porta": 50,
    "Degustazioni e cantine": 0,
    "Mare e spiaggia": 25,
  },
  "Trekking notturni": {
    "Trekking giornalieri": 75,
    "Cammini plurigiornalieri": 50,
    "Notti in tenda": 50,
    "Trekking notturni": 100,
    "Aperitivi e cene": 25,
    "Sport e movimento": 50,
    "Giochi e sfide": 0,
    "Weekend fuori porta": 50,
    "Degustazioni e cantine": 0,
    "Mare e spiaggia": 25,
  },
  "Aperitivi e cene": {
    "Trekking giornalieri": 25,
    "Cammini plurigiornalieri": 0,
    "Notti in tenda": 0,
    "Trekking notturni": 25,
    "Aperitivi e cene": 100,
    "Sport e movimento": 25,
    "Giochi e sfide": 50,
    "Weekend fuori porta": 50,
    "Degustazioni e cantine": 75,
    "Mare e spiaggia": 50,
  },
  "Sport e movimento": {
    "Trekking giornalieri": 50,
    "Cammini plurigiornalieri": 25,
    "Notti in tenda": 25,
    "Trekking notturni": 50,
    "Aperitivi e cene": 25,
    "Sport e movimento": 100,
    "Giochi e sfide": 25,
    "Weekend fuori porta": 50,
    "Degustazioni e cantine": 25,
    "Mare e spiaggia": 50,
  },
  "Giochi e sfide": {
    "Trekking giornalieri": 0,
    "Cammini plurigiornalieri": 0,
    "Notti in tenda": 0,
    "Trekking notturni": 0,
    "Aperitivi e cene": 50,
    "Sport e movimento": 25,
    "Giochi e sfide": 100,
    "Weekend fuori porta": 25,
    "Degustazioni e cantine": 25,
    "Mare e spiaggia": 25,
  },
  "Weekend fuori porta": {
    "Trekking giornalieri": 50,
    "Cammini plurigiornalieri": 50,
    "Notti in tenda": 50,
    "Trekking notturni": 50,
    "Aperitivi e cene": 50,
    "Sport e movimento": 50,
    "Giochi e sfide": 25,
    "Weekend fuori porta": 100,
    "Degustazioni e cantine": 50,
    "Mare e spiaggia": 75,
  },
  "Degustazioni e cantine": {
    "Trekking giornalieri": 25,
    "Cammini plurigiornalieri": 0,
    "Notti in tenda": 0,
    "Trekking notturni": 0,
    "Aperitivi e cene": 75,
    "Sport e movimento": 25,
    "Giochi e sfide": 25,
    "Weekend fuori porta": 50,
    "Degustazioni e cantine": 100,
    "Mare e spiaggia": 50,
  },
  "Mare e spiaggia": {
    "Trekking giornalieri": 25,
    "Cammini plurigiornalieri": 25,
    "Notti in tenda": 25,
    "Trekking notturni": 25,
    "Aperitivi e cene": 50,
    "Sport e movimento": 50,
    "Giochi e sfide": 25,
    "Weekend fuori porta": 75,
    "Degustazioni e cantine": 50,
    "Mare e spiaggia": 100,
  },
};

export const FIT_SCORE_INTEREST_MIN = 1;
export const FIT_SCORE_INTEREST_MAX = 1;
export const FIT_SCORE_EVENT_SECONDARY_MAX = 2;
export const FIT_SCORE_INTEREST_VALIDATION_MESSAGE =
  "Seleziona 1 attività per continuare";

export const normalizeInterestCategory = (value: string | null | undefined): string | null => {
  if (!value) return null;
  if (CATEGORY_INTEREST_AFFINITY[value]) return value;
  return labelById[value] || null;
};

export const getInterestCategoryLabel = (value: string | null | undefined): string | null =>
  normalizeInterestCategory(value);
