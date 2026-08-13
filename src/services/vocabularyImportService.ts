import vocabulary from '@/src/data/en-vi-3000.json';
import { requireFirebase } from '@/src/services/firebase';
import type { FlashcardInput } from '@/src/types/models';
import { doc, getDoc, serverTimestamp, Timestamp, writeBatch } from 'firebase/firestore';

const SEED_ID = 'en-vi-3000-v1';
const CHUNK_SIZE = 200;
const cards = vocabulary as FlashcardInput[];

export const VOCABULARY_COUNT = cards.length;

export async function importVocabularyDeck(
  uid: string,
  onProgress?: (completed: number, total: number) => void,
) {
  const { db } = requireFirebase();
  const deckId = `${SEED_ID}-${uid}`;
  const deckRef = doc(db, 'decks', deckId);
  const existing = await getDoc(deckRef);
  const completedBefore = Math.min(Number(existing.data()?.cardCount ?? 0), cards.length);

  if (!existing.exists()) {
    const setup = writeBatch(db);
    setup.set(deckRef, {
      ownerId: uid,
      title: '3.000 từ tiếng Anh thông dụng',
      description: 'Bộ từ Anh–Việt được sắp xếp theo tần suất sử dụng.',
      topic: 'Từ vựng thông dụng',
      sourceLanguage: 'Tiếng Anh',
      targetLanguage: 'Tiếng Việt',
      color: '#6558D3',
      isPublic: false,
      cardCount: 0,
      copiedFromDeckId: null,
      seedId: SEED_ID,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    setup.set(doc(db, 'users', uid, 'deckStates', deckId), {
      initializedCardCount: 0,
      reviewedCardCount: 0,
      masteredCount: 0,
      updatedAt: serverTimestamp(),
    });
    await setup.commit();
  }

  for (let start = completedBefore; start < cards.length; start += CHUNK_SIZE) {
    const chunk = cards.slice(start, start + CHUNK_SIZE);
    const batch = writeBatch(db);
    const now = Timestamp.now();
    chunk.forEach((card, index) => {
      const cardId = `${SEED_ID}-${String(start + index + 1).padStart(4, '0')}`;
      batch.set(doc(db, 'decks', deckId, 'cards', cardId), {
        ...card,
        termNormalized: card.term.trim().toLocaleLowerCase('en-US'),
        createdAt: now,
        updatedAt: now,
      });
      batch.set(doc(db, 'users', uid, 'cardProgress', cardId), {
        cardId, deckId, repetitions: 0, consecutiveCorrect: 0, intervalMinutes: 0,
        lastRating: null, lastReviewedAt: null, nextReviewAt: now, mastered: false, updatedAt: now,
      });
    });
    batch.set(deckRef, { cardCount: start + chunk.length, updatedAt: serverTimestamp() }, { merge: true });
    batch.set(doc(db, 'users', uid, 'deckStates', deckId), {
      initializedCardCount: start + chunk.length,
      updatedAt: serverTimestamp(),
    }, { merge: true });
    await batch.commit();
    onProgress?.(start + chunk.length, cards.length);
  }

  return { deckId, imported: cards.length - completedBefore, total: cards.length, alreadyComplete: completedBefore === cards.length };
}
