/**
 * PDF content extraction using pdfjs-dist
 */

import * as pdfjsLib from 'pdfjs-dist'
import type { PDFContent, PDFMetadata } from './types'

// Configure PDF.js worker
// In Chrome extension, we need to use the bundled worker or inline it
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString()

/**
 * Extract text content from a PDF file
 */
export async function extractFromPDF(source: string | ArrayBuffer): Promise<PDFContent | null> {
  try {
    const loadingTask = pdfjsLib.getDocument(source)
    const pdf = await loadingTask.promise

    const metadata = await extractPDFMetadata(pdf)
    const pageTexts: string[] = []

    // Extract text from each page
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i)
      const textContent = await page.getTextContent()

      const pageText = textContent.items
        .map((item) => {
          if ('str' in item) {
            return item.str
          }
          return ''
        })
        .join(' ')

      pageTexts.push(pageText.trim())
    }

    const content = pageTexts.join('\n\n')
    const title = metadata.title || 'Untitled PDF'

    return {
      title,
      content,
      pageCount: pdf.numPages,
      metadata,
    }
  } catch (error) {
    console.error('[PDFExtractor] Failed to extract PDF:', error)
    return null
  }
}

/**
 * Extract metadata from PDF
 */
async function extractPDFMetadata(
  pdf: pdfjsLib.PDFDocumentProxy
): Promise<PDFMetadata> {
  try {
    const metadata = await pdf.getMetadata()
    const info = metadata.info as Record<string, unknown>

    return {
      title: typeof info.Title === 'string' ? info.Title : undefined,
      author: typeof info.Author === 'string' ? info.Author : undefined,
      subject: typeof info.Subject === 'string' ? info.Subject : undefined,
      creator: typeof info.Creator === 'string' ? info.Creator : undefined,
      producer: typeof info.Producer === 'string' ? info.Producer : undefined,
      creationDate: typeof info.CreationDate === 'string' ? info.CreationDate : undefined,
      modificationDate: typeof info.ModDate === 'string' ? info.ModDate : undefined,
    }
  } catch {
    return {}
  }
}

/**
 * Extract PDF from URL
 */
export async function extractFromPDFUrl(url: string): Promise<PDFContent | null> {
  try {
    const response = await fetch(url)
    const arrayBuffer = await response.arrayBuffer()
    return extractFromPDF(arrayBuffer)
  } catch (error) {
    console.error('[PDFExtractor] Failed to fetch PDF:', error)
    return null
  }
}

/**
 * Extract PDF from File object
 */
export async function extractFromPDFFile(file: File): Promise<PDFContent | null> {
  try {
    const arrayBuffer = await file.arrayBuffer()
    return extractFromPDF(arrayBuffer)
  } catch (error) {
    console.error('[PDFExtractor] Failed to read PDF file:', error)
    return null
  }
}
