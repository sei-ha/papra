import type { Logger } from '@crowlog/logger';
import { createLogger } from '../shared/logger/logger';
import { ArabicOCRService, type ArabicOCRConfig } from './arabic-ocr.service';
import { ArabicTextProcessingService } from './arabic-text-processing.service';
import { ArabicSearchService } from './arabic-search.service';

export interface DocumentProcessingResult {
  success: boolean;
  documentId: string;
  extractedText: string;
  normalizedText: string;
  searchableText: string;
  keywords: string[];
  confidence: number;
  language: 'arabic' | 'mixed' | 'non-arabic';
  processingTime: number;
  extractorName: string;
  metadata: {
    fileType: string;
    fileSize: number;
    documentType: 'printed' | 'handwritten' | 'mixed';
    arabicWordCount: number;
    totalWordCount: number;
    processingRecommendations: any;
  };
  error?: string;
}

export interface ProcessingOptions {
  documentType?: 'printed' | 'handwritten' | 'mixed';
  languages?: string[];
  enableSearch?: boolean;
  enhanceForHandwriting?: boolean;
  preprocessImage?: boolean;
}

/**
 * Comprehensive Arabic Document Processor
 * Integrates OCR, text processing, and search capabilities for Arabic documents
 */
export class ArabicDocumentProcessorService {
  private logger: Logger;
  private ocrService: ArabicOCRService;
  private textProcessor: ArabicTextProcessingService;
  private searchService: ArabicSearchService;

  constructor(logger?: Logger) {
    this.logger = logger ?? createLogger({ namespace: 'arabic-document-processor' });
    this.ocrService = new ArabicOCRService(this.logger);
    this.textProcessor = new ArabicTextProcessingService(this.logger);
    this.searchService = new ArabicSearchService(this.logger);
  }

  /**
   * Process a document with comprehensive Arabic support
   */
  async processDocument(
    file: File,
    documentId: string,
    options: ProcessingOptions = {}
  ): Promise<DocumentProcessingResult> {
    const startTime = Date.now();
    
    try {
      this.logger.info({
        documentId,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        options
      }, 'Starting Arabic document processing');

      // Validate file type
      if (!this.isSupportedFileType(file.type)) {
        throw new Error(`Unsupported file type: ${file.type}. Supported types: images (PNG, JPEG, WebP, GIF) and PDF.`);
      }

      // Determine document type if not specified
      const documentType = options.documentType ?? 'mixed';
      
      // Get optimal OCR configuration
      const ocrConfig = this.getOptimalOCRConfig(documentType, options);
      
      // Extract text using OCR
      const arrayBuffer = await file.arrayBuffer();
      let ocrResult;
      
      if (file.type.startsWith('image/')) {
        ocrResult = await this.ocrService.extractTextFromImage(arrayBuffer, ocrConfig);
      } else if (file.type === 'application/pdf') {
        ocrResult = await this.ocrService.extractTextFromPDF(arrayBuffer, ocrConfig);
      } else {
        throw new Error('Unsupported file type for OCR processing');
      }

      if (ocrResult.error) {
        throw ocrResult.error;
      }

      // Process extracted text
      const textAnalysis = this.textProcessor.analyzeText(ocrResult.text);
      const searchableContent = this.textProcessor.prepareForSearch(ocrResult.text);
      const recommendations = this.textProcessor.getProcessingRecommendations(ocrResult.text);

      // Index for search if enabled
      if (options.enableSearch !== false) {
        await this.searchService.indexDocument({
          id: documentId,
          text: ocrResult.text,
          metadata: {
            fileName: file.name,
            fileType: file.type,
            fileSize: file.size,
            documentType,
            processingTime: Date.now() - startTime,
            confidence: ocrResult.confidence,
            extractorName: ocrResult.extractorName,
          }
        });
      }

      const processingTime = Date.now() - startTime;

      const result: DocumentProcessingResult = {
        success: true,
        documentId,
        extractedText: ocrResult.text,
        normalizedText: textAnalysis.normalizedText,
        searchableText: searchableContent.searchable,
        keywords: searchableContent.keywords,
        confidence: ocrResult.confidence,
        language: textAnalysis.language,
        processingTime,
        extractorName: ocrResult.extractorName,
        metadata: {
          fileType: file.type,
          fileSize: file.size,
          documentType,
          arabicWordCount: textAnalysis.arabicWordCount,
          totalWordCount: textAnalysis.wordCount,
          processingRecommendations: recommendations,
        },
      };

      this.logger.info({
        documentId,
        success: true,
        confidence: ocrResult.confidence,
        textLength: ocrResult.text.length,
        arabicWordCount: textAnalysis.arabicWordCount,
        language: textAnalysis.language,
        processingTime,
        extractorName: ocrResult.extractorName
      }, 'Arabic document processing completed successfully');

      return result;

    } catch (error) {
      const processingTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      this.logger.error({
        documentId,
        error,
        fileName: file.name,
        processingTime
      }, 'Arabic document processing failed');

      return {
        success: false,
        documentId,
        extractedText: '',
        normalizedText: '',
        searchableText: '',
        keywords: [],
        confidence: 0,
        language: 'non-arabic',
        processingTime,
        extractorName: 'error',
        metadata: {
          fileType: file.type,
          fileSize: file.size,
          documentType: options.documentType ?? 'mixed',
          arabicWordCount: 0,
          totalWordCount: 0,
          processingRecommendations: null,
        },
        error: errorMessage,
      };
    }
  }

  /**
   * Search processed documents
   */
  async searchDocuments(query: string, options: {
    exact?: boolean;
    fuzzy?: boolean;
    arabicAware?: boolean;
  } = {}): Promise<Array<{
    documentId: string;
    relevanceScore: number;
    matchedText: string;
    context: string;
    highlights: Array<{ start: number; end: number; type: string }>;
  }>> {
    return this.searchService.searchDocuments({
      term: query,
      exact: options.exact,
      fuzzy: options.fuzzy,
      arabicAware: options.arabicAware ?? true,
    });
  }

  /**
   * Remove document from search index
   */
  removeDocument(documentId: string): void {
    this.searchService.removeDocument(documentId);
  }

  /**
   * Get processing statistics
   */
  getProcessingStatistics(): {
    searchStats: any;
    supportedLanguages: string[];
    supportedFileTypes: string[];
    defaultConfigurations: any;
  } {
    return {
      searchStats: this.searchService.getSearchStatistics(),
      supportedLanguages: ArabicOCRService.getSupportedArabicLanguages(),
      supportedFileTypes: this.getSupportedFileTypes(),
      defaultConfigurations: {
        printed: ArabicOCRService.getOptimalLanguageConfig('printed'),
        handwritten: ArabicOCRService.getOptimalLanguageConfig('handwritten'),
        mixed: ArabicOCRService.getOptimalLanguageConfig('mixed'),
      },
    };
  }

  /**
   * Validate and recommend processing options for a file
   */
  async analyzeFileForProcessing(file: File): Promise<{
    isSupported: boolean;
    recommendedOptions: ProcessingOptions;
    estimatedProcessingTime: number;
    recommendations: string[];
  }> {
    const isSupported = this.isSupportedFileType(file.type);
    const recommendations: string[] = [];
    
    if (!isSupported) {
      return {
        isSupported: false,
        recommendedOptions: {},
        estimatedProcessingTime: 0,
        recommendations: ['File type not supported for Arabic OCR processing'],
      };
    }

    // Estimate processing time based on file size and type
    const estimatedProcessingTime = this.estimateProcessingTime(file);
    
    // Generate recommendations
    if (file.type.startsWith('image/')) {
      recommendations.push('Image file detected - will use advanced Arabic OCR');
      
      if (file.size > 5 * 1024 * 1024) { // 5MB
        recommendations.push('Large image file - processing may take longer');
        recommendations.push('Consider enabling image preprocessing for better results');
      }
      
      if (file.size < 100 * 1024) { // 100KB
        recommendations.push('Small image file - may benefit from handwriting enhancement');
      }
    }

    if (file.type === 'application/pdf') {
      recommendations.push('PDF file detected - will extract and OCR each page');
      recommendations.push('For scanned PDFs, Arabic OCR will be applied');
    }

    const recommendedOptions: ProcessingOptions = {
      documentType: file.size < 500 * 1024 ? 'handwritten' : 'printed',
      languages: ['ara', 'eng'],
      enableSearch: true,
      enhanceForHandwriting: file.size < 500 * 1024,
      preprocessImage: true,
    };

    return {
      isSupported: true,
      recommendedOptions,
      estimatedProcessingTime,
      recommendations,
    };
  }

  /**
   * Get optimal OCR configuration
   */
  private getOptimalOCRConfig(
    documentType: 'printed' | 'handwritten' | 'mixed',
    options: ProcessingOptions
  ): ArabicOCRConfig {
    const baseConfig = ArabicOCRService.getOptimalLanguageConfig(documentType);
    
    return {
      ...baseConfig,
      languages: options.languages ?? baseConfig.languages,
      enhanceForHandwriting: options.enhanceForHandwriting ?? baseConfig.enhanceForHandwriting,
      preprocessImage: options.preprocessImage ?? baseConfig.preprocessImage,
      logger: this.logger,
    };
  }

  /**
   * Check if file type is supported
   */
  private isSupportedFileType(mimeType: string): boolean {
    const supportedTypes = [
      'image/png',
      'image/jpeg',
      'image/jpg',
      'image/webp',
      'image/gif',
      'image/bmp',
      'image/tiff',
      'application/pdf',
    ];
    
    return supportedTypes.includes(mimeType.toLowerCase());
  }

  /**
   * Get list of supported file types
   */
  private getSupportedFileTypes(): string[] {
    return [
      'image/png',
      'image/jpeg',
      'image/webp',
      'image/gif',
      'image/bmp',
      'image/tiff',
      'application/pdf',
    ];
  }

  /**
   * Estimate processing time based on file characteristics
   */
  private estimateProcessingTime(file: File): number {
    // Base time in milliseconds
    let estimatedTime = 2000; // 2 seconds base
    
    // File size factor
    const sizeInMB = file.size / (1024 * 1024);
    estimatedTime += sizeInMB * 1000; // 1 second per MB
    
    // File type factor
    if (file.type === 'application/pdf') {
      estimatedTime *= 1.5; // PDFs take longer
    }
    
    if (file.type.startsWith('image/')) {
      if (file.type === 'image/tiff' || file.type === 'image/bmp') {
        estimatedTime *= 1.2; // Uncompressed formats take longer
      }
    }
    
    return Math.round(estimatedTime);
  }
}