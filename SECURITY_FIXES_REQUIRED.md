# Security Fixes Required - Action Plan

**Priority**: 🔴 **CRITICAL** - Fix Before Production Deployment  
**Estimated Time**: 2-4 hours

---

## Immediate Actions Required

### 1. Update Dependencies (CRITICAL - 30 minutes)

Run these commands in `apps/backend`:

```bash
cd apps/backend

# Update vulnerable packages
npm install puppeteer@24.30.0 nodemailer@7.0.10 @nestjs/swagger@11.2.2

# Try to auto-fix other issues
npm audit fix

# Verify no critical vulnerabilities remain
npm audit
```

**Expected Result**: 
- puppeteer: 21.7.0 → 24.30.0 ✅
- nodemailer: 6.9.7 → 7.0.10 ✅
- @nestjs/swagger: 7.1.17 → 11.2.2 ✅
- High severity vulnerabilities reduced from 6 to 0

**Note**: xlsx library has no fix available. See section 3 below.

---

### 2. Add File Upload Size Limits (CRITICAL - 1 hour)

#### 2.1 Update Multer Configuration

Create or update `apps/backend/src/common/config/multer.config.ts`:

```typescript
import { MulterModuleOptions } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';

export const multerConfig: MulterModuleOptions = {
  storage: memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB for CSV files
    files: 1,
  },
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ];
    
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only CSV and Excel files are allowed.'), false);
    }
  },
};
```

#### 2.2 Add Size Validation in Services

Update all import services (contacts, leads, opportunities, etc.):

```typescript
// In each upload method, add:
async uploadXxxImport(file: Express.Multer.File): Promise<XxxUploadResult> {
  if (!file) {
    throw new BadRequestException('A CSV file must be provided.');
  }

  // File size check
  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  if (file.size > MAX_FILE_SIZE) {
    throw new BadRequestException(
      `File size exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit.`,
    );
  }

  // MIME type validation (double-check)
  const allowedMimeTypes = ['text/csv', 'application/vnd.ms-excel', ...];
  if (!allowedMimeTypes.includes(file.mimetype)) {
    throw new BadRequestException('Invalid file type.');
  }

  // Existing code...
}
```

#### 2.3 Sanitize Filenames

Add filename sanitization utility:

```typescript
// apps/backend/src/common/utils/file-sanitizer.ts
import path from 'path';

export function sanitizeFilename(filename: string): string {
  // Remove path components to prevent directory traversal
  const basename = path.basename(filename);
  
  // Remove or replace dangerous characters
  return basename
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .substring(0, 255); // Limit length
}
```

Use in upload handlers:

```typescript
const sanitizedFilename = sanitizeFilename(file.originalname);
```

---

### 3. Address XLSX Vulnerability (HIGH - 2 hours)

**Issue**: xlsx library has no fix available for prototype pollution and ReDoS vulnerabilities.

#### Option A: Switch to ExcelJS (RECOMMENDED)

```bash
npm uninstall xlsx
npm install exceljs
```

Then update all import services to use ExcelJS instead of xlsx. ExcelJS has better security and performance.

#### Option B: Isolate XLSX Parsing (TEMPORARY FIX)

If you must keep xlsx, implement strict validation:

```typescript
// Create a wrapper with strict validation
import * as XLSX from 'xlsx';

export function parseSpreadsheetSafe(buffer: Buffer) {
  // Limit parsing to prevent ReDoS
  if (buffer.length > 10 * 1024 * 1024) {
    throw new Error('File too large');
  }

  // Use strict options
  const workbook = XLSX.read(buffer, {
    type: 'buffer',
    cellDates: false,
    cellNF: false,
    cellStyles: false,
    dense: false,
    raw: false,
  });

  // Validate result structure
  if (!workbook || !workbook.SheetNames) {
    throw new Error('Invalid spreadsheet format');
  }

  return workbook;
}
```

**Recommendation**: Use Option A (ExcelJS) for long-term security.

---

### 4. Implement CSRF Protection (MEDIUM - 1 hour)

#### 4.1 Install Dependencies

```bash
npm install csurf
npm install --save-dev @types/csurf
```

#### 4.2 Add CSRF Token Endpoint

```typescript
// apps/backend/src/modules/auth/auth.controller.ts
import { CsrfProtection } from '@nestjs/csrf';

@Public()
@Get('csrf-token')
getCsrfToken(@Req() req: any) {
  return { csrfToken: req.csrfToken() };
}
```

#### 4.3 Add CSRF Guard

```typescript
// apps/backend/src/common/guards/csrf.guard.ts
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

@Injectable()
export class CsrfGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    
    // Skip CSRF for GET requests
    if (request.method === 'GET') {
      return true;
    }

    // Validate CSRF token
    const token = request.headers['x-csrf-token'] || request.body?.csrfToken;
    const sessionToken = (request as any).csrfToken?.();

    if (!token || token !== sessionToken) {
      throw new UnauthorizedException('Invalid CSRF token');
    }

    return true;
  }
}
```

#### 4.4 Update Frontend

```typescript
// apps/frontend/src/lib/api/client.ts
// Add CSRF token to all requests
const csrfToken = await getCsrfToken(); // Fetch from /auth/csrf-token

axios.defaults.headers.common['X-CSRF-Token'] = csrfToken;
```

**Note**: For state-changing operations, CSRF tokens provide additional security beyond SameSite cookies.

---

## Testing After Fixes

### 1. Dependency Audit

```bash
cd apps/backend
npm audit
```

**Expected**: Only low-severity issues in dev dependencies remain.

### 2. File Upload Testing

- [ ] Test with file > 10MB (should be rejected)
- [ ] Test with invalid MIME type (should be rejected)
- [ ] Test with path traversal in filename (should be sanitized)
- [ ] Test with valid CSV/Excel file (should work)

### 3. CSRF Testing

- [ ] Test state-changing operations without CSRF token (should fail)
- [ ] Test with valid CSRF token (should succeed)
- [ ] Test GET requests (should work without token)

---

## Files to Update

1. `apps/backend/package.json` - Update dependencies
2. `apps/backend/src/common/config/multer.config.ts` - NEW - Multer config
3. `apps/backend/src/common/utils/file-sanitizer.ts` - NEW - Filename sanitization
4. `apps/backend/src/modules/imports/**/**.service.ts` - Add size/MIME validation
5. `apps/backend/src/modules/auth/auth.controller.ts` - Add CSRF token endpoint
6. `apps/backend/src/common/guards/csrf.guard.ts` - NEW - CSRF guard
7. `apps/frontend/src/lib/api/client.ts` - Add CSRF token to requests

---

## Verification Checklist

Before marking as production-ready:

- [ ] All dependencies updated
- [ ] `npm audit` shows no high-severity vulnerabilities
- [ ] File size limits implemented and tested
- [ ] MIME type validation working
- [ ] Filename sanitization working
- [ ] xlsx vulnerability addressed (replaced or isolated)
- [ ] CSRF protection implemented (optional but recommended)
- [ ] All tests passing
- [ ] Manual security testing completed

---

## Estimated Timeline

- **Critical Fixes**: 2-4 hours (Dependencies + File Upload)
- **CSRF Protection**: 1 hour (optional but recommended)
- **Testing**: 1-2 hours
- **Total**: 4-7 hours

---

## Post-Deployment Monitoring

After deployment, monitor:

1. File upload errors (should see size/MIME type rejections)
2. Failed CSRF token validations (if implemented)
3. Any new dependency vulnerabilities (run `npm audit` weekly)
4. Rate limit violations
5. Failed login attempts

---

**Last Updated**: January 2025  
**Status**: ⚠️ **REQUIRES ACTION BEFORE PRODUCTION**

