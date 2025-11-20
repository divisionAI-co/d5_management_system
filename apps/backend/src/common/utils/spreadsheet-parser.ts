import ExcelJS from 'exceljs';
import { BadRequestException } from '@nestjs/common';

export interface ParsedSheet {
  headers: string[];
  rows: Record<string, any>[];
}

/**
 * Safely parses spreadsheet files (CSV or Excel) using ExcelJS
 * Replaces vulnerable xlsx library
 */
/**
 * Helper function to extract data from a worksheet
 */
function extractWorksheetData(worksheet: ExcelJS.Worksheet): ParsedSheet {
    // Extract headers from first row
    const headerRow = worksheet.getRow(1);
    const headers: string[] = [];
    
    headerRow.eachCell((cell, colNumber) => {
      const value = cell.value?.toString().trim() || '';
      headers[colNumber - 1] = value;
    });

    if (headers.length === 0 || headers.every((h) => !h)) {
      throw new BadRequestException(
        'The uploaded file does not contain a header row.',
      );
    }

    // Extract data rows
    const rows: Record<string, any>[] = [];
    
    worksheet.eachRow((row, rowNumber) => {
      // Skip header row
      if (rowNumber === 1) {
        return;
      }

      const rowData: Record<string, any> = {};
      row.eachCell((cell, colNumber) => {
        const header = headers[colNumber - 1];
        if (header) {
          // Get cell value, handling different types
          let value: any = cell.value;
          
          if (cell.value === null || cell.value === undefined) {
            value = '';
          } else if (typeof cell.value === 'object' && 'result' in cell.value) {
            // Formula result
            value = (cell.value as any).result?.toString() || '';
          } else {
            value = cell.value.toString();
          }
          
          rowData[header] = value;
        }
      });
      
      // Only add row if it has at least one non-empty value
      if (Object.values(rowData).some((v) => v !== '' && v !== null && v !== undefined)) {
        rows.push(rowData);
      }
    });

    return { headers: headers.filter(Boolean), rows };
}

/**
 * Detects if buffer is likely an Excel file based on magic bytes
 */
function isExcelFile(buffer: Buffer): boolean {
  // Excel files start with specific magic bytes
  // .xlsx files: PK (ZIP signature, since .xlsx is a ZIP archive)
  // .xls files: D0 CF 11 E0 A1 B1 1A E1 (OLE2 signature)
  if (buffer.length < 8) return false;
  
  // Check for .xlsx (ZIP signature)
  if (buffer[0] === 0x50 && buffer[1] === 0x4B) {
    return true;
  }
  
  // Check for .xls (OLE2 signature)
  if (buffer[0] === 0xD0 && buffer[1] === 0xCF && buffer[2] === 0x11 && buffer[3] === 0xE0) {
    return true;
  }
  
  return false;
}

export async function parseSpreadsheet(
  buffer: Buffer,
): Promise<ParsedSheet> {
  // Detect file type and parse accordingly
  const isExcel = isExcelFile(buffer);
  
  if (isExcel) {
    // Try to parse as Excel first
    try {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer as any);
      
      if (workbook.worksheets.length === 0) {
        // Excel file has no worksheets, try CSV as fallback
        throw new Error('No worksheets found, trying CSV fallback');
      }

      const worksheet = workbook.worksheets[0];
      
      if (!worksheet) {
        throw new Error('Worksheet is null, trying CSV fallback');
      }

      return extractWorksheetData(worksheet);
    } catch (excelError) {
      // If Excel parsing fails, always try CSV as fallback
      // (file might be misidentified, corrupted, or in an unsupported format)
      // Only throw immediately if it's a header row error (which means Excel parsed but has issues)
      if (excelError instanceof BadRequestException && 
          excelError.message.includes('header row')) {
        throw excelError;
    }
    
      // For all other Excel errors, fall through to CSV parsing
      // This handles cases where:
      // - File is detected as Excel but can't be parsed (corrupted, old format, etc.)
      // - File is actually CSV but has Excel magic bytes
      // - Excel file has no worksheets
    }
  }
  
  // CSV parsing (for non-Excel files, or as fallback for failed Excel parsing)
  try {
    // Try CSV parsing with ExcelJS first
    const csvWorkbook = new ExcelJS.Workbook();
    const { Readable } = await import('stream');
    
    // Remove BOM and ensure proper encoding
    const cleanBuffer = removeBOM(buffer);
    const stream = Readable.from(cleanBuffer);
    
    await csvWorkbook.csv.read(stream);
    
    if (csvWorkbook.worksheets.length === 0) {
      throw new BadRequestException(
        'Uploaded file does not contain any data.',
      );
    }
    
    const worksheet = csvWorkbook.worksheets[0];
    
    if (!worksheet) {
      throw new BadRequestException(
        'Uploaded file does not contain any data.',
      );
    }
    
    return extractWorksheetData(worksheet);
  } catch (csvError) {
    // If ExcelJS CSV parsing fails, try manual CSV parsing
    if (csvError instanceof BadRequestException) {
      // If it's already a BadRequestException, try manual parsing before throwing
      try {
        return parseCSV(buffer);
      } catch {
        throw csvError;
      }
    }
    
    // For other errors, try manual CSV parsing
    try {
      return parseCSV(buffer);
    } catch (finalError) {
      if (finalError instanceof BadRequestException) {
        throw finalError;
      }
      throw new BadRequestException(
        `Failed to parse file. Please ensure it is a valid CSV or Excel file. ${finalError instanceof Error ? finalError.message : 'Unknown error'}`,
      );
    }
  }
}

/**
 * Detects and removes BOM (Byte Order Mark) from buffer
 */
function removeBOM(buffer: Buffer): Buffer {
  // Check for UTF-8 BOM (EF BB BF)
  if (buffer.length >= 3 && buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
    return buffer.slice(3);
  }
  // Check for UTF-16 LE BOM (FF FE)
  if (buffer.length >= 2 && buffer[0] === 0xFF && buffer[1] === 0xFE) {
    // Convert UTF-16 LE to UTF-8
    return Buffer.from(buffer.slice(2).toString('utf16le'), 'utf-8');
  }
  // Check for UTF-16 BE BOM (FE FF)
  if (buffer.length >= 2 && buffer[0] === 0xFE && buffer[1] === 0xFF) {
    // Convert UTF-16 BE to UTF-8 (need to swap bytes)
    const utf16Buffer = buffer.slice(2);
    const swapped = Buffer.alloc(utf16Buffer.length);
    for (let i = 0; i < utf16Buffer.length; i += 2) {
      if (i + 1 < utf16Buffer.length) {
        swapped[i] = utf16Buffer[i + 1];
        swapped[i + 1] = utf16Buffer[i];
      } else {
        swapped[i] = utf16Buffer[i];
      }
    }
    return Buffer.from(swapped.toString('utf16le'), 'utf-8');
  }
  return buffer;
}

/**
 * Parses CSV file manually with proper encoding handling
 */
async function parseCSV(buffer: Buffer): Promise<ParsedSheet> {
  // Remove BOM and ensure UTF-8 encoding
  const cleanBuffer = removeBOM(buffer);
  let content: string;
  
  try {
    // Try UTF-8 first
    content = cleanBuffer.toString('utf-8');
  } catch {
    try {
      // Fallback to latin1 if UTF-8 fails
      content = buffer.toString('latin1');
    } catch {
      throw new BadRequestException('Unable to decode file. Please ensure it is a valid UTF-8 or ASCII CSV file.');
    }
  }
  
  // Normalize line endings (handle \r\n, \n, \r)
  content = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = content.split('\n').filter(line => line.trim().length > 0);
  
  if (lines.length === 0) {
    throw new BadRequestException('File is empty.');
  }

  // Parse CSV (simple implementation)
  // For production, consider using a CSV parsing library
  const parseCSVLine = (line: string): string[] => {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());
    
    return values;
  };

  const headers = parseCSVLine(lines[0]).map((h) => h.replace(/^"|"$/g, ''));
  
  if (headers.length === 0) {
    throw new BadRequestException(
      'The uploaded file does not contain a header row.',
    );
  }

  const rows: Record<string, any>[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i]) continue;
    
    const values = parseCSVLine(lines[i]).map((v) => v.replace(/^"|"$/g, ''));
    const rowData: Record<string, any> = {};
    
    headers.forEach((header, index) => {
      rowData[header] = values[index] || '';
    });
    
    // Only add row if it has at least one non-empty value
    if (Object.values(rowData).some((v) => v !== '' && v !== null && v !== undefined)) {
      rows.push(rowData);
    }
  }

  return { headers, rows };
}

