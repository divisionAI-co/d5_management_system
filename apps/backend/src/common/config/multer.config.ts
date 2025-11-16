import { MulterModuleOptions } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import path from 'path';

/**
 * Multer configuration with security limits
 */
export const multerConfig: MulterModuleOptions = {
  storage: memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit for CSV/Excel files
    files: 1, // Only allow single file uploads
  },
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = [
      'text/csv',
      'application/vnd.ms-excel', // .xls
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/csv',
      'text/x-csv',
      'application/x-csv',
    ];
    
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          'Invalid file type. Only CSV and Excel files are allowed.',
        ),
        false,
      );
    }
  },
};

/**
 * Validates file upload with size and type checks
 */
export function validateFileUpload(
  file: Express.Multer.File | undefined,
  maxSizeMB: number = 10,
): void {
  if (!file) {
    throw new Error('A file must be provided.');
  }

  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  if (file.size > maxSizeBytes) {
    throw new Error(
      `File size exceeds ${maxSizeMB}MB limit. File size: ${(file.size / 1024 / 1024).toFixed(2)}MB`,
    );
  }

  // Additional MIME type validation (double-check)
  const allowedMimeTypes = [
    'text/csv',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/csv',
    'text/x-csv',
    'application/x-csv',
  ];

  const allowedExtensions = ['.csv', '.xlsx', '.xls'];

  const extension = path.extname(file.originalname).toLowerCase();
  
  if (
    !allowedMimeTypes.includes(file.mimetype) &&
    !allowedExtensions.includes(extension)
  ) {
    throw new Error('Invalid file type. Only CSV and Excel files are allowed.');
  }
}


