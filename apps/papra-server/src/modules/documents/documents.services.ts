import type { Logger } from '@crowlog/logger';
import { createLogger } from '../shared/logger/logger';
import { getStreamSha256Hash } from '../shared/streams/stream-hash';
import { ArabicDocumentProcessorService } from './arabic-document-processor.service';
import { ArabicOCRService, type ArabicOCRConfig } from './arabic-ocr.service';
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

  // Validate file type
  if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
    const error = `Unsupported file type: ${file.type}`;
    logger.error({ documentId: docId, fileType: file.type }, error);
    return {
      text: '',
      confidence: 0,
      error,
      documentId: docId,
    };
  }

  try {
    // Use advanced Arabic OCR service for superior results
    const ocrService = new ArabicOCRService(logger);
    
    // Get optimal configuration for the document type
    const baseConfig = ArabicOCRService.getOptimalLanguageConfig(documentType);
    
    // Override languages if specified, but ensure Arabic is included
    const languages = ocrLanguages && ocrLanguages.length > 0 
      ? [...new Set([...baseConfig.languages, ...ocrLanguages])] // Merge and deduplicate
      : baseConfig.languages;

    logger.info({ languages, documentType, config: baseConfig }, 'Using advanced Arabic OCR');

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    
    // Create OCR configuration
    const ocrConfig: ArabicOCRConfig = {
      ...baseConfig,
      languages,
      logger,
    };
    
    // Extract text using advanced Arabic OCR
    const result = await ocrService.extractTextFromImage(arrayBuffer, ocrConfig);

    if (result.error) {
      logger.error({ 
        documentId: docId, 
        error: result.error,
        fileName: file.name 
      }, 'OCR extraction failed');
      
      return {
        text: '',
        confidence: 0,
        error: result.error.message,
        documentId: docId,
      };
    }

    logger.info({
      documentId: docId,
      success: true,
      extractorName: result.extractorName,
      confidence: result.confidence,
      textLength: result.text.length,
      languages
    }, 'OCR extraction completed successfully');

    // Return in the expected format
    return {
      text: result.text,
      confidence: result.confidence,
      extractorName: result.extractorName,
      documentId: docId,
      languages,
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error({ 
      documentId: docId, 
      error, 
      fileName: file.name 
    }, 'Unexpected error during OCR processing');
    
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
