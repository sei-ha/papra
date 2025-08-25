# OCR Improvements and File Size Limit Fixes

## Overview

This document outlines the improvements made to address two main issues:

1. **File Size Limit Error**: Documents larger than 10MB were being rejected
2. **Poor OCR Quality**: Arabic text extraction had low confidence (59%) and poor quality

## Changes Made

### 1. File Size Limit Increase

**File**: `src/modules/documents/storage/document-storage.config.ts`

- **Before**: Default limit was 10MB (`10 * 1024 * 1024`)
- **After**: Default limit is now 100MB (`100 * 1024 * 1024`)

This change allows:
- Free plan: Up to 100MB per file (configurable via `DOCUMENT_STORAGE_MAX_UPLOAD_SIZE`)
- Plus/Family plans: Up to 100MB per file (as per plan limits)

### 2. Enhanced OCR Processing

**File**: `src/modules/documents/simple-arabic-ocr.service.ts`

#### Image Preprocessing Improvements:
- **Higher Resolution**: Increased minimum resolution from 1000px to 1500px
- **Maximum Resolution**: Increased from 3000px to 4000px for better detail
- **Sharpening**: Added `sharpen()` filter to improve text clarity
- **Noise Reduction**: Added `median()` filter to clean up images
- **Enhanced Contrast**: Added `linear()` adjustment for better text/background separation

#### Tesseract Configuration Improvements:
- **Arabic Character Whitelist**: Added comprehensive Arabic character set
- **Page Segmentation**: Optimized for uniform text blocks
- **Noise Removal**: More aggressive noise removal for Arabic text
- **Fallback Mechanism**: If confidence < 70%, tries alternative settings

#### Fallback OCR Settings:
- **Primary**: Optimized for Arabic text with character whitelist
- **Alternative**: Uses LSTM neural engine with different segmentation

## Environment Configuration

### Option 1: Use Default (Recommended)
The default limit is now 100MB, so no environment variable changes are needed.

### Option 2: Custom Limit
If you need a different limit, set the environment variable:

```bash
# For 200MB limit
export DOCUMENT_STORAGE_MAX_UPLOAD_SIZE=209715200

# For unlimited (0 = no limit)
export DOCUMENT_STORAGE_MAX_UPLOAD_SIZE=0
```

### Option 3: Docker Environment
Add to your docker-compose.yml or Dockerfile:

```yaml
environment:
  - DOCUMENT_STORAGE_MAX_UPLOAD_SIZE=209715200  # 200MB
```

## Testing the Improvements

### 1. Test OCR Functionality
```bash
cd apps/papra-server
node test-ocr-improvements.js
```

### 2. Test File Upload
Try uploading a document larger than 10MB (previously failed) and smaller than 100MB.

### 3. Monitor OCR Quality
Check the logs for improved confidence scores:
- **Before**: ~59% confidence
- **Expected After**: 70-90% confidence for clear Arabic text

## Expected Results

### File Size Issues:
- ✅ `.bmb` files and other large documents should now upload successfully
- ✅ No more "Document size too large" errors for files under 100MB

### OCR Quality:
- ✅ Higher confidence scores (70-90% vs previous 59%)
- ✅ Better Arabic text recognition
- ✅ Improved handling of mixed Arabic/English content
- ✅ Fallback processing for difficult images

## Troubleshooting

### If OCR quality is still poor:
1. Check image quality - ensure documents are clear and well-lit
2. Verify Arabic language packs are installed in Tesseract
3. Check logs for any preprocessing errors

### If file upload still fails:
1. Verify the environment variable is set correctly
2. Check that the file is actually under the limit
3. Restart the application after changing environment variables

## Performance Impact

- **Processing Time**: Slightly increased due to enhanced preprocessing
- **Memory Usage**: Minimal increase due to higher resolution processing
- **Storage**: No change in storage requirements

## Rollback

If you need to rollback these changes:

1. **File Size Limit**: Set `DOCUMENT_STORAGE_MAX_UPLOAD_SIZE=10485760` (10MB)
2. **OCR Improvements**: Revert the changes in `simple-arabic-ocr.service.ts`

## Support

For issues or questions about these improvements, check the logs for detailed error messages and confidence scores.