import type { Logger } from '@crowlog/logger';
import { Buffer } from 'node:buffer';
import { createWorker, PSM, OEM } from 'tesseract.js';
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
   * Extract text from image with enhanced preprocessing and fallback
   */
  async extractTextFromImage(
    imageBuffer: ArrayBuffer | Buffer,
    languages: string[] = ['ara', 'eng']
  ): Promise<SimpleOCRResult> {
    const buffer = imageBuffer instanceof ArrayBuffer ? Buffer.from(imageBuffer) : imageBuffer;
    
    try {
      this.logger.info({ languages, bufferSize: buffer.length }, 'Starting enhanced OCR extraction');

      // Enhanced image preprocessing
      const processedBuffer = await this.basicImageProcessing(buffer);

      // Try with optimized settings first
      let bestResult = await this.runOCRWithSettings(processedBuffer, languages, 'optimized');
      
      // If confidence is low, try with different settings
      if (bestResult.confidence < 70) {
        this.logger.info({ confidence: bestResult.confidence }, 'Low confidence, trying alternative settings');
        
        const alternativeResult = await this.runOCRWithSettings(processedBuffer, languages, 'alternative');
        
        // Use the result with higher confidence
        if (alternativeResult.confidence > bestResult.confidence) {
          bestResult = alternativeResult;
          this.logger.info({ confidence: bestResult.confidence }, 'Using alternative settings result');
        }
      }

      return bestResult;

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
   * Run OCR with specific settings
   */
  private async runOCRWithSettings(
    processedBuffer: Buffer, 
    languages: string[], 
    settingsType: 'optimized' | 'alternative'
  ): Promise<SimpleOCRResult> {
    const worker = await createWorker(languages);
    
    try {
      if (settingsType === 'optimized') {
        // Configure Tesseract for better Arabic OCR
        await worker.setParameters({
          tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyzءآأؤإئابةتثجحخدذرزسشصضطظعغفقكلمنهوىيًٌٍَُِّْٰٱٲٳٴٵٶٷٸٹٺٻټٽپٿڀځڂڃڄڅچڇڈډڊڋڌڍڎڏڐڑڒړڔڕږڗژڙښڛڜڝڞڟڠڡڢڣڤڥڦڧڨکڪګگڰڱڲڳڴڵڶڷڸڹںڻڼڽھڿہۂۃۄۅۆۇۈۉۊۋیۍێۏېۑےۓەۖۗۘۙۚۛۜ۝۞ۣ۟۠ۡۢۤۥۦۧۨ۩۪ۭ۫۬ۮۯ۰۱۲۳۴۵۶۷۸۹',
          tessedit_pageseg_mode: PSM.UNIFORM_BLOCK_OF_TEXT, // Uniform block of text
          tessedit_ocr_engine_mode: OEM.DEFAULT, // Default, based on what is available
          preserve_interword_spaces: '1',
          textord_heavy_nr: '1', // More aggressive noise removal
          textord_min_linesize: '2.5', // Minimum line size
        });
      } else {
        // Alternative settings for better accuracy
        await worker.setParameters({
          tessedit_pageseg_mode: PSM.FULLY_AUTOMATIC, // Fully automatic page segmentation
          tessedit_ocr_engine_mode: OEM.LSTM_ONLY, // Neural nets LSTM engine
          preserve_interword_spaces: '1',
          textord_heavy_nr: '0', // Less aggressive noise removal
          textord_min_linesize: '1.5', // Smaller minimum line size
        });
      }
      
      this.logger.info(`Running OCR recognition with ${settingsType} settings`);
      const { data: { text, confidence } } = await worker.recognize(processedBuffer);
      
      this.logger.info({ confidence, textLength: text.length, settingsType }, 'OCR recognition completed');
      
      return {
        text: text.trim(),
        confidence,
        extractorName: 'simple-arabic-ocr',
      };

    } finally {
      await worker.terminate();
    }
  }

  /**
   * Enhanced image processing optimized for Arabic OCR
   */
  private async basicImageProcessing(imageBuffer: Buffer): Promise<Buffer> {
    try {
      this.logger.debug('Starting enhanced image processing for Arabic OCR');
      
      // Get image metadata
      const metadata = await sharp(imageBuffer).metadata();
      this.logger.debug({ 
        width: metadata.width, 
        height: metadata.height, 
        format: metadata.format 
      }, 'Image metadata');

      // Enhanced preprocessing optimized for Arabic text
      const processedBuffer = await sharp(imageBuffer)
        // Resize to optimal OCR size (higher resolution for better accuracy)
        .resize({ 
          width: Math.min(Math.max(metadata.width || 1500, 1500), 4000),
          withoutEnlargement: true,
          fit: 'inside'
        })
        // Convert to grayscale for better OCR
        .greyscale()
        // Enhance contrast more aggressively for Arabic text
        .normalize()
        // Apply slight sharpening to improve text clarity
        .sharpen({ sigma: 0.5, m1: 1, m2: 0.5 })
        // Apply noise reduction to clean up the image
        .median(1)
        // Enhance contrast further
        .linear(1.2, -0.1)
        // Convert to PNG for consistency
        .png()
        .toBuffer();

      this.logger.debug({ 
        originalSize: imageBuffer.length, 
        processedSize: processedBuffer.length 
      }, 'Enhanced image processing completed');

      return processedBuffer;

    } catch (error) {
      this.logger.warn({ error }, 'Enhanced image processing failed, using original');
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