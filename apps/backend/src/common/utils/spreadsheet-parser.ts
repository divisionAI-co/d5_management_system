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
export async function parseSpreadsheet(
  buffer: Buffer,
): Promise<ParsedSheet> {
  try {
    const workbook = new ExcelJS.Workbook();
    
    // Try to parse as Excel first
    // ExcelJS accepts Buffer, but TypeScript needs explicit type assertion
    try {
      await workbook.xlsx.load(buffer as any);
    } catch {
      // If Excel parsing fails, try CSV
      const { Readable } = await import('stream');
      const stream = Readable.from(buffer);
      await workbook.csv.read(stream);
    }
    
    if (workbook.worksheets.length === 0) {
      throw new BadRequestException(
        'Uploaded file does not contain any worksheets.',
      );
    }

    const worksheet = workbook.worksheets[0];
    
    if (!worksheet) {
      throw new BadRequestException(
        'Uploaded file does not contain any data.',
      );
    }

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
  } catch (error) {
    if (error instanceof BadRequestException) {
      throw error;
    }
    
    // Try parsing as CSV if Excel parsing fails
    try {
      return parseCSV(buffer);
    } catch (csvError) {
      throw new BadRequestException(
        `Failed to parse file. Please ensure it is a valid CSV or Excel file. ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }
}

/**
 * Parses CSV file manually
 */
async function parseCSV(buffer: Buffer): Promise<ParsedSheet> {
  const content = buffer.toString('utf-8');
  const lines = content.split('\n').map((line) => line.trim());
  
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

