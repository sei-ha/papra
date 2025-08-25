import type { Logger } from '@crowlog/logger';
import { createLogger } from '../shared/logger/logger';
import { ArabicTextProcessingService } from './arabic-text-processing.service';

export interface SearchQuery {
  term: string;
  exact?: boolean;
  fuzzy?: boolean;
  arabicAware?: boolean;
}

export interface SearchResult {
  documentId: string;
  relevanceScore: number;
  matchedText: string;
  context: string;
  matchType: 'exact' | 'partial' | 'fuzzy' | 'semantic';
  highlights: SearchHighlight[];
}

export interface SearchHighlight {
  start: number;
  end: number;
  type: 'exact' | 'fuzzy' | 'variant';
}

export interface IndexedDocument {
  id: string;
  originalText: string;
  normalizedText: string;
  searchableText: string;
  keywords: string[];
  language: 'arabic' | 'mixed' | 'non-arabic';
  metadata?: Record<string, any>;
}

/**
 * Arabic-aware search service with full-text search capabilities
 * Implements FTS5-like functionality with Arabic text normalization
 */
export class ArabicSearchService {
  private logger: Logger;
  private textProcessor: ArabicTextProcessingService;
  private documentIndex: Map<string, IndexedDocument> = new Map();
  private invertedIndex: Map<string, Set<string>> = new Map();

  constructor(logger?: Logger) {
    this.logger = logger ?? createLogger({ namespace: 'arabic-search' });
    this.textProcessor = new ArabicTextProcessingService(logger);
  }

  /**
   * Index a document for search
   */
  async indexDocument(document: {
    id: string;
    text: string;
    metadata?: Record<string, any>;
  }): Promise<void> {
    try {
      this.logger.debug({ documentId: document.id }, 'Indexing document for Arabic search');

      const analysis = this.textProcessor.analyzeText(document.text);
      const searchableContent = this.textProcessor.prepareForSearch(document.text);

      const indexedDoc: IndexedDocument = {
        id: document.id,
        originalText: document.text,
        normalizedText: analysis.normalizedText,
        searchableText: searchableContent.searchable,
        keywords: searchableContent.keywords,
        language: analysis.language,
        metadata: document.metadata,
      };

      // Add to main document index
      this.documentIndex.set(document.id, indexedDoc);

      // Update inverted index
      this.updateInvertedIndex(document.id, searchableContent.keywords);
      this.updateInvertedIndex(document.id, this.extractNGrams(searchableContent.searchable, 2));
      this.updateInvertedIndex(document.id, this.extractNGrams(searchableContent.searchable, 3));

      this.logger.info({
        documentId: document.id,
        keywordCount: searchableContent.keywords.length,
        language: analysis.language,
        textLength: document.text.length
      }, 'Document indexed successfully');

    } catch (error) {
      this.logger.error({ error, documentId: document.id }, 'Failed to index document');
      throw error;
    }
  }

  /**
   * Search documents with Arabic-aware matching
   */
  async searchDocuments(query: SearchQuery): Promise<SearchResult[]> {
    try {
      this.logger.debug({ query }, 'Starting Arabic-aware document search');

      if (!query.term || query.term.trim().length === 0) {
        return [];
      }

      // Prepare search terms
      const searchTerms = this.prepareSearchTerms(query.term, query.arabicAware ?? true);
      
      // Find candidate documents
      const candidates = this.findCandidateDocuments(searchTerms);
      
      // Score and rank results
      const results = await this.scoreAndRankResults(candidates, searchTerms, query);
      
      // Sort by relevance score
      results.sort((a, b) => b.relevanceScore - a.relevanceScore);

      this.logger.info({
        query: query.term,
        candidateCount: candidates.size,
        resultCount: results.length
      }, 'Search completed');

      return results;

    } catch (error) {
      this.logger.error({ error, query }, 'Search operation failed');
      return [];
    }
  }

  /**
   * Remove document from search index
   */
  removeDocument(documentId: string): void {
    const document = this.documentIndex.get(documentId);
    if (!document) return;

    // Remove from main index
    this.documentIndex.delete(documentId);

    // Clean up inverted index
    for (const [term, docIds] of this.invertedIndex.entries()) {
      docIds.delete(documentId);
      if (docIds.size === 0) {
        this.invertedIndex.delete(term);
      }
    }

    this.logger.debug({ documentId }, 'Document removed from search index');
  }

  /**
   * Get search statistics
   */
  getSearchStatistics(): {
    documentCount: number;
    termCount: number;
    averageKeywordsPerDocument: number;
    languageDistribution: Record<string, number>;
  } {
    const docs = Array.from(this.documentIndex.values());
    const languageDistribution: Record<string, number> = {};

    docs.forEach(doc => {
      languageDistribution[doc.language] = (languageDistribution[doc.language] || 0) + 1;
    });

    return {
      documentCount: docs.length,
      termCount: this.invertedIndex.size,
      averageKeywordsPerDocument: docs.reduce((sum, doc) => sum + doc.keywords.length, 0) / docs.length || 0,
      languageDistribution,
    };
  }

  /**
   * Prepare search terms with Arabic normalization
   */
  private prepareSearchTerms(query: string, arabicAware: boolean): string[] {
    if (!arabicAware) {
      return query.toLowerCase().split(/\s+/).filter(term => term.length > 0);
    }

    // Apply Arabic text processing
    const normalizedQuery = this.textProcessor.normalizeArabicText(query);
    const searchableQuery = this.textProcessor.prepareForSearch(normalizedQuery);
    
    // Extract terms and variants
    const terms = searchableQuery.searchable.split(/\s+/).filter(term => term.length > 0);
    const variants = new Set<string>();

    terms.forEach(term => {
      variants.add(term);
      
      // Add Arabic variants for better matching
      if (this.isArabicTerm(term)) {
        // Add root-based variants (simplified)
        variants.add(this.generateArabicVariants(term));
      }
    });

    return Array.from(variants);
  }

  /**
   * Find candidate documents using inverted index
   */
  private findCandidateDocuments(searchTerms: string[]): Set<string> {
    const candidates = new Set<string>();

    searchTerms.forEach(term => {
      // Exact matches
      const exactMatches = this.invertedIndex.get(term);
      if (exactMatches) {
        exactMatches.forEach(docId => candidates.add(docId));
      }

      // Partial matches for Arabic terms
      if (this.isArabicTerm(term)) {
        for (const [indexTerm, docIds] of this.invertedIndex.entries()) {
          if (indexTerm.includes(term) || term.includes(indexTerm)) {
            docIds.forEach(docId => candidates.add(docId));
          }
        }
      }
    });

    return candidates;
  }

  /**
   * Score and rank search results
   */
  private async scoreAndRankResults(
    candidateIds: Set<string>,
    searchTerms: string[],
    query: SearchQuery
  ): Promise<SearchResult[]> {
    const results: SearchResult[] = [];

    for (const docId of candidateIds) {
      const document = this.documentIndex.get(docId);
      if (!document) continue;

      const score = this.calculateRelevanceScore(document, searchTerms, query);
      if (score > 0) {
        const highlights = this.findHighlights(document, searchTerms);
        const context = this.extractContext(document.originalText, highlights);

        results.push({
          documentId: docId,
          relevanceScore: score,
          matchedText: highlights.length > 0 && highlights[0] ? document.originalText.substring(highlights[0].start, highlights[0].end) : '',
          context,
          matchType: this.determineMatchType(document, searchTerms),
          highlights,
        });
      }
    }

    return results;
  }

  /**
   * Calculate relevance score for a document
   */
  private calculateRelevanceScore(
    document: IndexedDocument,
    searchTerms: string[],
    query: SearchQuery
  ): number {
    let score = 0;
    const text = document.searchableText.toLowerCase();
    const keywords = document.keywords.map(k => k.toLowerCase());

    searchTerms.forEach(term => {
      const termLower = term.toLowerCase();
      
      // Exact keyword match (highest weight)
      if (keywords.includes(termLower)) {
        score += 10;
      }
      
      // Full text match
      const matches = (text.match(new RegExp(termLower, 'g')) || []).length;
      score += matches * 5;

      // Partial matches for Arabic terms
      if (this.isArabicTerm(term)) {
        const partialMatches = keywords.filter(keyword => 
          keyword.includes(termLower) || termLower.includes(keyword)
        ).length;
        score += partialMatches * 2;
      }
    });

    // Boost score for Arabic documents when searching Arabic terms
    const hasArabicTerms = searchTerms.some(term => this.isArabicTerm(term));
    if (hasArabicTerms && document.language === 'arabic') {
      score *= 1.5;
    }

    // Length normalization
    const lengthNormalization = Math.log(document.originalText.length + 1) / 10;
    score = score / lengthNormalization;

    return Math.max(0, score);
  }

  /**
   * Find highlights in document text
   */
  private findHighlights(document: IndexedDocument, searchTerms: string[]): SearchHighlight[] {
    const highlights: SearchHighlight[] = [];
    const text = document.originalText;
    const normalizedText = document.normalizedText.toLowerCase();

    searchTerms.forEach(term => {
      const regex = new RegExp(term.toLowerCase(), 'gi');
      let match;

      while ((match = regex.exec(normalizedText)) !== null) {
        highlights.push({
          start: match.index,
          end: match.index + match[0].length,
          type: 'exact',
        });
      }
    });

    // Merge overlapping highlights
    return this.mergeHighlights(highlights);
  }

  /**
   * Extract context around highlights
   */
  private extractContext(text: string, highlights: SearchHighlight[], contextLength = 100): string {
    if (highlights.length === 0) {
      return text.substring(0, contextLength) + (text.length > contextLength ? '...' : '');
    }

    const firstHighlight = highlights[0];
    if (!firstHighlight) {
      return text.substring(0, contextLength) + (text.length > contextLength ? '...' : '');
    }
    
    const start = Math.max(0, firstHighlight.start - contextLength);
    const end = Math.min(text.length, firstHighlight.end + contextLength);

    const prefix = start > 0 ? '...' : '';
    const suffix = end < text.length ? '...' : '';

    return prefix + text.substring(start, end) + suffix;
  }

  /**
   * Helper methods
   */
  private updateInvertedIndex(documentId: string, terms: string[]): void {
    terms.forEach(term => {
      const normalizedTerm = term.toLowerCase();
      if (!this.invertedIndex.has(normalizedTerm)) {
        this.invertedIndex.set(normalizedTerm, new Set());
      }
      this.invertedIndex.get(normalizedTerm)!.add(documentId);
    });
  }

  private extractNGrams(text: string, n: number): string[] {
    const words = text.split(/\s+/).filter(word => word.length > 0);
    const ngrams: string[] = [];

    for (let i = 0; i <= words.length - n; i++) {
      ngrams.push(words.slice(i, i + n).join(' '));
    }

    return ngrams;
  }

  private isArabicTerm(term: string): boolean {
    return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(term);
  }

  private generateArabicVariants(term: string): string {
    // Simplified Arabic variant generation
    // In a production system, this would use proper Arabic morphology
    return term
      .replace(/ا/g, '[إأآا]')
      .replace(/ی/g, '[يی]')
      .replace(/ک/g, '[كک]');
  }

  private determineMatchType(document: IndexedDocument, searchTerms: string[]): 'exact' | 'partial' | 'fuzzy' | 'semantic' {
    const text = document.searchableText.toLowerCase();
    const hasExactMatch = searchTerms.some(term => text.includes(term.toLowerCase()));
    
    if (hasExactMatch) return 'exact';
    return 'partial';
  }

  private mergeHighlights(highlights: SearchHighlight[]): SearchHighlight[] {
    if (highlights.length === 0) return highlights;

    highlights.sort((a, b) => a.start - b.start);
    const firstHighlight = highlights[0];
    if (!firstHighlight) return highlights;
    
    const merged: SearchHighlight[] = [firstHighlight];

    for (let i = 1; i < highlights.length; i++) {
      const current = highlights[i];
      const last = merged[merged.length - 1];

      if (current && last && current.start <= last.end + 10) { // Merge if close
        last.end = Math.max(last.end, current.end);
      } else if (current) {
        merged.push(current);
      }
    }

    return merged;
  }
}