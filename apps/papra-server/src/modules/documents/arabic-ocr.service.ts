import type { Logger } from '@crowlog/logger';
import { Buffer } from 'node:buffer';
import { createWorker, PSM, OEM } from 'tesseract.js';
import sharp from 'sharp';
import { createLogger } from '../shared/logger/logger';

export interface ArabicOCRConfig {
  languages: string[];
  psm?: PSM;
  oem?: OEM;
  preprocessImage?: boolean;
  enhanceForHandwriting?: boolean;
  logger?: Logger;
}

export interface OCRResult {
  text: string;
  confidence: number;
  extractorName: string;
  error?: Error;
}

/**
 * Arabic OCR Service optimized for Arabic documents and handwriting
 * Uses Tesseract.js with Arabic-specific configurations
 */
export class ArabicOCRService {
  private logger: Logger;

  constructor(logger?: Logger) {
    this.logger = logger ?? createLogger({ namespace: 'arabic-ocr' });
  }

  /**
   * Extract text from image buffer with Arabic OCR optimization
   */
  async extractTextFromImage(
    imageBuffer: ArrayBuffer | Buffer,
    config: ArabicOCRConfig
  ): Promise<OCRResult> {
    const buffer = imageBuffer instanceof ArrayBuffer ? Buffer.from(imageBuffer) : imageBuffer;
    
    try {
      // Preprocess image for better Arabic OCR results
      const processedBuffer = config.preprocessImage 
        ? await this.preprocessImageForArabic(buffer, config.enhanceForHandwriting)
        : buffer;

      const worker = await createWorker(config.languages, config.oem ?? OEM.LSTM_ONLY);
      
      // Configure Tesseract for Arabic text recognition
      await this.configureWorkerForArabic(worker, config);

      const { data: { text, confidence } } = await worker.recognize(processedBuffer);
      await worker.terminate();

      // Post-process Arabic text
      const normalizedText = this.normalizeArabicText(text);

      this.logger.info({ 
        confidence, 
        textLength: normalizedText.length,
        languages: config.languages 
      }, 'Arabic OCR extraction completed');

      return {
        text: normalizedText,
        confidence,
        extractorName: 'arabic-ocr',
      };
    } catch (error) {
      this.logger.error({ error, languages: config.languages }, 'Arabic OCR extraction failed');
      return {
        text: '',
        confidence: 0,
        extractorName: 'arabic-ocr',
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * Extract text from PDF with Arabic OCR
   */
  async extractTextFromPDF(
    pdfBuffer: ArrayBuffer,
    config: ArabicOCRConfig
  ): Promise<OCRResult> {
    try {
      this.logger.info('Starting PDF processing for Arabic OCR');
      
      // Try multiple approaches for PDF text extraction
      const results: OCRResult[] = [];
      
      // Approach 1: Try direct text extraction first (for searchable PDFs)
      try {
        const textResult = await this.extractTextFromSearchablePDF(pdfBuffer);
        if (textResult.text.trim().length > 0) {
          this.logger.info('Successfully extracted text from searchable PDF');
          return {
            ...textResult,
            extractorName: 'arabic-pdf-text',
          };
        }
      } catch (error) {
        this.logger.debug({ error }, 'Direct text extraction failed, proceeding with OCR');
      }
      
      // Approach 2: Convert PDF pages to images and OCR each page
      const ocrResult = await this.extractTextFromPDFViaOCR(pdfBuffer, config);
      results.push(ocrResult);
      
      // Return the best result
      const bestResult = results.reduce((best, current) => 
        current.confidence > best.confidence ? current : best
      );
      
      this.logger.info({ 
        confidence: bestResult.confidence,
        textLength: bestResult.text.length,
        method: bestResult.extractorName 
      }, 'PDF Arabic OCR processing completed');
      
      return bestResult;
      
    } catch (error) {
      this.logger.error({ error }, 'PDF Arabic OCR extraction failed');
      return {
        text: '',
        confidence: 0,
        extractorName: 'arabic-ocr-pdf',
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * Extract text from searchable PDF (if available)
   */
  private async extractTextFromSearchablePDF(pdfBuffer: ArrayBuffer): Promise<OCRResult> {
    // This is a placeholder for PDF text extraction
    // In a real implementation, you would use a library like pdf-parse or pdf2pic
    // For now, we'll return empty to force OCR processing
    return {
      text: '',
      confidence: 0,
      extractorName: 'pdf-text-extraction',
    };
  }

  /**
   * Extract text from PDF by converting to images and running OCR
   */
  private async extractTextFromPDFViaOCR(
    pdfBuffer: ArrayBuffer,
    config: ArabicOCRConfig
  ): Promise<OCRResult> {
    try {
      // For this implementation, we'll treat the PDF as a single image
      // In a production environment, you would:
      // 1. Convert each PDF page to an image using pdf2pic or similar
      // 2. Run OCR on each page
      // 3. Combine the results
      
      this.logger.info('Converting PDF to images for OCR processing');
      
      // Simplified approach: treat entire PDF as image for OCR
      const result = await this.extractTextFromImage(pdfBuffer, {
        ...config,
        preprocessImage: true,
        enhanceForHandwriting: config.enhanceForHandwriting,
      });
      
      return {
        ...result,
        extractorName: 'arabic-pdf-ocr',
      };
      
    } catch (error) {
      this.logger.error({ error }, 'PDF OCR processing failed');
      return {
        text: '',
        confidence: 0,
        extractorName: 'arabic-pdf-ocr',
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * Configure Tesseract worker for optimal Arabic recognition
   */
  private async configureWorkerForArabic(worker: any, config: ArabicOCRConfig): Promise<void> {
    // Set page segmentation mode - PSM 6 is good for uniform block of text
    await worker.setParameters({
      tessedit_pageseg_mode: config.psm ?? PSM.SINGLE_UNIFORM_BLOCK,
      tessedit_char_whitelist: '',
      tessedit_char_blacklist: '',
      // Improve Arabic text recognition
      textord_really_old_xheight: '1',
      textord_min_xheight: '10',
      // Language-specific parameters for Arabic
      language_model_penalty_non_freq_dict_word: '0.1',
      language_model_penalty_non_dict_word: '0.15',
    });

    // Additional configuration for handwriting if enabled
    if (config.enhanceForHandwriting) {
      await worker.setParameters({
        tessedit_pageseg_mode: PSM.SINGLE_WORD,
        textord_really_old_xheight: '0',
        textord_min_xheight: '5',
        // More lenient parameters for handwriting
        language_model_penalty_non_freq_dict_word: '0.2',
        language_model_penalty_non_dict_word: '0.3',
      });
    }
  }

  /**
   * Preprocess image for better Arabic OCR results
   */
  private async preprocessImageForArabic(
    imageBuffer: Buffer,
    enhanceForHandwriting = false
  ): Promise<Buffer> {
    try {
      let sharpInstance = sharp(imageBuffer);
      
      // Get image metadata for better processing decisions
      const metadata = await sharpInstance.metadata();
      const width = metadata.width || 1000;
      const height = metadata.height || 1000;
      
      this.logger.debug({ 
        originalWidth: width, 
        originalHeight: height, 
        enhanceForHandwriting 
      }, 'Starting image preprocessing for Arabic OCR');

      if (enhanceForHandwriting) {
        // Advanced preprocessing for Arabic handwriting recognition
        sharpInstance = sharpInstance
          // Ensure minimum resolution for handwriting
          .resize({ 
            width: Math.max(width * 2, 3000), 
            height: Math.max(height * 2, 3000),
            fit: 'inside',
            withoutEnlargement: false 
          })
          .greyscale() // Convert to grayscale
          .normalize({ lower: 5, upper: 95 }) // Enhanced contrast normalization
          
          // Apply gaussian blur to reduce noise while preserving stroke structure
          .blur(0.3)
          
          // Sharpen to enhance stroke edges for handwriting
          .sharpen({ 
            sigma: 1.5, 
            flat: 1.2, 
            jagged: 2.0 
          })
          
          // Morphological operations for handwriting
          .threshold(140, { greyscale: false }) // Adaptive thresholding
          
          // Add border to prevent edge text cutoff
          .extend({
            top: 50,
            bottom: 50,
            left: 50,
            right: 50,
            background: { r: 255, g: 255, b: 255, alpha: 1 }
          });
          
      } else {
        // Optimized preprocessing for printed Arabic text
        sharpInstance = sharpInstance
          .resize({ 
            width: Math.max(width * 1.5, 2000),
            withoutEnlargement: true,
            fit: 'inside'
          })
          .greyscale()
          .normalize() // Standard contrast enhancement
          .sharpen({
            sigma: 1.0,
            flat: 1.0,
            jagged: 2.0
          })
          
          // Light gaussian blur to reduce scan artifacts
          .blur(0.2)
          
          // Clean thresholding for printed text
          .threshold(120)
          
          // Small border for edge protection
          .extend({
            top: 20,
            bottom: 20,
            left: 20,
            right: 20,
            background: { r: 255, g: 255, b: 255, alpha: 1 }
          });
      }

      const processedBuffer = await sharpInstance.png().toBuffer();
      
      // Log processing results
      const processedMetadata = await sharp(processedBuffer).metadata();
      this.logger.debug({
        processedWidth: processedMetadata.width,
        processedHeight: processedMetadata.height,
        sizeIncrease: processedBuffer.length / imageBuffer.length
      }, 'Image preprocessing completed');

      return processedBuffer;
      
    } catch (error) {
      this.logger.warn({ error }, 'Image preprocessing failed, using original');
      return imageBuffer;
    }
  }

  /**
   * Apply advanced noise reduction for scanned documents
   */
  private async applyNoiseReduction(imageBuffer: Buffer): Promise<Buffer> {
    try {
      return await sharp(imageBuffer)
        // Median filter effect using blur + sharpen combination
        .blur(0.5)
        .sharpen(1.0, 1.0, 1.5)
        
        // Morphological closing to connect broken strokes
        .threshold(128)
        .blur(0.3)
        .threshold(128)
        
        .png()
        .toBuffer();
        
    } catch (error) {
      this.logger.warn({ error }, 'Noise reduction failed');
      return imageBuffer;
    }
  }

  /**
   * Normalize Arabic text output
   */
  private normalizeArabicText(text: string): string {
    if (!text || typeof text !== 'string') {
      return '';
    }

    return text
      // Remove extra whitespace
      .replace(/\s+/g, ' ')
      .trim()
      // Normalize Arabic characters
      .replace(/ي/g, 'ی') // Normalize Yeh
      .replace(/ك/g, 'ک') // Normalize Kaf
      // Remove common OCR artifacts
      .replace(/[^\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF\s\d\.\,\!\?\-]/g, '')
      // Fix common spacing issues with Arabic text
      .replace(/\s+([\.،؛؟!])/g, '$1')
      .replace(/([\.،؛؟!])\s+/g, '$1 ');
  }

  /**
   * Get supported Arabic and related languages
   */
  static getSupportedArabicLanguages(): string[] {
    return [
      'ara', // Arabic
      'fas', // Persian/Farsi
      'urd', // Urdu
      'pus', // Pashto
      'kur', // Kurdish
      'uig', // Uyghur
      'eng', // English (for mixed documents)
    ];
  }

  /**
   * Get optimal language configuration for different document types
   */
  static getOptimalLanguageConfig(documentType: 'printed' | 'handwritten' | 'mixed' = 'mixed'): ArabicOCRConfig {
    const baseLanguages = ['ara', 'eng']; // Arabic + English for mixed content

    switch (documentType) {
      case 'printed':
        return {
          languages: baseLanguages,
          psm: PSM.SINGLE_UNIFORM_BLOCK,
          oem: OEM.LSTM_ONLY,
          preprocessImage: true,
          enhanceForHandwriting: false,
        };
      
      case 'handwritten':
        return {
          languages: baseLanguages,
          psm: PSM.SINGLE_WORD,
          oem: OEM.LSTM_ONLY,
          preprocessImage: true,
          enhanceForHandwriting: true,
        };
      
      case 'mixed':
      default:
        return {
          languages: baseLanguages,
          psm: PSM.AUTO,
          oem: OEM.LSTM_ONLY,
          preprocessImage: true,
          enhanceForHandwriting: false,
        };
    }
  }
}