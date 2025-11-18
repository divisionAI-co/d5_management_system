# Prisma in CI/CD - Best Practices

## Problem
When running `npx prisma generate` in GitHub Actions, you may encounter errors like:
```
Error: Failed to fetch the engine file at https://binaries.prisma.sh/...
```

This happens because:
1. Prisma's CDN may have temporary outages (500 errors)
2. Conflicting environment variables prevent proper engine downloads
3. Network issues in CI/CD environments

## Solution

### 1. Postinstall Hook (Recommended)
Add a `postinstall` script to `apps/backend/package.json`:
```json
{
  "scripts": {
    "postinstall": "prisma generate"
  }
}
```

This ensures Prisma Client is generated automatically after `npm install` or `npm ci`.

### 2. Remove Conflicting Environment Variables
**❌ Don't use these globally:**
```yaml
env:
  PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING: 1
  PRISMA_SKIP_POSTINSTALL_GENERATE: 1
  PRISMA_GENERATE_SKIP_AUTOINSTALL: 1
```

These variables can prevent Prisma from downloading engines correctly.

### 3. Proper Caching
Cache the Prisma binaries to speed up builds and reduce network calls:
```yaml
- name: Cache Prisma binary
  uses: actions/cache@v3
  with:
    path: |
      ~/.cache/prisma
      apps/backend/node_modules/.prisma
      apps/backend/node_modules/@prisma
    key: ${{ runner.os }}-prisma-${{ hashFiles('apps/backend/prisma/schema.prisma') }}
    restore-keys: |
      ${{ runner.os }}-prisma-
```

### 4. Retry Logic
Add retry logic to handle temporary network issues:
```yaml
- name: Install dependencies and generate Prisma
  run: |
    MAX_RETRIES=3
    RETRY_COUNT=0
    
    until npm ci || [ $RETRY_COUNT -eq $MAX_RETRIES ]; do
      RETRY_COUNT=$((RETRY_COUNT+1))
      echo "npm ci failed, attempt $RETRY_COUNT of $MAX_RETRIES..."
      if [ $RETRY_COUNT -lt $MAX_RETRIES ]; then
        echo "Cleaning and retrying in 5 seconds..."
        rm -rf node_modules
        sleep 5
      fi
    done
    
    if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
      echo "Failed after $MAX_RETRIES attempts"
      exit 1
    fi
```

## Current Setup

Our CI/CD workflows now:
1. ✅ Use `postinstall` hook for automatic generation
2. ✅ Cache Prisma binaries properly
3. ✅ Include retry logic for network issues
4. ✅ Avoid conflicting environment variables

## Local Development

For local development, you can still run:
```bash
npm install          # Will automatically run prisma generate via postinstall
npx prisma generate  # Manual generation if needed
```

## Troubleshooting

### If Prisma generate still fails:
1. **Check Prisma Status**: Visit https://www.prisma-status.com/
2. **Clear cache locally**:
   ```bash
   rm -rf node_modules/.prisma
   rm -rf node_modules/@prisma
   npm install
   ```
3. **In CI/CD**: Re-run the workflow (the retry logic should help)
4. **Alternative**: Use `prisma generate --skip-download` and commit the generated client (not recommended for production)

### Common Errors:
- `500 Internal Server Error`: Prisma CDN issue - retry usually works
- `ENOTFOUND`: Network connectivity issue
- `EACCES`: Permission issue - check file permissions

## References
- [Prisma CI/CD Best Practices](https://www.prisma.io/docs/guides/performance-and-optimization/ci-cd)
- [Prisma Environment Variables](https://www.prisma.io/docs/reference/api-reference/environment-variables-reference)

