import type { Logger } from '@crowlog/logger';
import { Buffer } from 'node:buffer';
import { createWorker } from 'tesseract.js';
import sharp from 'sharp';
import { createLogger } from '../shared/logger/logger';

export interface SimpleOCRResult {
  text: string;
  confidence: number;
  extractorName: string;
  error?: Error;
}

/**
 * Simplified Arabic OCR Service that actually works
 * Focus on functionality over fancy preprocessing
 */
export class SimpleArabicOCRService {
  private logger: Logger;

  constructor(logger?: Logger) {
    this.logger = logger ?? createLogger({ namespace: 'simple-arabic-ocr' });
  }

  /**
   * Extract text from image with basic preprocessing
   */
  async extractTextFromImage(
    imageBuffer: ArrayBuffer | Buffer,
    languages: string[] = ['ara', 'eng']
  ): Promise<SimpleOCRResult> {
    const buffer = imageBuffer instanceof ArrayBuffer ? Buffer.from(imageBuffer) : imageBuffer;
    
    try {
      this.logger.info({ languages, bufferSize: buffer.length }, 'Starting OCR extraction');

      // Basic image preprocessing that actually works
      const processedBuffer = await this.basicImageProcessing(buffer);

      this.logger.info('Creating Tesseract worker');
      const worker = await createWorker(languages);
      
      this.logger.info('Running OCR recognition');
      const { data: { text, confidence } } = await worker.recognize(processedBuffer);
      
      this.logger.info({ confidence, textLength: text.length }, 'OCR recognition completed');
      await worker.terminate();

      return {
        text: text.trim(),
        confidence,
        extractorName: 'simple-arabic-ocr',
      };

    } catch (error) {
      this.logger.error({ error, languages }, 'OCR extraction failed');
      return {
        text: '',
        confidence: 0,
        extractorName: 'simple-arabic-ocr',
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * Basic image processing that doesn't break
   */
  private async basicImageProcessing(imageBuffer: Buffer): Promise<Buffer> {
    try {
      this.logger.debug('Starting basic image processing');
      
      // Get image metadata
      const metadata = await sharp(imageBuffer).metadata();
      this.logger.debug({ 
        width: metadata.width, 
        height: metadata.height, 
        format: metadata.format 
      }, 'Image metadata');

      // Simple, reliable preprocessing
      const processedBuffer = await sharp(imageBuffer)
        // Ensure reasonable size (not too small, not too large)
        .resize({ 
          width: Math.min(Math.max(metadata.width || 1000, 1000), 3000),
          withoutEnlargement: true,
          fit: 'inside'
        })
        // Convert to grayscale for better OCR
        .greyscale()
        // Enhance contrast
        .normalize()
        // Convert to PNG for consistency
        .png()
        .toBuffer();

      this.logger.debug({ 
        originalSize: imageBuffer.length, 
        processedSize: processedBuffer.length 
      }, 'Image processing completed');

      return processedBuffer;

    } catch (error) {
      this.logger.warn({ error }, 'Image processing failed, using original');
      return imageBuffer;
    }
  }

  /**
   * Get optimal language configuration for Arabic documents
   */
  static getLanguagesForDocumentType(documentType: 'printed' | 'handwritten' | 'mixed' = 'mixed'): string[] {
    switch (documentType) {
      case 'printed':
        return ['ara', 'eng']; // Arabic + English for printed docs
      case 'handwritten':
        return ['ara']; // Arabic only for handwriting (more focused)
      case 'mixed':
      default:
        return ['ara', 'eng']; // Both languages for mixed content
    }
  }

  /**
   * Force Arabic languages even if the frontend sends wrong languages
   */
  static forceArabicLanguages(inputLanguages?: string[]): string[] {
    // If no languages specified, use Arabic + English
    if (!inputLanguages || inputLanguages.length === 0) {
      return ['ara', 'eng'];
    }

    // If only English is specified, add Arabic as primary
    if (inputLanguages.length === 1 && inputLanguages[0] === 'eng') {
      return ['ara', 'eng'];
    }

    // If Arabic is already included, use as-is
    if (inputLanguages.includes('ara')) {
      return inputLanguages;
    }

    // Otherwise, add Arabic as primary language
    return ['ara', ...inputLanguages];
  }

  /**
   * Test OCR functionality with a simple text
   */
  async testOCR(): Promise<boolean> {
    try {
      this.logger.info('Testing OCR functionality');
      
      // Create a simple test image buffer (1x1 white pixel)
      const testBuffer = await sharp({
        create: {
          width: 100,
          height: 50,
          channels: 3,
          background: { r: 255, g: 255, b: 255 }
        }
      })
      .png()
      .toBuffer();

      const result = await this.extractTextFromImage(testBuffer, ['eng']);
      this.logger.info({ success: !result.error }, 'OCR test completed');
      
      return !result.error;
    } catch (error) {
      this.logger.error({ error }, 'OCR test failed');
      return false;
    }
  }
}