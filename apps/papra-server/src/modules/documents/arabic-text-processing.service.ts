import type { Logger } from '@crowlog/logger';
import { createLogger } from '../shared/logger/logger';

export interface ArabicTextAnalysis {
  originalText: string;
  normalizedText: string;
  cleanedText: string;
  wordCount: number;
  characterCount: number;
  arabicWordCount: number;
  hasArabicContent: boolean;
  confidence: number;
  language: 'arabic' | 'mixed' | 'non-arabic';
}

export interface SearchableText {
  original: string;
  normalized: string;
  searchable: string;
  keywords: string[];
}

/**
 * Arabic Text Processing Service
 * Handles normalization, cleaning, and search preparation for Arabic text
 */
export class ArabicTextProcessingService {
  private logger: Logger;

  // Arabic Unicode ranges
  private static readonly ARABIC_RANGES = [
    [0x0600, 0x06FF], // Arabic
    [0x0750, 0x077F], // Arabic Supplement
    [0x08A0, 0x08FF], // Arabic Extended-A
    [0xFB50, 0xFDFF], // Arabic Presentation Forms-A
    [0xFE70, 0xFEFF], // Arabic Presentation Forms-B
  ];

  // Arabic diacritics (Tashkeel)
  private static readonly ARABIC_DIACRITICS = /[\u064B-\u0652\u0670\u0640]/g;

  // Arabic punctuation
  private static readonly ARABIC_PUNCTUATION = /[؍؎؏ؐؑؒؓؔؕؖؗ؛؞؟؊؋،؍]/g;

  constructor(logger?: Logger) {
    this.logger = logger ?? createLogger({ namespace: 'arabic-text-processing' });
  }

  /**
   * Comprehensive Arabic text analysis
   */
  analyzeText(text: string): ArabicTextAnalysis {
    if (!text || typeof text !== 'string') {
      return this.getEmptyAnalysis(text);
    }

    const originalText = text;
    const normalizedText = this.normalizeArabicText(text);
    const cleanedText = this.cleanArabicText(normalizedText);
    
    const words = this.extractWords(cleanedText);
    const arabicWords = words.filter(word => this.isArabicWord(word));
    
    const wordCount = words.length;
    const characterCount = cleanedText.length;
    const arabicWordCount = arabicWords.length;
    const hasArabicContent = arabicWordCount > 0;
    
    // Calculate confidence based on Arabic content ratio
    const confidence = this.calculateArabicConfidence(text, arabicWordCount, wordCount);
    
    // Determine language
    const language = this.detectLanguage(arabicWordCount, wordCount);

    this.logger.debug({
      wordCount,
      arabicWordCount,
      characterCount,
      confidence,
      language
    }, 'Arabic text analysis completed');

    return {
      originalText,
      normalizedText,
      cleanedText,
      wordCount,
      characterCount,
      arabicWordCount,
      hasArabicContent,
      confidence,
      language,
    };
  }

  /**
   * Prepare text for search functionality
   */
  prepareForSearch(text: string): SearchableText {
    const normalized = this.normalizeArabicText(text);
    const searchable = this.createSearchableText(normalized);
    const keywords = this.extractKeywords(searchable);

    return {
      original: text,
      normalized,
      searchable,
      keywords,
    };
  }

  /**
   * Normalize Arabic text for consistent processing
   */
  normalizeArabicText(text: string): string {
    if (!text) return '';

    return text
      // Normalize whitespace
      .replace(/\s+/g, ' ')
      .trim()
      
      // Normalize Arabic letters
      .replace(/[إأآا]/g, 'ا') // Normalize Alef variations
      .replace(/[ي]/g, 'ی') // Normalize Yeh
      .replace(/[ك]/g, 'ک') // Normalize Kaf
      .replace(/ة/g, 'ه') // Normalize Teh Marbuta to Heh
      
      // Remove or normalize diacritics (optional - can be configured)
      .replace(ArabicTextProcessingService.ARABIC_DIACRITICS, '')
      
      // Normalize punctuation spacing
      .replace(/\s*([\.،؛؟!])\s*/g, '$1 ')
      .replace(/\s+([\.،؛؟!])/g, '$1')
      
      // Remove extra spaces
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Clean Arabic text by removing unwanted characters
   */
  cleanArabicText(text: string): string {
    if (!text) return '';

    return text
      // Remove non-Arabic, non-Latin, non-numeric characters except punctuation
      .replace(/[^\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF\u0020-\u007F\s\d]/g, '')
      
      // Clean up multiple spaces
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Create searchable version of text with additional processing
   */
  private createSearchableText(text: string): string {
    return text
      // Convert to lowercase for English parts
      .toLowerCase()
      
      // Remove punctuation for search
      .replace(/[^\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF\w\s]/g, ' ')
      
      // Normalize spaces
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Extract keywords from Arabic text
   */
  private extractKeywords(text: string): string[] {
    const words = this.extractWords(text);
    
    // Filter out short words and common stop words
    const keywords = words.filter(word => {
      // Keep words longer than 2 characters
      if (word.length <= 2) return false;
      
      // Filter out common Arabic stop words
      const arabicStopWords = new Set([
        'في', 'من', 'إلى', 'على', 'عن', 'هذا', 'هذه', 'ذلك', 'التي', 'الذي',
        'بعد', 'قبل', 'عند', 'حول', 'بين', 'تحت', 'فوق', 'كان', 'كانت',
        'يكون', 'تكون', 'لكن', 'غير', 'سوف', 'قد', 'لقد', 'أن', 'أن',
      ]);
      
      if (arabicStopWords.has(word)) return false;
      
      // Filter out common English stop words
      const englishStopWords = new Set([
        'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to',
        'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be',
        'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
      ]);
      
      if (englishStopWords.has(word.toLowerCase())) return false;
      
      return true;
    });

    // Remove duplicates and return
    return [...new Set(keywords)];
  }

  /**
   * Extract words from text
   */
  private extractWords(text: string): string[] {
    return text
      .split(/\s+/)
      .filter(word => word.length > 0);
  }

  /**
   * Check if a word contains Arabic characters
   */
  private isArabicWord(word: string): boolean {
    return ArabicTextProcessingService.ARABIC_RANGES.some(([start, end]) => {
      return [...word].some(char => {
        const code = char.codePointAt(0) || 0;
        return code >= start && code <= end;
      });
    });
  }

  /**
   * Calculate confidence score for Arabic content
   */
  private calculateArabicConfidence(text: string, arabicWords: number, totalWords: number): number {
    if (totalWords === 0) return 0;
    
    // Base confidence on ratio of Arabic words
    const arabicRatio = arabicWords / totalWords;
    
    // Boost confidence if text contains significant Arabic content
    let confidence = arabicRatio * 100;
    
    // Additional checks for Arabic-specific patterns
    const hasArabicPunctuation = ArabicTextProcessingService.ARABIC_PUNCTUATION.test(text);
    const hasRightToLeftMarkers = /[\u200F\u202E]/g.test(text);
    
    if (hasArabicPunctuation) confidence += 10;
    if (hasRightToLeftMarkers) confidence += 10;
    
    return Math.min(100, Math.max(0, confidence));
  }

  /**
   * Detect primary language of text
   */
  private detectLanguage(arabicWords: number, totalWords: number): 'arabic' | 'mixed' | 'non-arabic' {
    if (totalWords === 0) return 'non-arabic';
    
    const arabicRatio = arabicWords / totalWords;
    
    if (arabicRatio >= 0.7) return 'arabic';
    if (arabicRatio >= 0.3) return 'mixed';
    return 'non-arabic';
  }

  /**
   * Get empty analysis structure
   */
  private getEmptyAnalysis(text: string): ArabicTextAnalysis {
    return {
      originalText: text || '',
      normalizedText: '',
      cleanedText: '',
      wordCount: 0,
      characterCount: 0,
      arabicWordCount: 0,
      hasArabicContent: false,
      confidence: 0,
      language: 'non-arabic',
    };
  }

  /**
   * Validate if text is suitable for Arabic OCR processing
   */
  isValidForArabicOCR(text: string): boolean {
    const analysis = this.analyzeText(text);
    return analysis.hasArabicContent || analysis.language === 'mixed';
  }

  /**
   * Get processing recommendations based on text analysis
   */
  getProcessingRecommendations(text: string): {
    shouldUseArabicOCR: boolean;
    recommendedLanguages: string[];
    processingType: 'arabic-optimized' | 'mixed-content' | 'fallback';
  } {
    const analysis = this.analyzeText(text);
    
    if (analysis.language === 'arabic') {
      return {
        shouldUseArabicOCR: true,
        recommendedLanguages: ['ara'],
        processingType: 'arabic-optimized',
      };
    }
    
    if (analysis.language === 'mixed') {
      return {
        shouldUseArabicOCR: true,
        recommendedLanguages: ['ara', 'eng'],
        processingType: 'mixed-content',
      };
    }
    
    return {
      shouldUseArabicOCR: false,
      recommendedLanguages: ['eng'],
      processingType: 'fallback',
    };
  }
}