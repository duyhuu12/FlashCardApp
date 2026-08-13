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
  return topics.map(({ category, topic }) => ({
    id: builtInDeckId(uid, topic.order), ownerId: uid,
    title: topic.titleEnglish ? `${topic.title} (${topic.titleEnglish})` : topic.title,
    description: `Bài ${topic.order}/${dataset.topicCount} · Nhóm ${category.title}`,
    topic: topic.title, sourceLanguage: 'Tiếng Anh', targetLanguage: 'Tiếng Việt',
    color: '#6558D3', isPublic: false, cardCount: topic.cards.length,
    copiedFromDeckId: null, seedId: dataset.id, pathId: dataset.id, pathTitle: dataset.title,
    pathOrder: topic.order, categoryId: category.id, categoryTitle: category.title,
    categoryOrder: category.order, topicId: topic.id, topicOrder: topic.order,
    createdAt: null, updatedAt: null,
  }));
}

export function listBuiltInCategories(uid: string): BuiltInVocabularyCategory[] {
  const decksByCategory = new Map<string, Deck[]>();
  listBuiltInDecks(uid).forEach((deck) => {
    if (!deck.categoryId) return;
    const categoryDecks = decksByCategory.get(deck.categoryId) ?? [];
    categoryDecks.push(deck);
    decksByCategory.set(deck.categoryId, categoryDecks);
  });

  return dataset.categories.map((category) => {
    const categoryTopics = decksByCategory.get(category.id) ?? [];
    return {
      id: category.id,
      order: category.order,
      title: category.title,
      wordCount: categoryTopics.reduce((total, topic) => total + topic.cardCount, 0),
      topics: categoryTopics,
    };
  });
}

export function getBuiltInDeck(deckId: string): Deck | null {
  const order = topicOrderFromDeckId(deckId); if (order === null) return null;
  const uid = deckId.slice(dataset.id.length + 1, deckId.lastIndexOf('-topic-'));
  return listBuiltInDecks(uid).find((deck) => deck.pathOrder === order) ?? null;
}

export function listBuiltInCards(deckId: string): Flashcard[] | null {
  const order = topicOrderFromDeckId(deckId); if (order === null) return null;
  const entry = topics.find(({ topic }) => topic.order === order); if (!entry) return null;
  return entry.topic.cards.map((card, index) => ({
    id: builtInCardId(order, index + 1), deckId, term: card.term,
    termNormalized: card.term.trim().toLocaleLowerCase('en-US'), meaning: card.meaning,
    example: card.example, pronunciation: card.pronunciation, imageUrl: card.imageUrl,
    partOfSpeech: card.partOfSpeech, sourceOrder: card.sourceOrder, createdAt: null, updatedAt: null,
  }));
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

  return listBuiltInVocabulary(uid).filter(({ card }) => (
    normalizeSearchText(card.term).includes(normalizedQuery)
    || normalizeSearchText(card.meaning).includes(normalizedQuery)
    || normalizeSearchText(card.example).includes(normalizedQuery)
  )).sort((left, right) => {
    const leftTerm = normalizeSearchText(left.card.term);
    const rightTerm = normalizeSearchText(right.card.term);
    const leftStarts = leftTerm.startsWith(normalizedQuery) ? 0 : 1;
    const rightStarts = rightTerm.startsWith(normalizedQuery) ? 0 : 1;
    return leftStarts - rightStarts || leftTerm.localeCompare(rightTerm, 'en');
  });
}

export function listBuiltInVocabulary(uid: string): BuiltInVocabularySearchResult[] {
  const decksByOrder = new Map(
    listBuiltInDecks(uid).map((deck) => [deck.topicOrder, deck]),
  );

  return topics.flatMap(({ category, topic }) => {
    const deck = decksByOrder.get(topic.order);
    if (!deck) return [];

    return topic.cards.flatMap((sourceCard, index) => {
      const card: Flashcard = {
        id: builtInCardId(topic.order, index + 1),
        deckId: deck.id,
        term: sourceCard.term,
        termNormalized: normalizeSearchText(sourceCard.term),
        meaning: sourceCard.meaning,
        example: sourceCard.example,
        pronunciation: sourceCard.pronunciation,
        imageUrl: sourceCard.imageUrl,
        partOfSpeech: sourceCard.partOfSpeech,
        sourceOrder: sourceCard.sourceOrder,
        createdAt: null,
        updatedAt: null,
      };

      return [{ card, deck, categoryTitle: category.title, topicTitle: topic.title }];
    });
  });
}
