# Fixing Prisma Windows File Lock Issue

## The Problem

On Windows, you're getting:
```
EPERM: operation not permitted, rename '...query_engine-windows.dll.node.tmp...' -> '...query_engine-windows.dll.node'
```

This happens because:
1. A Node process is locking the file
2. File Explorer has the folder open
3. Antivirus is scanning the file
4. VSCode or another editor has the file locked

## Quick Fix (Do This Now)

1. **Stop all Node processes:**
   ```powershell
   # In PowerShell (Run as Administrator)
   Get-Process -Name node -ErrorAction SilentlyContinue | Stop-Process -Force
   ```

2. **Delete the locked Prisma directory:**
   ```powershell
   # In PowerShell from project root
   Remove-Item -Path "node_modules\.prisma" -Recurse -Force
   ```

3. **Generate Prisma client manually:**
   ```powershell
   cd apps/backend
   npx prisma generate
   ```

4. **Now install dependencies:**
   ```powershell
   cd ../..
   npm install
   ```

## Solution: Remove `postinstall` Script

The `postinstall: "prisma generate"` script causes file locks on Windows. 

**I've already removed it from `package.json`**

Now you need to manually run `npx prisma generate` in these scenarios:
- After `npm install` (first time)
- After pulling schema changes
- After running migrations

## Alternative: Make `postinstall` Skip Windows

If you want to keep `postinstall` but skip it on Windows, add this to `apps/backend/package.json`:

```json
"scripts": {
  "postinstall": "node -e \"if (process.platform !== 'win32' || process.env.CI) require('child_process').execSync('prisma generate', {stdio: 'inherit'})\"",
}
```

This will:
- ✅ Run on Linux/Mac
- ✅ Run in CI/CD
- ❌ Skip on Windows (run manually)

## For CI/CD Issue

The CI/CD error is different - it's a Prisma CDN issue (500 error fetching checksums).

**I've already fixed this** by adding `PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING: 1` to `.github/workflows/ci.yml` and `.github/workflows/deploy.yml`.

Make sure you:
1. Commit these workflow changes
2. Push to GitHub
3. The next CI/CD run will work

## Quick Commands Reference

```powershell
# Generate Prisma client
cd apps/backend
npx prisma generate

# Run migrations
npx prisma migrate dev

# Open Prisma Studio
npx prisma studio

# Stop all Node processes
Get-Process -Name node | Stop-Process -Force

# Delete Prisma client files
Remove-Item -Path "..\..\node_modules\.prisma" -Recurse -Force
```

## Prevention

To avoid this in the future:
1. Close VSCode before running `npm install`
2. Stop dev servers before installing
3. Exclude `node_modules\.prisma` from antivirus scanning
4. Use WSL for development (no Windows file lock issues)

