import { createPrefixedIdRegex } from '../shared/random/ids';

export const DOCUMENT_ID_PREFIX = 'doc';
export const DOCUMENT_ID_REGEX = createPrefixedIdRegex({ prefix: DOCUMENT_ID_PREFIX });

export const ORIGINAL_DOCUMENTS_STORAGE_KEY = 'originals';

// Arabic-focused OCR languages - prioritizing Arabic and related scripts
export const ARABIC_PRIMARY_LANGUAGES = ['ara'] as const; // Arabic
export const ARABIC_RELATED_LANGUAGES = ['fas', 'urd', 'pus', 'kur', 'uig'] as const; // Persian, Urdu, Pashto, Kurdish, Uyghur
export const SUPPORTING_LANGUAGES = ['eng', 'fra'] as const; // English, French for mixed documents

// Complete list of supported OCR languages for Arabic documents
export const OCR_LANGUAGES = [
  ...ARABIC_PRIMARY_LANGUAGES,
  ...ARABIC_RELATED_LANGUAGES,
  ...SUPPORTING_LANGUAGES,
  // Additional languages that might appear in Arabic regions
  'heb', // Hebrew
  'tur', // Turkish
  'rus', // Russian (for some regions)
] as const;

// Default language configuration for different document types
export const DEFAULT_ARABIC_OCR_LANGUAGES = {
  ARABIC_ONLY: ['ara'] as const,
  ARABIC_ENGLISH: ['ara', 'eng'] as const,
  MULTI_ARABIC: ['ara', 'fas', 'urd'] as const,
  COMPREHENSIVE: ['ara', 'eng', 'fas', 'urd', 'heb', 'tur'] as const,
} as const;

// Document type detection patterns
export const ARABIC_DOCUMENT_PATTERNS = {
  PRINTED: {
    confidence: 0.8,
    languages: DEFAULT_ARABIC_OCR_LANGUAGES.ARABIC_ENGLISH,
  },
  HANDWRITTEN: {
    confidence: 0.6,
    languages: DEFAULT_ARABIC_OCR_LANGUAGES.ARABIC_ONLY,
  },
  MIXED: {
    confidence: 0.7,
    languages: DEFAULT_ARABIC_OCR_LANGUAGES.ARABIC_ENGLISH,
  },
  OFFICIAL: {
    confidence: 0.9,
    languages: DEFAULT_ARABIC_OCR_LANGUAGES.COMPREHENSIVE,
  },
} as const;
