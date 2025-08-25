import { describe, it, expect, beforeEach } from 'vitest';
import { ArabicOCRService } from './arabic-ocr.service';
import { ArabicTextProcessingService } from './arabic-text-processing.service';
import { ArabicSearchService } from './arabic-search.service';

describe('Arabic OCR Services', () => {
  let ocrService: ArabicOCRService;
  let textProcessor: ArabicTextProcessingService;
  let searchService: ArabicSearchService;

  beforeEach(() => {
    ocrService = new ArabicOCRService();
    textProcessor = new ArabicTextProcessingService();
    searchService = new ArabicSearchService();
  });

  describe('ArabicTextProcessingService', () => {
    it('should normalize Arabic text correctly', () => {
      const text = 'إن هذا نص تجريبي للاختبار';
      const normalized = textProcessor.normalizeArabicText(text);
      
      expect(normalized).toBeDefined();
      expect(normalized.length).toBeGreaterThan(0);
    });

    it('should analyze Arabic text correctly', () => {
      const text = 'هذا نص عربي للاختبار مع بعض الكلمات الانجليزية English words';
      const analysis = textProcessor.analyzeText(text);
      
      expect(analysis.hasArabicContent).toBe(true);
      expect(analysis.language).toBe('arabic'); // The text is primarily Arabic
      expect(analysis.arabicWordCount).toBeGreaterThan(0);
      expect(analysis.confidence).toBeGreaterThan(0);
    });

    it('should prepare text for search', () => {
      const text = 'نص تجريبي للبحث';
      const searchable = textProcessor.prepareForSearch(text);
      
      expect(searchable.original).toBe(text);
      expect(searchable.normalized).toBeDefined();
      expect(searchable.searchable).toBeDefined();
      expect(searchable.keywords).toBeInstanceOf(Array);
    });

    it('should get processing recommendations', () => {
      const arabicText = 'هذا نص عربي';
      const recommendations = textProcessor.getProcessingRecommendations(arabicText);
      
      expect(recommendations.shouldUseArabicOCR).toBe(true);
      expect(recommendations.recommendedLanguages).toContain('ara');
    });
  });

  describe('ArabicOCRService', () => {
    it('should get supported Arabic languages', () => {
      const languages = ArabicOCRService.getSupportedArabicLanguages();
      
      expect(languages).toBeInstanceOf(Array);
      expect(languages).toContain('ara');
      expect(languages).toContain('eng');
      expect(languages).toContain('fas');
    });

    it('should get optimal language configuration', () => {
      const printedConfig = ArabicOCRService.getOptimalLanguageConfig('printed');
      const handwrittenConfig = ArabicOCRService.getOptimalLanguageConfig('handwritten');
      const mixedConfig = ArabicOCRService.getOptimalLanguageConfig('mixed');
      
      expect(printedConfig.languages).toContain('ara');
      expect(printedConfig.preprocessImage).toBe(true);
      expect(printedConfig.enhanceForHandwriting).toBe(false);
      
      expect(handwrittenConfig.enhanceForHandwriting).toBe(true);
      expect(mixedConfig.languages).toContain('ara');
    });
  });

  describe('ArabicSearchService', () => {
    it('should index and search Arabic documents', async () => {
      const testDoc = {
        id: 'test-doc-1',
        text: 'هذا مستند تجريبي للبحث في النصوص العربية',
        metadata: { type: 'test' }
      };

      await searchService.indexDocument(testDoc);
      
      const results = await searchService.searchDocuments({
        term: 'تجريبي',
        arabicAware: true
      });

      expect(results).toBeInstanceOf(Array);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0]?.documentId).toBe(testDoc.id);
    });

    it('should provide search statistics', async () => {
      const stats = searchService.getSearchStatistics();
      
      expect(stats).toHaveProperty('documentCount');
      expect(stats).toHaveProperty('termCount');
      expect(stats).toHaveProperty('averageKeywordsPerDocument');
      expect(stats).toHaveProperty('languageDistribution');
    });

    it('should handle mixed Arabic-English search', async () => {
      const testDoc = {
        id: 'mixed-doc',
        text: 'هذا مستند يحتوي على نص عربي و English text أيضا',
      };

      await searchService.indexDocument(testDoc);
      
      const arabicResults = await searchService.searchDocuments({
        term: 'مستند',
        arabicAware: true
      });

      const englishResults = await searchService.searchDocuments({
        term: 'English',
        arabicAware: true
      });

      expect(arabicResults.length).toBeGreaterThan(0);
      expect(englishResults.length).toBeGreaterThan(0);
    });

    it('should remove documents from index', async () => {
      const testDoc = {
        id: 'removable-doc',
        text: 'مستند للحذف',
      };

      await searchService.indexDocument(testDoc);
      let results = await searchService.searchDocuments({ term: 'مستند' });
      expect(results.length).toBeGreaterThan(0);

      searchService.removeDocument(testDoc.id);
      results = await searchService.searchDocuments({ term: 'مستند' });
      
      // Should have fewer results after removal
      const remainingResults = results.filter(r => r.documentId === testDoc.id);
      expect(remainingResults.length).toBe(0);
    });
  });

  describe('Integration Tests', () => {
    it('should process Arabic text end-to-end', () => {
      const sampleArabicText = 'بسم الله الرحمن الرحيم، هذا نص تجريبي لاختبار معالجة النصوص العربية';
      
      // Analyze text
      const analysis = textProcessor.analyzeText(sampleArabicText);
      expect(analysis.hasArabicContent).toBe(true);
      expect(analysis.language).toBe('arabic');
      
      // Get recommendations
      const recommendations = textProcessor.getProcessingRecommendations(sampleArabicText);
      expect(recommendations.shouldUseArabicOCR).toBe(true);
      expect(recommendations.processingType).toBe('arabic-optimized');
      
      // Prepare for search
      const searchable = textProcessor.prepareForSearch(sampleArabicText);
      expect(searchable.keywords.length).toBeGreaterThan(0);
    });

    it('should handle different document types', () => {
      const printedConfig = ArabicOCRService.getOptimalLanguageConfig('printed');
      const handwrittenConfig = ArabicOCRService.getOptimalLanguageConfig('handwritten');
      
      expect(printedConfig.languages).toBeDefined();
      expect(printedConfig.preprocessImage).toBe(true);
      expect(handwrittenConfig.enhanceForHandwriting).toBe(true);
      expect(printedConfig.enhanceForHandwriting).toBe(false);
    });
  });
});

// Helper function to create mock image buffer for testing
function createMockImageBuffer(): Buffer {
  // Create a simple mock buffer for testing
  return Buffer.from('mock-image-data');
}

// Mock Arabic text samples for testing
export const MOCK_ARABIC_TEXTS = {
  SIMPLE: 'النص العربي البسيط',
  MIXED: 'نص مختلط Arabic and عربي text',
  FORMAL: 'بسم الله الرحمن الرحيم، هذا نص رسمي',
  HANDWRITTEN: 'نص مكتوب بخط اليد',
  TECHNICAL: 'مصطلحات تقنية وعلمية في النص العربي',
} as const;