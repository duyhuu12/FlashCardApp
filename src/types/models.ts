import type { Timestamp } from 'firebase/firestore';

export type FirestoreDate = Timestamp | Date | null;

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  reminderEnabled: boolean;
  reminderHour: number;
  reminderMinute: number;
  notificationId?: string | null;
  createdAt?: FirestoreDate;
}

export interface Deck {
  id: string;
  ownerId: string;
  title: string;
  description: string;
  topic: string;
  sourceLanguage: string;
  targetLanguage: string;
  color: string;
  isPublic: boolean;
  cardCount: number;
  copiedFromDeckId?: string | null;
  seedId?: string | null;
  pathId?: string | null;
  pathTitle?: string | null;
  pathOrder?: number | null;
  categoryId?: string | null;
  categoryTitle?: string | null;
  categoryOrder?: number | null;
  topicId?: string | null;
  topicOrder?: number | null;
  createdAt?: FirestoreDate;
  updatedAt?: FirestoreDate;
}

export type DeckInput = Pick<
  Deck,
  'title' | 'description' | 'topic' | 'sourceLanguage' | 'targetLanguage' | 'color' | 'isPublic'
>;

export interface Flashcard {
  id: string;
  deckId: string;
  term: string;
  termNormalized?: string;
  meaning: string;
  example: string;
  pronunciation: string;
  imageUrl: string;
  partOfSpeech?: string;
  sourceOrder?: number;
  createdAt?: FirestoreDate;
  updatedAt?: FirestoreDate;
}

export type FlashcardInput = Pick<Flashcard, 'term' | 'meaning' | 'example' | 'pronunciation' | 'imageUrl'>;

export type ReviewRating = 'again' | 'hard' | 'easy';
export type StudyMode = 'daily' | 'due' | 'new' | 'hard' | 'mistakes' | 'all';

export interface CardProgress {
  cardId: string;
  deckId: string;
  repetitions: number;
  consecutiveCorrect: number;
  intervalMinutes: number;
  lastRating: ReviewRating | null;
  lastReviewedAt: FirestoreDate;
  nextReviewAt: FirestoreDate;
  mastered: boolean;
  againCount?: number;
  hardCount?: number;
  easyCount?: number;
  favorite?: boolean;
  updatedAt?: FirestoreDate;
}

export interface ReviewSummary {
  total: number;
  again: number;
  hard: number;
  easy: number;
}

export interface LearningStats {
  totalDecks: number;
  totalCards: number;
  mastered: number;
  due: number;
  learning: number;
  reviewedLast7Days: number;
  reviewedToday?: number;
  newAvailable?: number;
  hardCount?: number;
  streak?: number;
  xp?: number;
  dailyGoal?: number;
}

export interface DeckState {
  initializedCardCount: number;
  reviewedCardCount: number;
  masteredCount: number;
  lastStudiedCardId?: string | null;
  lastStudiedAt?: FirestoreDate;
}

export interface StudyQueue {
  cards: Flashcard[];
  progress: Record<string, CardProgress>;
  counts: { new: number; due: number; hard: number; mistakes: number };
}

export interface LeaderboardEntry {
  uid: string;
  displayName: string;
  xp: number;
  reviewedCount: number;
}
