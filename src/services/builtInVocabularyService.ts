import topicDataset from '@/src/data/en-vi-word-topics.json';
import type { Deck, Flashcard } from '@/src/types/models';

interface TopicCard {
  term: string; meaning: string; pronunciation: string; example: string;
  imageUrl: string; partOfSpeech: string; sourceOrder: number;
}
interface TopicLesson { id: string; order: number; title: string; titleEnglish: string; cards: TopicCard[] }
interface TopicCategory { id: string; order: number; title: string; topics: TopicLesson[] }
interface TopicDataset { id: string; title: string; categoryCount: number; topicCount: number; wordCount: number; categories: TopicCategory[] }

const dataset = topicDataset as TopicDataset;
const topics = dataset.categories.flatMap((category) => category.topics.map((topic) => ({ category, topic })));
const deckCache = new Map<string, Deck[]>();
const categoryCache = new Map<string, BuiltInVocabularyCategory[]>();
const vocabularyCache = new Map<string, IndexedVocabularySearchResult[]>();
const cardCache = new Map<string, Flashcard[]>();

export const BUILT_IN_PATH_ID = dataset.id;
export const BUILT_IN_WORD_COUNT = dataset.wordCount;
export const BUILT_IN_TOPIC_COUNT = dataset.topicCount;
export const BUILT_IN_CATEGORY_COUNT = dataset.categoryCount;

export interface BuiltInVocabularySearchResult {
  card: Flashcard;
  deck: Deck;
  categoryTitle: string;
  topicTitle: string;
}

interface IndexedVocabularySearchResult extends BuiltInVocabularySearchResult {
  normalizedTerm: string;
  searchText: string;
}

export interface BuiltInVocabularyCategory {
  id: string;
  order: number;
  title: string;
  wordCount: number;
  topics: Deck[];
}

export function builtInDeckId(uid: string, topicOrder: number) {
  return `${dataset.id}-${uid}-topic-${String(topicOrder).padStart(2, '0')}`;
}

function builtInCardId(topicOrder: number, cardOrder: number) {
  return `${dataset.id}-t${String(topicOrder).padStart(2, '0')}-c${String(cardOrder).padStart(3, '0')}`;
}

function topicOrderFromDeckId(deckId: string) {
  if (!deckId.startsWith(`${dataset.id}-`)) return null;
  const match = deckId.match(/-topic-(\d+)$/);
  return match ? Number(match[1]) : null;
}

export function isBuiltInDeckId(deckId: string) { return topicOrderFromDeckId(deckId) !== null; }

export function listBuiltInDecks(uid: string): Deck[] {
  const cached = deckCache.get(uid);
  if (cached) return cached;
  const decks = topics.map(({ category, topic }) => ({
    id: builtInDeckId(uid, topic.order), ownerId: uid,
    title: topic.titleEnglish ? `${topic.title} (${topic.titleEnglish})` : topic.title,
    description: `Bài ${topic.order}/${dataset.topicCount} · Nhóm ${category.title}`,
    topic: topic.title, sourceLanguage: 'Tiếng Anh', targetLanguage: 'Tiếng Việt',
    color: '#087A9B', isPublic: false, cardCount: Math.min(30, topic.cards.length),
    copiedFromDeckId: null, seedId: dataset.id, pathId: dataset.id, pathTitle: dataset.title,
    pathOrder: topic.order, categoryId: category.id, categoryTitle: category.title,
    categoryOrder: category.order, topicId: topic.id, topicOrder: topic.order,
    createdAt: null, updatedAt: null,
  }));
  deckCache.set(uid, decks);
  return decks;
}

export function listBuiltInCategories(uid: string): BuiltInVocabularyCategory[] {
  const cached = categoryCache.get(uid);
  if (cached) return cached;
  const decksByCategory = new Map<string, Deck[]>();
  listBuiltInDecks(uid).forEach((deck) => {
    if (!deck.categoryId) return;
    const categoryDecks = decksByCategory.get(deck.categoryId) ?? [];
    categoryDecks.push(deck);
    decksByCategory.set(deck.categoryId, categoryDecks);
  });

  const categories = dataset.categories.map((category) => {
    const categoryTopics = decksByCategory.get(category.id) ?? [];
    return {
      id: category.id,
      order: category.order,
      title: category.title,
      wordCount: categoryTopics.reduce((total, topic) => total + topic.cardCount, 0),
      topics: categoryTopics,
    };
  });
  categoryCache.set(uid, categories);
  return categories;
}

export function getBuiltInDeck(deckId: string): Deck | null {
  const order = topicOrderFromDeckId(deckId); if (order === null) return null;
  const uid = deckId.slice(dataset.id.length + 1, deckId.lastIndexOf('-topic-'));
  return listBuiltInDecks(uid).find((deck) => deck.pathOrder === order) ?? null;
}

export function listBuiltInCards(deckId: string): Flashcard[] | null {
  const order = topicOrderFromDeckId(deckId); if (order === null) return null;
  const cached = cardCache.get(deckId);
  if (cached) return cached;
  const entry = topics.find(({ topic }) => topic.order === order); if (!entry) return null;
  const cards = entry.topic.cards.slice(0, 30).map((card, index) => ({
    id: builtInCardId(order, index + 1), deckId, term: card.term,
    termNormalized: card.term.trim().toLocaleLowerCase('en-US'), meaning: card.meaning,
    example: card.example, pronunciation: card.pronunciation, imageUrl: card.imageUrl,
    partOfSpeech: card.partOfSpeech, sourceOrder: card.sourceOrder, createdAt: null, updatedAt: null,
  }));
  cardCache.set(deckId, cards);
  return cards;
}

export function getBuiltInCard(deckId: string, cardId: string) {
  return listBuiltInCards(deckId)?.find((card) => card.id === cardId) ?? null;
}

function normalizeSearchText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLocaleLowerCase('vi-VN')
    .trim();
}

export function searchBuiltInVocabulary(uid: string, query: string): BuiltInVocabularySearchResult[] {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return listBuiltInVocabulary(uid);

  return getVocabularyIndex(uid).filter(({ searchText }) => (
    searchText.includes(normalizedQuery)
  )).sort((left, right) => {
    const leftStarts = left.normalizedTerm.startsWith(normalizedQuery) ? 0 : 1;
    const rightStarts = right.normalizedTerm.startsWith(normalizedQuery) ? 0 : 1;
    return leftStarts - rightStarts || left.normalizedTerm.localeCompare(right.normalizedTerm, 'en');
  });
}

function getVocabularyIndex(uid: string): IndexedVocabularySearchResult[] {
  const cached = vocabularyCache.get(uid);
  if (cached) return cached;
  const decksByOrder = new Map(
    listBuiltInDecks(uid).map((deck) => [deck.topicOrder, deck]),
  );

  const vocabulary = topics.flatMap(({ category, topic }) => {
    const deck = decksByOrder.get(topic.order);
    if (!deck) return [];

    return topic.cards.slice(0, 30).flatMap((sourceCard, index) => {
      const normalizedTerm = normalizeSearchText(sourceCard.term);
      const card: Flashcard = {
        id: builtInCardId(topic.order, index + 1),
        deckId: deck.id,
        term: sourceCard.term,
        termNormalized: normalizedTerm,
        meaning: sourceCard.meaning,
        example: sourceCard.example,
        pronunciation: sourceCard.pronunciation,
        imageUrl: sourceCard.imageUrl,
        partOfSpeech: sourceCard.partOfSpeech,
        sourceOrder: sourceCard.sourceOrder,
        createdAt: null,
        updatedAt: null,
      };

      return [{
        card,
        deck,
        categoryTitle: category.title,
        topicTitle: topic.title,
        normalizedTerm,
        searchText: `${normalizedTerm}\n${normalizeSearchText(sourceCard.meaning)}\n${normalizeSearchText(sourceCard.example)}`,
      }];
    });
  });
  vocabularyCache.set(uid, vocabulary);
  return vocabulary;
}

export function listBuiltInVocabulary(uid: string): BuiltInVocabularySearchResult[] {
  return getVocabularyIndex(uid);
}
