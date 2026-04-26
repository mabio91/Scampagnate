export const EVENT_CLOSING_SENTENCES = [
  "Porta leggerezza, al resto pensiamo noi",
  "Una community che arriva per i sentieri... e resta per le persone",
  "Il difficile è venire. Poi non vorrai più andare via",
  "Fidati: sarà una di quelle giornate che ricordi",
  "Vieni con lo spirito giusto - il resto viene da sé",
  "Qui si conoscono persone, non solo posti",
] as const;

export const normalizeEventClosingSentence = (sentence?: string | null) => {
  if (!sentence) return "";

  return sentence.replace(/^(?:\u2728\s*)+/u, "").trim();
};

export const getRandomEventClosingSentence = () =>
  EVENT_CLOSING_SENTENCES[Math.floor(Math.random() * EVENT_CLOSING_SENTENCES.length)];

export const getDeterministicEventClosingSentence = (seed: string) => {
  const normalizedSeed = seed || "default";
  const hash = Array.from(normalizedSeed).reduce((total, char, index) => {
    return total + char.charCodeAt(0) * (index + 1);
  }, 0);

  return EVENT_CLOSING_SENTENCES[hash % EVENT_CLOSING_SENTENCES.length];
};
