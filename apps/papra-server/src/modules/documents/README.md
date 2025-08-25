# Arabic Document Processing System

This module provides comprehensive Arabic document processing capabilities, replacing the previous `@papra/lecture` package with specialized Arabic OCR and text processing services.

## 🌟 Features

### Enhanced Arabic OCR
- **Tesseract.js** with Arabic language optimization
- Support for multiple Arabic scripts and dialects
- Advanced image preprocessing for scanned documents
- Specialized handwriting recognition for Arabic text
- Multi-language support (Arabic + English/French)

### Arabic Text Processing
- Text normalization and standardization
- Arabic-specific character handling
- Diacritic processing and normalization
- Keyword extraction and analysis
- Language detection and confidence scoring

### Smart Search
- Arabic-aware full-text search (FTS5-like)
- Fuzzy matching for Arabic text variations
- Morphological analysis support
- Cross-language search capabilities
- Real-time indexing and search

### Document Types Supported
- **Images**: PNG, JPEG, WebP, GIF, BMP, TIFF
- **PDFs**: Both searchable and scanned documents
- **Handwritten documents** with specialized processing
- **Printed documents** with high accuracy OCR
- **Mixed content** (Arabic + Latin scripts)

## 🚀 Quick Start

### Basic Usage

```typescript
import { 
  extractDocumentText, 
  searchDocuments, 
  analyzeFileForProcessing 
} from './documents.services';

// Extract text from an Arabic document
const result = await extractDocumentText({
  file: uploadedFile,
  documentType: 'printed', // or 'handwritten', 'mixed'
  ocrLanguages: ['ara', 'eng'],
});

console.log('Extracted text:', result.text);
console.log('Confidence:', result.confidence);
console.log('Arabic words found:', result.analysis.arabicWordCount);
```

### Advanced Processing

```typescript
import { ArabicDocumentProcessorService } from './arabic-document-processor.service';

const processor = new ArabicDocumentProcessorService();

// Process with custom options
const result = await processor.processDocument(file, 'doc-123', {
  documentType: 'handwritten',
  enhanceForHandwriting: true,
  preprocessImage: true,
  enableSearch: true,
});

// Search processed documents
const searchResults = await processor.searchDocuments('البحث عن النص', {
  arabicAware: true,
  fuzzy: true,
});
```

## 📚 API Reference

### ArabicOCRService

Core OCR service with Arabic optimization:

```typescript
class ArabicOCRService {
  // Extract text from images
  extractTextFromImage(buffer: ArrayBuffer, config: ArabicOCRConfig): Promise<OCRResult>
  
  // Extract text from PDFs
  extractTextFromPDF(buffer: ArrayBuffer, config: ArabicOCRConfig): Promise<OCRResult>
  
  // Get supported languages
  static getSupportedArabicLanguages(): string[]
  
  // Get optimal configuration for document types
  static getOptimalLanguageConfig(type: 'printed' | 'handwritten' | 'mixed'): ArabicOCRConfig
}
```

### ArabicTextProcessingService

Text analysis and normalization:

```typescript
class ArabicTextProcessingService {
  // Comprehensive text analysis
  analyzeText(text: string): ArabicTextAnalysis
  
  // Prepare text for search
  prepareForSearch(text: string): SearchableText
  
  // Normalize Arabic text
  normalizeArabicText(text: string): string
  
  // Get processing recommendations
  getProcessingRecommendations(text: string): ProcessingRecommendations
}
```

### ArabicSearchService

Full-text search with Arabic support:

```typescript
class ArabicSearchService {
  // Index document for search
  indexDocument(document: IndexedDocument): Promise<void>
  
  // Search documents
  searchDocuments(query: SearchQuery): Promise<SearchResult[]>
  
  // Remove document from index
  removeDocument(documentId: string): void
  
  // Get search statistics
  getSearchStatistics(): SearchStatistics
}
```

## ⚙️ Configuration

### OCR Configuration

```typescript
interface ArabicOCRConfig {
  languages: string[];           // ['ara', 'eng', 'fas']
  psm?: PSM;                    // Page segmentation mode
  oem?: OEM;                    // OCR engine mode
  preprocessImage?: boolean;     // Enable image preprocessing
  enhanceForHandwriting?: boolean; // Handwriting optimization
}
```

### Document Types

- **`printed`**: High-quality printed documents (newspapers, books, official documents)
- **`handwritten`**: Handwritten Arabic text with specialized processing
- **`mixed`**: Documents containing both printed and handwritten text

### Supported Languages

| Code | Language | Script | Notes |
|------|----------|--------|-------|
| `ara` | Arabic | Arabic | Primary language |
| `fas` | Persian/Farsi | Arabic | Supported |
| `urd` | Urdu | Arabic | Supported |
| `pus` | Pashto | Arabic | Supported |
| `kur` | Kurdish | Arabic | Supported |
| `uig` | Uyghur | Arabic | Supported |
| `eng` | English | Latin | For mixed documents |
| `fra` | French | Latin | For mixed documents |

## 🎯 Performance Optimization

### Image Preprocessing

The system applies advanced preprocessing for optimal OCR results:

- **Resolution enhancement** for low-quality scans
- **Noise reduction** using morphological operations
- **Contrast normalization** for better character recognition
- **Skew correction** for rotated documents
- **Border padding** to prevent edge text cutoff

### Handwriting Recognition

Specialized processing for Arabic handwriting:

- **Higher resolution processing** (3000px minimum width)
- **Enhanced sharpening** to define stroke edges
- **Adaptive thresholding** for varying ink intensity
- **Morphological operations** to connect broken strokes
- **Relaxed OCR parameters** for handwriting variations

### Search Optimization

- **Real-time indexing** with inverted index structure
- **N-gram analysis** for partial matching
- **Arabic root-based matching** (simplified)
- **Relevance scoring** with Arabic text weighting
- **Memory-efficient** search with configurable limits

## 🧪 Testing

Run the test suite:

```bash
pnpm test arabic-ocr.test.ts
```

### Test Coverage

- ✅ Arabic text normalization
- ✅ Text analysis and language detection
- ✅ Search indexing and retrieval
- ✅ OCR configuration optimization
- ✅ End-to-end document processing
- ✅ Error handling and edge cases

## 🔧 Migration from @papra/lecture

The new system replaces `@papra/lecture` with enhanced Arabic-specific capabilities:

### Before (lecture package):
```typescript
import { extractTextFromFile } from '@papra/lecture';

const result = await extractTextFromFile({ 
  file, 
  config: { tesseract: { languages: ['ara'] } } 
});
```

### After (Arabic OCR system):
```typescript
import { extractDocumentText } from './documents.services';

const result = await extractDocumentText({
  file,
  documentType: 'mixed',
  ocrLanguages: ['ara', 'eng'],
});
```

### Key Improvements

1. **Arabic-specific optimization** vs generic text extraction
2. **Handwriting recognition** for Arabic scripts
3. **Advanced preprocessing** for scanned documents
4. **Search integration** with Arabic-aware indexing
5. **Better error handling** and confidence scoring
6. **Multi-dialect support** for Arabic variants

## 📊 Monitoring and Logging

The system provides comprehensive logging:

```typescript
// Log levels and events
logger.info('Document processing started', { documentId, fileType, languages });
logger.debug('Image preprocessing completed', { originalSize, processedSize });
logger.warn('Low confidence OCR result', { confidence, documentId });
logger.error('OCR processing failed', { error, documentId, fileName });
```

### Metrics Tracked

- Processing time per document
- OCR confidence scores
- Language detection accuracy
- Search query performance
- Error rates by document type
- Memory usage patterns

## 🔒 Security Considerations

- **Input validation** for all file types and sizes
- **Memory management** for large document processing
- **Resource limits** to prevent DoS attacks
- **Sanitized text output** to prevent injection attacks
- **Secure temporary file handling** during processing

## 🚀 Future Enhancements

### Planned Features

1. **Neural Arabic OCR** integration for better accuracy
2. **Document layout analysis** for complex documents
3. **Arabic spell checking** and correction
4. **Semantic search** with Arabic embeddings
5. **Batch processing** for multiple documents
6. **Real-time collaboration** features
7. **Export capabilities** (searchable PDFs)

### Performance Improvements

1. **Parallel page processing** for multi-page PDFs
2. **Caching mechanisms** for repeated processing
3. **GPU acceleration** for image preprocessing
4. **Distributed processing** for large document sets

---

## 📞 Support

For issues and questions related to Arabic document processing:

1. Check the test files for usage examples
2. Review the error logs for debugging information
3. Ensure your documents meet the supported format requirements
4. Verify that Arabic language models are properly loaded

The system is designed to handle most Arabic document types with high accuracy while providing detailed feedback for optimization and troubleshooting.