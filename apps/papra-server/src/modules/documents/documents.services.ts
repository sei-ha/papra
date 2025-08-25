import type { Logger } from '@crowlog/logger';
import { createLogger } from '../shared/logger/logger';
import { getStreamSha256Hash } from '../shared/streams/stream-hash';
import { ArabicDocumentProcessorService } from './arabic-document-processor.service';
import { createId } from '@paralleldrive/cuid2';

export async function getFileHash({ fileStream }: { fileStream: ReadableStream<Uint8Array> }) {
  const { hash } = await getStreamSha256Hash({ stream: fileStream });

  return { hash };
}

/**
 * Extract text from documents using Arabic-optimized OCR
 * This function replaces the old lecture package with our enhanced Arabic OCR system
 */
export async function extractDocumentText({
  file,
  ocrLanguages,
  documentType = 'mixed',
  documentId,
  logger = createLogger({ namespace: 'documents:services' }),
}: {
  file: File;
  ocrLanguages?: string[];
  documentType?: 'printed' | 'handwritten' | 'mixed';
  documentId?: string;
  logger?: Logger;
}) {
  const processor = new ArabicDocumentProcessorService(logger);
  
  // Generate document ID if not provided
  const docId = documentId ?? createId();

  logger.info({ 
    documentId: docId,
    fileName: file.name, 
    fileSize: file.size, 
    fileType: file.type,
    documentType,
    ocrLanguages
  }, 'Starting Arabic document processing');

  try {
    // Process the document using our comprehensive Arabic processor
    const result = await processor.processDocument(file, docId, {
      documentType,
      languages: ocrLanguages,
      enableSearch: true,
      preprocessImage: true,
      enhanceForHandwriting: documentType === 'handwritten',
    });

    if (!result.success) {
      logger.error({ 
        documentId: docId, 
        error: result.error,
        fileName: file.name 
      }, 'Arabic document processing failed');
      
      return {
        text: '',
        confidence: 0,
        error: result.error || 'Unknown processing error',
        documentId: docId,
      };
    }

    logger.info({
      documentId: docId,
      success: true,
      extractorName: result.extractorName,
      confidence: result.confidence,
      textLength: result.extractedText.length,
      arabicWordCount: result.metadata.arabicWordCount,
      totalWordCount: result.metadata.totalWordCount,
      language: result.language,
      processingTime: result.processingTime,
      keywordCount: result.keywords.length
    }, 'Arabic document processing completed successfully');

    // Return in the expected format for backward compatibility
    return {
      text: result.extractedText,
      normalizedText: result.normalizedText,
      searchableText: result.searchableText,
      keywords: result.keywords,
      confidence: result.confidence,
      language: result.language,
      extractorName: result.extractorName,
      processingTime: result.processingTime,
      documentId: docId,
      metadata: result.metadata,
      analysis: {
        hasArabicContent: result.metadata.arabicWordCount > 0,
        arabicWordCount: result.metadata.arabicWordCount,
        wordCount: result.metadata.totalWordCount,
        language: result.language,
        confidence: result.confidence,
      },
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error({ 
      documentId: docId, 
      error, 
      fileName: file.name 
    }, 'Unexpected error during Arabic document processing');
    
    return {
      text: '',
      confidence: 0,
      error: errorMessage,
      documentId: docId,
    };
  }
}

/**
 * Search documents using Arabic-aware search
 */
export async function searchDocuments(
  query: string,
  options: {
    exact?: boolean;
    fuzzy?: boolean;
    arabicAware?: boolean;
  } = {},
  logger = createLogger({ namespace: 'documents:search' })
) {
  const processor = new ArabicDocumentProcessorService(logger);
  
  try {
    logger.debug({ query, options }, 'Starting Arabic document search');
    
    const results = await processor.searchDocuments(query, {
      exact: options.exact ?? false,
      fuzzy: options.fuzzy ?? true,
      arabicAware: options.arabicAware ?? true,
    });

    logger.info({
      query,
      resultCount: results.length,
      options
    }, 'Arabic document search completed');

    return results;

  } catch (error) {
    logger.error({ error, query }, 'Arabic document search failed');
    return [];
  }
}

/**
 * Remove document from search index
 */
export function removeDocumentFromSearch(
  documentId: string,
  logger = createLogger({ namespace: 'documents:search' })
) {
  const processor = new ArabicDocumentProcessorService(logger);
  
  try {
    processor.removeDocument(documentId);
    logger.info({ documentId }, 'Document removed from search index');
  } catch (error) {
    logger.error({ error, documentId }, 'Failed to remove document from search index');
  }
}

/**
 * Get processing statistics and capabilities
 */
export function getProcessingCapabilities(
  logger = createLogger({ namespace: 'documents:capabilities' })
) {
  const processor = new ArabicDocumentProcessorService(logger);
  
  try {
    const stats = processor.getProcessingStatistics();
    
    logger.debug(stats, 'Retrieved processing capabilities');
    
    return {
      ...stats,
      features: {
        arabicOCR: true,
        handwritingRecognition: true,
        arabicTextNormalization: true,
        arabicSearch: true,
        multiLanguageSupport: true,
        imagePreprocessing: true,
        pdfProcessing: true,
      },
      limitations: {
        maxFileSize: '50MB',
        supportedFormats: stats.supportedFileTypes,
        processingTimeEstimate: 'Variable based on file size and complexity',
      },
    };
    
  } catch (error) {
    logger.error({ error }, 'Failed to retrieve processing capabilities');
    return null;
  }
}

/**
 * Analyze file and provide processing recommendations
 */
export async function analyzeFileForProcessing(
  file: File,
  logger = createLogger({ namespace: 'documents:analysis' })
) {
  const processor = new ArabicDocumentProcessorService(logger);
  
  try {
    logger.debug({ 
      fileName: file.name, 
      fileSize: file.size, 
      fileType: file.type 
    }, 'Analyzing file for processing recommendations');
    
    const analysis = await processor.analyzeFileForProcessing(file);
    
    logger.info({
      fileName: file.name,
      isSupported: analysis.isSupported,
      estimatedTime: analysis.estimatedProcessingTime,
      recommendationCount: analysis.recommendations.length
    }, 'File analysis completed');

    return analysis;

  } catch (error) {
    logger.error({ error, fileName: file.name }, 'File analysis failed');
    return {
      isSupported: false,
      recommendedOptions: {},
      estimatedProcessingTime: 0,
      recommendations: ['Analysis failed - please try again'],
    };
  }
}
