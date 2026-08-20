import { requireFirebase } from '@/src/services/firebase';
import type { CardProgress, Deck, DeckInput, DeckState, Flashcard, FlashcardInput, LeaderboardEntry, LearningStats, ReviewRating, StudyMode, StudyQueue } from '@/src/types/models';
import { calculateNextReview } from '@/src/algorithms/spacedRepetition';
import { BUILT_IN_PATH_ID, getBuiltInCard, getBuiltInDeck, isBuiltInDeckId, listBuiltInCards, listBuiltInDecks } from '@/src/services/builtInVocabularyService';
import {
  collection,
  doc,
  documentId,
  getDoc,
  getDocFromCache,
  getCountFromServer,
  getDocs,
  getDocsFromCache,
  increment,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  startAfter,
  updateDoc,
  where,
  writeBatch,
  Timestamp,
  type DocumentData,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';

export type CardPageCursor = QueryDocumentSnapshot<DocumentData> | { kind: 'built-in'; offset: number };

export interface CardPage {
  cards: Flashcard[];
  cursor: CardPageCursor | null;
  hasMore: boolean;
}

const CARD_PAGE_SIZE = 40;
const REVIEW_SESSION_SIZE = 30;
const WRITE_CHUNK_SIZE = 200;
const PROGRESS_MEMORY_TTL = 2 * 60 * 1000;

interface ProgressMemoryEntry {
  items: CardProgress[];
  indexByCardId: Map<string, number>;
  fetchedAt: number;
}

const progressMemoryCache = new Map<string, ProgressMemoryEntry>();
const authorNameCache = new Map<string, string>();
const ownedDeckRequests = new Map<string, Promise<Deck[]>>();

function cacheProgress(uid: string, items: CardProgress[], fetchedAt = Date.now()) {
  progressMemoryCache.set(uid, {
    items,
    indexByCardId: new Map(items.map((item, index) => [item.cardId, index])),
    fetchedAt,
  });
}

function updateCachedProgress(uid: string, progress: CardProgress) {
  const cached = progressMemoryCache.get(uid);
  if (!cached) return;
  const index = cached.indexByCardId.get(progress.cardId);
  if (index === undefined) {
    cached.indexByCardId.set(progress.cardId, cached.items.length);
    cached.items.push(progress);
  } else {
    cached.items[index] = progress;
  }
  cached.fetchedAt = Date.now();
}

function withId<T>(snapshot: { id: string; data(): unknown }) {
  return { id: snapshot.id, ...(snapshot.data() as object) } as T;
}

function initialProgress(cardId: string, deckId: string, now = Timestamp.now()): CardProgress {
  return {
    cardId,
    deckId,
    repetitions: 0,
    consecutiveCorrect: 0,
    intervalMinutes: 0,
    lastRating: null,
    lastReviewedAt: null,
    nextReviewAt: now,
    mastered: false,
    againCount: 0,
    hardCount: 0,
    easyCount: 0,
    favorite: false,
    updatedAt: now,
  };
}

export async function listOwnedDecks(uid: string) {
  const pending = ownedDeckRequests.get(uid);
  if (pending) return pending;

  const request = (async () => {
    const { db } = requireFirebase();
    const snapshot = await getDocs(query(collection(db, 'decks'), where('ownerId', '==', uid)));
    const personal = snapshot.docs.map((item) => withId<Deck>(item)).filter((deck) => deck.pathId !== BUILT_IN_PATH_ID);
    return [...listBuiltInDecks(uid), ...personal];
  })();
  ownedDeckRequests.set(uid, request);
  try {
    return await request;
  } finally {
    if (ownedDeckRequests.get(uid) === request) ownedDeckRequests.delete(uid);
  }
}

export async function listOwnedDecksFromCache(uid: string) {
  const { db } = requireFirebase();
  try {
    const snapshot = await getDocsFromCache(query(collection(db, 'decks'), where('ownerId', '==', uid)));
    const personal = snapshot.docs.map((item) => withId<Deck>(item)).filter((deck) => deck.pathId !== BUILT_IN_PATH_ID);
    return [...listBuiltInDecks(uid), ...personal];
  } catch { return listBuiltInDecks(uid); }
}

export async function listPublicDecks(uid: string) {
  const { db } = requireFirebase();
  const snapshot = await getDocs(query(collection(db, 'decks'), where('isPublic', '==', true), limit(30)));
  const decks = snapshot.docs.map((item) => withId<Deck>(item)).filter((deck) => deck.ownerId !== uid);
  const missingOwnerIds = [...new Set(decks.map((deck) => deck.ownerId))]
    .filter((ownerId) => !authorNameCache.has(ownerId));
  for (let index = 0; index < missingOwnerIds.length; index += 10) {
    const ownerIds = missingOwnerIds.slice(index, index + 10);
    const authors = await getDocs(query(
      collection(db, 'leaderboard'),
      where(documentId(), 'in', ownerIds),
    ));
    authors.docs.forEach((item) => {
      authorNameCache.set(item.id, String(item.data().displayName || 'Người học'));
    });
    ownerIds.forEach((ownerId) => {
      if (!authorNameCache.has(ownerId)) authorNameCache.set(ownerId, 'Người học');
    });
  }
  return decks.map((deck) => ({
    ...deck,
    authorName: authorNameCache.get(deck.ownerId) ?? 'Người học',
  }));
}

export async function getDeck(deckId: string) {
  const builtIn = getBuiltInDeck(deckId); if (builtIn) return builtIn;
  const { db } = requireFirebase();
  const snapshot = await getDoc(doc(db, 'decks', deckId));
  if (!snapshot.exists()) return null;
  const deck = withId<Deck>(snapshot);
  if (!deck.isPublic) return deck;
  if (!authorNameCache.has(deck.ownerId)) {
    const author = await getDoc(doc(db, 'leaderboard', deck.ownerId));
    authorNameCache.set(deck.ownerId, String(author.data()?.displayName || 'Người học'));
  }
  return { ...deck, authorName: authorNameCache.get(deck.ownerId) };
}

export async function getDeckFromCache(deckId: string) {
  const builtIn = getBuiltInDeck(deckId); if (builtIn) return builtIn;
  const { db } = requireFirebase();
  try {
    const snapshot = await getDocFromCache(doc(db, 'decks', deckId));
    if (!snapshot.exists()) return null;
    const deck = withId<Deck>(snapshot);
    return deck.isPublic && authorNameCache.has(deck.ownerId)
      ? { ...deck, authorName: authorNameCache.get(deck.ownerId) }
      : deck;
  } catch {
    return null;
  }
}

export async function createDeck(uid: string, input: DeckInput) {
  const { db } = requireFirebase();
  const ref = doc(collection(db, 'decks'));
  await setDoc(ref, {
    ...input,
    ownerId: uid,
    cardCount: 0,
    copiedFromDeckId: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateDeck(deckId: string, input: DeckInput) {
  const { db } = requireFirebase();
  await updateDoc(doc(db, 'decks', deckId), { ...input, updatedAt: serverTimestamp() });
}

export async function removeDeck(uid: string, deckId: string) {
  if (isBuiltInDeckId(deckId)) throw new Error('Không thể xóa bài học hệ thống.');
  const { db } = requireFirebase();
  const [cards, progress] = await Promise.all([
    getDocs(collection(db, 'decks', deckId, 'cards')),
    getDocs(query(collection(db, 'users', uid, 'cardProgress'), where('deckId', '==', deckId))),
  ]);
  const references = [...cards.docs.map((item) => item.ref), ...progress.docs.map((item) => item.ref)];
  for (let index = 0; index < references.length; index += 450) {
    const batch = writeBatch(db);
    references.slice(index, index + 450).forEach((reference) => batch.delete(reference));
    await batch.commit();
  }
  const finalBatch = writeBatch(db);
  finalBatch.delete(doc(db, 'users', uid, 'deckStates', deckId));
  finalBatch.delete(doc(db, 'decks', deckId));
  await finalBatch.commit();
}

export async function listCards(deckId: string) {
  const builtIn = listBuiltInCards(deckId); if (builtIn) return builtIn;
  const { db } = requireFirebase();
  const snapshot = await getDocs(query(collection(db, 'decks', deckId, 'cards'), orderBy('createdAt', 'asc')));
  return snapshot.docs.map((item) => ({ ...withId<Flashcard>(item), deckId }));
}

export async function listCardsPage(
  deckId: string,
  cursor?: CardPageCursor | null,
  pageSize = CARD_PAGE_SIZE,
): Promise<CardPage> {
  const builtIn = listBuiltInCards(deckId);
  if (builtIn) {
    const offset = cursor && 'kind' in cursor ? cursor.offset : 0;
    const cards = builtIn.slice(offset, offset + pageSize); const next = offset + cards.length;
    return { cards, cursor: next < builtIn.length ? { kind: 'built-in', offset: next } : null, hasMore: next < builtIn.length };
  }
  const { db } = requireFirebase();
  const base = collection(db, 'decks', deckId, 'cards');
  const firestoreCursor = cursor && !('kind' in cursor) ? cursor : null;
  const cardsQuery = firestoreCursor
    ? query(base, orderBy('createdAt', 'asc'), startAfter(firestoreCursor), limit(pageSize))
    : query(base, orderBy('createdAt', 'asc'), limit(pageSize));
  const snapshot = await getDocs(cardsQuery);
  return {
    cards: snapshot.docs.map((item) => ({ ...withId<Flashcard>(item), deckId })),
    cursor: snapshot.docs[snapshot.docs.length - 1] ?? null,
    hasMore: snapshot.size === pageSize,
  };
}

export async function listFirstCardsPageFromCache(deckId: string, pageSize = CARD_PAGE_SIZE) {
  const builtIn = listBuiltInCards(deckId); if (builtIn) return builtIn.slice(0, pageSize);
  const { db } = requireFirebase();
  const cardsQuery = query(
    collection(db, 'decks', deckId, 'cards'),
    orderBy('createdAt', 'asc'),
    limit(pageSize),
  );
  const snapshot = await getDocsFromCache(cardsQuery);
  return snapshot.docs.map((item) => ({ ...withId<Flashcard>(item), deckId }));
}

export async function listCardsFromCache(deckId: string) {
  const builtIn = listBuiltInCards(deckId); if (builtIn) return builtIn;
  const { db } = requireFirebase();
  const cardsQuery = query(collection(db, 'decks', deckId, 'cards'), orderBy('createdAt', 'asc'));
  const snapshot = await getDocsFromCache(cardsQuery);
  return snapshot.docs.map((item) => ({ ...withId<Flashcard>(item), deckId }));
}

export async function hasDuplicateCard(deckId: string, term: string, excludedCardId?: string) {
  const { db } = requireFirebase();
  const normalized = term.trim().toLocaleLowerCase();
  const snapshot = await getDocs(query(
    collection(db, 'decks', deckId, 'cards'),
    where('termNormalized', '==', normalized),
    limit(2),
  ));
  return snapshot.docs.some((item) => item.id !== excludedCardId);
}

export async function getCard(deckId: string, cardId: string) {
  const builtIn = getBuiltInCard(deckId, cardId); if (builtIn) return builtIn;
  const { db } = requireFirebase();
  const snapshot = await getDoc(doc(db, 'decks', deckId, 'cards', cardId));
  return snapshot.exists() ? ({ ...withId<Flashcard>(snapshot), deckId } as Flashcard) : null;
}

export async function createCard(uid: string, deckId: string, input: FlashcardInput) {
  const { db } = requireFirebase();
  const deckRef = doc(db, 'decks', deckId);
  const cardRef = doc(collection(db, 'decks', deckId, 'cards'));
  const batch = writeBatch(db);
  batch.set(cardRef, {
    ...input,
    termNormalized: input.term.trim().toLocaleLowerCase(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  batch.set(doc(db, 'users', uid, 'cardProgress', cardRef.id), initialProgress(cardRef.id, deckId));
  batch.set(doc(db, 'users', uid, 'deckStates', deckId), {
    initializedCardCount: increment(1),
    updatedAt: serverTimestamp(),
  }, { merge: true });
  batch.update(deckRef, {
    cardCount: increment(1),
    updatedAt: serverTimestamp(),
  });
  await batch.commit();
}

export async function updateCard(deckId: string, cardId: string, input: FlashcardInput) {
  const { db } = requireFirebase();
  await updateDoc(doc(db, 'decks', deckId, 'cards', cardId), {
    ...input,
    termNormalized: input.term.trim().toLocaleLowerCase(),
    updatedAt: serverTimestamp(),
  });
}

export async function removeCard(uid: string, deckId: string, cardId: string) {
  const { db } = requireFirebase();
  const deckRef = doc(db, 'decks', deckId);
  const progressRef = doc(db, 'users', uid, 'cardProgress', cardId);
  const progressSnapshot = await getDoc(progressRef);
  const progress = progressSnapshot.data() as CardProgress | undefined;
  const batch = writeBatch(db);
  batch.delete(doc(db, 'decks', deckId, 'cards', cardId));
  batch.delete(progressRef);
  batch.set(doc(db, 'users', uid, 'deckStates', deckId), {
    initializedCardCount: increment(-1),
    reviewedCardCount: increment(progress?.lastReviewedAt ? -1 : 0),
    masteredCount: increment(progress?.mastered ? -1 : 0),
    updatedAt: serverTimestamp(),
  }, { merge: true });
  batch.update(deckRef, {
    cardCount: increment(-1),
    updatedAt: serverTimestamp(),
  });
  await batch.commit();
}

export async function listProgress(uid: string, deckId?: string) {
  const memory = progressMemoryCache.get(uid);
  if (!deckId && memory && Date.now() - memory.fetchedAt < PROGRESS_MEMORY_TTL) {
    return memory.items;
  }
  const { db } = requireFirebase();
  const base = collection(db, 'users', uid, 'cardProgress');
  const snapshot = await getDocs(deckId ? query(base, where('deckId', '==', deckId)) : base);
  const items = snapshot.docs.map((item) => item.data() as CardProgress);
  if (!deckId) cacheProgress(uid, items);
  return items;
}

export async function listDeckStates(uid: string) {
  const { db } = requireFirebase();
  const snapshot = await getDocs(collection(db, 'users', uid, 'deckStates'));
  return Object.fromEntries(snapshot.docs.map((item) => {
    const data = item.data();
    return [item.id, {
      initializedCardCount: Number(data.initializedCardCount ?? 0),
      reviewedCardCount: Number(data.reviewedCardCount ?? 0),
      masteredCount: Number(data.masteredCount ?? 0),
      goldCompletedAt: data.goldCompletedAt ?? null,
      lastStudiedCardId: data.lastStudiedCardId ?? null,
      lastStudiedAt: data.lastStudiedAt ?? null,
    } satisfies DeckState];
  })) as Record<string, DeckState>;
}

export async function markDeckGold(uid: string, deckId: string) {
  const { db } = requireFirebase();
  await setDoc(doc(db, 'users', uid, 'deckStates', deckId), {
    goldCompletedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

export async function ensureDeckProgress(
  uid: string,
  deckId: string,
  expectedCardCount: number,
  onProgress?: (completed: number, total: number) => void,
) {
  if (isBuiltInDeckId(deckId)) { onProgress?.(expectedCardCount, expectedCardCount); return; }
  const { db } = requireFirebase();
  const stateRef = doc(db, 'users', uid, 'deckStates', deckId);
  const stateSnapshot = await getDoc(stateRef);
  if (stateSnapshot.data()?.initializedCardCount === expectedCardCount) return;

  const [cards, existingProgress] = await Promise.all([listCards(deckId), listProgress(uid, deckId)]);
  const existingIds = new Set(existingProgress.map((item) => item.cardId));
  const missingCards = cards.filter((card) => !existingIds.has(card.id));
  let completed = 0;

  for (let index = 0; index < missingCards.length; index += 450) {
    const chunk = missingCards.slice(index, index + 450);
    const batch = writeBatch(db);
    chunk.forEach((card) => {
      batch.set(doc(db, 'users', uid, 'cardProgress', card.id), initialProgress(card.id, deckId));
    });
    await batch.commit();
    completed += chunk.length;
    onProgress?.(completed, missingCards.length);
  }

  await setDoc(stateRef, {
    initializedCardCount: cards.length,
    reviewedCardCount: existingProgress.filter((item) => item.lastReviewedAt).length,
    masteredCount: existingProgress.filter((item) => item.mastered).length,
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

export async function getDueReviewQueue(uid: string, deckId: string, pageSize = REVIEW_SESSION_SIZE) {
  const { db } = requireFirebase();
  const dueQuery = query(
    collection(db, 'users', uid, 'cardProgress'),
    where('deckId', '==', deckId),
    where('nextReviewAt', '<=', Timestamp.now()),
    orderBy('nextReviewAt', 'asc'),
    limit(pageSize),
  );
  const snapshot = await getDocs(dueQuery);
  const progress = snapshot.docs.map((item) => item.data() as CardProgress);
  const cards = (await Promise.all(progress.map((item) => getCard(deckId, item.cardId))))
    .filter((card): card is Flashcard => Boolean(card));
  return {
    cards,
    progress: Object.fromEntries(progress.map((item) => [item.cardId, item])) as Record<string, CardProgress>,
  };
}

export async function listProgressFromCache(uid: string, deckId?: string) {
  const memory = progressMemoryCache.get(uid);
  if (!deckId && memory) return memory.items;
  const { db } = requireFirebase();
  const base = collection(db, 'users', uid, 'cardProgress');
  try {
    const snapshot = await getDocsFromCache(deckId ? query(base, where('deckId', '==', deckId)) : base);
    const items = snapshot.docs.map((item) => item.data() as CardProgress);
    if (!deckId && items.length > 0) cacheProgress(uid, items, 0);
    return items;
  } catch {
    return [];
  }
}

export async function getCardProgress(uid: string, cardId: string) {
  const { db } = requireFirebase();
  const snapshot = await getDoc(doc(db, 'users', uid, 'cardProgress', cardId));
  return snapshot.exists() ? snapshot.data() as CardProgress : null;
}

export async function setCardFavorite(uid: string, deckId: string, cardId: string, favorite: boolean) {
  const { db } = requireFirebase();
  const progressRef = doc(db, 'users', uid, 'cardProgress', cardId);
  const snapshot = await getDoc(progressRef);
  const current = snapshot.exists()
    ? snapshot.data() as CardProgress
    : initialProgress(cardId, deckId);
  await setDoc(progressRef, {
    ...current,
    cardId,
    deckId,
    favorite,
    updatedAt: serverTimestamp(),
  }, { merge: true });
  updateCachedProgress(uid, { ...current, cardId, deckId, favorite, updatedAt: new Date() });
}

function asMillis(value: CardProgress['nextReviewAt']) {
  if (!value) return Number.POSITIVE_INFINITY;
  return value instanceof Date ? value.getTime() : value.toMillis();
}

export async function getStudyQueue(
  uid: string,
  deckId: string,
  mode: StudyMode = 'daily',
  pageSize = REVIEW_SESSION_SIZE,
): Promise<StudyQueue> {
  const [cards, progressItems] = await Promise.all([listCards(deckId), listProgress(uid, deckId)]);
  const progressById = Object.fromEntries(progressItems.map((item) => [item.cardId, item])) as Record<string, CardProgress>;
  const now = Date.now();
  const unseen = cards.filter((card) => !progressById[card.id]?.lastReviewedAt);
  const reviewed = cards.filter((card) => Boolean(progressById[card.id]?.lastReviewedAt));
  const due = reviewed
    .filter((card) => asMillis(progressById[card.id]?.nextReviewAt) <= now)
    .sort((left, right) => asMillis(progressById[left.id]?.nextReviewAt) - asMillis(progressById[right.id]?.nextReviewAt));
  const hard = reviewed.filter((card) => progressById[card.id]?.lastRating === 'hard');
  const mistakes = reviewed.filter((card) => progressById[card.id]?.lastRating === 'again');

  let selected: Flashcard[];
  if (mode === 'new') selected = unseen.slice(0, pageSize);
  else if (mode === 'due') selected = due.slice(0, pageSize);
  else if (mode === 'hard') selected = hard.slice(0, pageSize);
  else if (mode === 'mistakes') selected = mistakes.slice(0, pageSize);
  else if (mode === 'all') selected = cards.slice(0, pageSize);
  else {
    const picked = new Set<string>();
    selected = [];
    const append = (items: Flashcard[], count: number) => items.forEach((card) => {
      if (selected.length < pageSize && count > 0 && !picked.has(card.id)) {
        picked.add(card.id); selected.push(card); count -= 1;
      }
    });
    append(mistakes, 5);
    append(hard, 5);
    append(due, 15);
    append(unseen, pageSize - selected.length);
    if (selected.length < pageSize) append(reviewed, pageSize - selected.length);
  }

  return {
    cards: selected,
    progress: Object.fromEntries(selected.map((card) => [card.id, progressById[card.id] ?? initialProgress(card.id, deckId)])),
    counts: { new: unseen.length, due: due.length, hard: hard.length, mistakes: mistakes.length },
  };
}

export async function saveReview(
  uid: string,
  deckId: string,
  cardId: string,
  rating: ReviewRating,
  current?: CardProgress,
) {
  const { db } = requireFirebase();
  const now = new Date();
  const schedule = calculateNextReview(current, rating, now);
  const progress: CardProgress = {
    cardId,
    deckId,
    repetitions: schedule.repetitions,
    consecutiveCorrect: schedule.consecutiveCorrect,
    intervalMinutes: schedule.intervalMinutes,
    lastRating: rating,
    lastReviewedAt: Timestamp.fromDate(now),
    nextReviewAt: Timestamp.fromDate(schedule.nextReviewAt),
    mastered: schedule.mastered,
    againCount: (current?.againCount ?? 0) + Number(rating === 'again'),
    hardCount: (current?.hardCount ?? 0) + Number(rating === 'hard'),
    easyCount: (current?.easyCount ?? 0) + Number(rating === 'easy'),
    favorite: current?.favorite ?? false,
    updatedAt: Timestamp.fromDate(now),
  };
  const logRef = doc(collection(db, 'users', uid, 'reviewLogs'));
  const dayKey = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(now);
  const xpEarned = rating === 'easy' ? 10 : rating === 'hard' ? 5 : 2;
  const batch = writeBatch(db);
  batch.set(doc(db, 'users', uid, 'cardProgress', cardId), progress);
  const masteredDelta = Number(progress.mastered) - Number(current?.mastered ?? false);
  const reviewedDelta = current?.lastReviewedAt ? 0 : 1;
  batch.set(doc(db, 'users', uid, 'deckStates', deckId), {
    reviewedCardCount: increment(reviewedDelta),
    masteredCount: increment(masteredDelta),
    lastStudiedCardId: cardId,
    lastStudiedAt: Timestamp.fromDate(now),
    updatedAt: serverTimestamp(),
  }, { merge: true });
  batch.set(logRef, {
    deckId,
    cardId,
    rating,
    reviewedAt: Timestamp.fromDate(now),
    previousInterval: current?.intervalMinutes ?? 0,
    newInterval: schedule.intervalMinutes,
  });
  batch.set(doc(db, 'users', uid, 'studySessions', dayKey), {
    dayKey,
    reviewedCount: increment(1),
    xp: increment(xpEarned),
    again: increment(Number(rating === 'again')),
    hard: increment(Number(rating === 'hard')),
    easy: increment(Number(rating === 'easy')),
    updatedAt: Timestamp.fromDate(now),
  }, { merge: true });
  await batch.commit();
  updateCachedProgress(uid, progress);
  setDoc(doc(db, 'leaderboard', uid), {
    uid,
    xp: increment(xpEarned),
    reviewedCount: increment(1),
    updatedAt: Timestamp.fromDate(now),
  }, { merge: true }).catch(() => undefined);
  return progress;
}

export async function getLearningStats(uid: string, ownedDecks?: Deck[]): Promise<LearningStats> {
  const { db } = requireFirebase();
  const sevenDaysAgo = Timestamp.fromMillis(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const progressCollection = collection(db, 'users', uid, 'cardProgress');
  const logCollection = collection(db, 'users', uid, 'reviewLogs');
  const [decks, reviewedProgress, logs, sessions] = await Promise.all([
    ownedDecks ?? listOwnedDecks(uid),
    getDocs(query(progressCollection, where('lastReviewedAt', '!=', null))),
    getCountFromServer(query(logCollection, where('reviewedAt', '>=', sevenDaysAgo))),
    getDocs(collection(db, 'users', uid, 'studySessions')),
  ]);
  const totalCards = decks.reduce((sum, deck) => sum + deck.cardCount, 0);
  const progress = reviewedProgress.docs.map((item) => item.data() as CardProgress);
  const progressCount = progress.length;
  const masteredCount = progress.filter((item) => item.mastered).length;
  const now = Date.now();
  const dueCount = progress.filter((item) => asMillis(item.nextReviewAt) <= now).length;
  const sessionRows = sessions.docs.map((item) => item.data() as { dayKey: string; reviewedCount?: number; xp?: number });
  const todayKey = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
  const today = sessionRows.find((item) => item.dayKey === todayKey);
  const activeDays = new Set(sessionRows.filter((item) => Number(item.reviewedCount ?? 0) > 0).map((item) => item.dayKey));
  let streak = 0;
  const cursor = new Date();
  if (!activeDays.has(todayKey)) cursor.setDate(cursor.getDate() - 1);
  while (activeDays.has(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(cursor))) {
    streak += 1; cursor.setDate(cursor.getDate() - 1);
  }
  return {
    totalDecks: decks.length,
    totalCards,
    mastered: masteredCount,
    due: dueCount,
    learning: Math.max(0, progressCount - masteredCount),
    reviewedLast7Days: logs.data().count,
    reviewedToday: Number(today?.reviewedCount ?? 0),
    newAvailable: Math.max(0, totalCards - progressCount),
    hardCount: progress.filter((item) => item.lastRating === 'hard' || item.lastRating === 'again').length,
    streak,
    xp: sessionRows.reduce((sum, item) => sum + Number(item.xp ?? 0), 0),
    dailyGoal: 30,
  };
}

export async function listLeaderboard(): Promise<LeaderboardEntry[]> {
  const { db } = requireFirebase();
  const snapshot = await getDocs(query(collection(db, 'leaderboard'), orderBy('xp', 'desc'), limit(20)));
  return snapshot.docs.map((item) => {
    const data = item.data();
    return { uid: item.id, displayName: String(data.displayName || 'Người học'), avatarId: String(data.avatarId || 'avt1'), xp: Number(data.xp ?? 0), reviewedCount: Number(data.reviewedCount ?? 0) };
  });
}

export async function cloneDeck(uid: string, source: Deck, onProgress?: (completed: number, total: number) => void) {
  const cards = await listCards(source.id);
  const newId = await createDeck(uid, {
    title: `${source.title} (bản sao)`,
    description: source.description,
    topic: source.topic,
    sourceLanguage: source.sourceLanguage,
    targetLanguage: source.targetLanguage,
    color: source.color,
    isPublic: false,
  });
  const { db } = requireFirebase();
  let completed = 0;
  for (let index = 0; index < cards.length; index += WRITE_CHUNK_SIZE) {
    const chunk = cards.slice(index, index + WRITE_CHUNK_SIZE);
    const batch = writeBatch(db);
    chunk.forEach((card) => {
      const ref = doc(collection(db, 'decks', newId, 'cards'));
      batch.set(ref, {
        term: card.term,
        termNormalized: card.term.trim().toLocaleLowerCase(),
        meaning: card.meaning,
        example: card.example,
        pronunciation: card.pronunciation,
        imageUrl: card.imageUrl,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      batch.set(doc(db, 'users', uid, 'cardProgress', ref.id), initialProgress(ref.id, newId));
    });
    await batch.commit();
    completed += chunk.length;
    onProgress?.(completed, cards.length);
  }
  const finalBatch = writeBatch(db);
  finalBatch.update(doc(db, 'decks', newId), { cardCount: cards.length, copiedFromDeckId: source.id });
  finalBatch.set(doc(db, 'users', uid, 'deckStates', newId), {
    initializedCardCount: cards.length,
    reviewedCardCount: 0,
    masteredCount: 0,
    updatedAt: serverTimestamp(),
  });
  await finalBatch.commit();
  return newId;
}
