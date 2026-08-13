import * as Speech from 'expo-speech';

export async function speakEnglish(text: string, rate = 0.82) {
  const normalized = text.trim();
  if (!normalized) return;

  await Speech.stop();
  Speech.speak(normalized, {
    language: 'en-US',
    rate,
    pitch: 1,
    volume: 1,
  });
}

export function stopSpeaking() {
  return Speech.stop();
}
