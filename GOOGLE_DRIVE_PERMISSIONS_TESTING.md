# Google Drive Permissions Testing Guide

## Prerequisites

1. **Backend running** - Ensure your NestJS backend is running
2. **Google Drive configured** - Make sure you have:
   - `GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL` set
   - `GOOGLE_DRIVE_PRIVATE_KEY` set
   - `GOOGLE_DRIVE_SHARED_DRIVE_ID` (optional, if using shared drive)
3. **Authentication token** - You'll need a valid JWT access token

## Method 1: Using Swagger UI (Easiest)

1. **Start your backend server**
   ```bash
   cd apps/backend
   npm run dev
   ```

2. **Open Swagger UI**
   - Navigate to: `http://localhost:3000/api/v1/docs`
   - Or check your configured port/prefix

3. **Authenticate**
   - Click "Authorize" button (lock icon)
   - Enter your JWT token: `Bearer <your-token>`
   - Click "Authorize" then "Close"

4. **Test Endpoints**

   **Get all permissions on a file:**
   - Find `GET /drive/files/{id}/permissions`
   - Click "Try it out"
   - Enter a Google Drive file ID
   - Click "Execute"
   - Review the response showing all permissions

   **Get current user's permissions:**
   - Find `GET /drive/files/{id}/permissions/me`
   - Click "Try it out"
   - Enter a Google Drive file ID
   - Click "Execute"
   - Should return your permissions

   **Get specific user's permissions:**
   - Find `GET /drive/files/{id}/permissions/user`
   - Click "Try it out"
   - Enter file ID and user email as query parameter
   - Click "Execute"

   **Check specific permission:**
   - Find `GET /drive/files/{id}/permissions/check`
   - Click "Try it out"
   - Enter file ID, user email, and role (e.g., "writer")
   - Click "Execute"
   - Returns `true` or `false`

## Method 2: Using cURL

### Get Authentication Token First

```bash
# Login to get token
TOKEN=$(curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@division5.com","password":"admin123"}' \
  | jq -r '.accessToken')
```

### Test Endpoints

**1. Get all permissions:**
```bash
curl -X GET "http://localhost:3000/api/v1/drive/files/YOUR_FILE_ID/permissions" \
  -H "Authorization: Bearer $TOKEN"
```

**2. Get current user's permissions:**
```bash
curl -X GET "http://localhost:3000/api/v1/drive/files/YOUR_FILE_ID/permissions/me" \
  -H "Authorization: Bearer $TOKEN"
```

**3. Get specific user's permissions:**
```bash
curl -X GET "http://localhost:3000/api/v1/drive/files/YOUR_FILE_ID/permissions/user?email=user@example.com" \
  -H "Authorization: Bearer $TOKEN"
```

**4. Check if user has specific role:**
```bash
curl -X GET "http://localhost:3000/api/v1/drive/files/YOUR_FILE_ID/permissions/check?email=user@example.com&role=writer" \
  -H "Authorization: Bearer $TOKEN"
```

## Method 3: Using Postman

1. **Create a new collection** "Google Drive Permissions"

2. **Set up environment variables:**
   - `base_url`: `http://localhost:3000/api/v1`
   - `token`: Your JWT token
   - `file_id`: A Google Drive file ID to test with

3. **Create requests:**

   **Get All Permissions:**
   - Method: `GET`
   - URL: `{{base_url}}/drive/files/{{file_id}}/permissions`
   - Headers: `Authorization: Bearer {{token}}`

   **Get My Permissions:**
   - Method: `GET`
   - URL: `{{base_url}}/drive/files/{{file_id}}/permissions/me`
   - Headers: `Authorization: Bearer {{token}}`

   **Get User Permissions:**
   - Method: `GET`
   - URL: `{{base_url}}/drive/files/{{file_id}}/permissions/user?email=user@example.com`
   - Headers: `Authorization: Bearer {{token}}`

   **Check Permission:**
   - Method: `GET`
   - URL: `{{base_url}}/drive/files/{{file_id}}/permissions/check?email=user@example.com&role=writer`
   - Headers: `Authorization: Bearer {{token}}`

## Method 4: Frontend Integration Test

Add this to your frontend code to test:

```typescript
// In your frontend component or API client
import apiClient from '@/lib/api/client';

// Get current user's permissions
async function testMyPermissions(fileId: string) {
  try {
    const response = await apiClient.get(`/drive/files/${fileId}/permissions/me`);
    console.log('My permissions:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error getting permissions:', error);
  }
}

// Get specific user's permissions
async function testUserPermissions(fileId: string, userEmail: string) {
  try {
    const response = await apiClient.get(
      `/drive/files/${fileId}/permissions/user?email=${encodeURIComponent(userEmail)}`
    );
    console.log('User permissions:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error getting user permissions:', error);
  }
}

// Check specific permission
async function testPermissionCheck(fileId: string, userEmail: string, role: string) {
  try {
    const response = await apiClient.get(
      `/drive/files/${fileId}/permissions/check?email=${encodeURIComponent(userEmail)}&role=${role}`
    );
    console.log(`Can ${userEmail} ${role}?`, response.data);
    return response.data;
  } catch (error) {
    console.error('Error checking permission:', error);
  }
}
```

## Test Scenarios

### Scenario 1: Test with Different Permission Levels

1. **Create test files in Google Drive with different permissions:**
   - File A: Owner
   - File B: Writer
   - File C: Reader
   - File D: No access

2. **Test each file:**
   ```bash
   # Should return isOwner: true, canEdit: true, canDelete: true
   curl .../files/FILE_A_ID/permissions/me
   
   # Should return canEdit: true, canDelete: false
   curl .../files/FILE_B_ID/permissions/me
   
   # Should return canView: true, canEdit: false
   curl .../files/FILE_C_ID/permissions/me
   
   # Should return 404 or empty permissions
   curl .../files/FILE_D_ID/permissions/me
   ```

### Scenario 2: Test Domain Permissions

1. **Share a file with your entire domain** (e.g., `@yourcompany.com`)
2. **Test with different users from that domain:**
   ```bash
   curl .../files/FILE_ID/permissions/user?email=user1@yourcompany.com
   curl .../files/FILE_ID/permissions/user?email=user2@yourcompany.com
   ```
   Both should have access if domain permission is set.

### Scenario 3: Test Permission Checking

```bash
# Check if user can write
curl .../files/FILE_ID/permissions/check?email=user@example.com&role=writer

# Check if user can comment
curl .../files/FILE_ID/permissions/check?email=user@example.com&role=commenter

# Check if user is owner
curl .../files/FILE_ID/permissions/check?email=user@example.com&role=owner
```

## Expected Response Format

### Get All Permissions Response:
```json
[
  {
    "id": "permission-id-123",
    "type": "user",
    "role": "writer",
    "emailAddress": "user@example.com",
    "displayName": "John Doe"
  },
  {
    "id": "permission-id-456",
    "type": "domain",
    "role": "reader",
    "domain": "example.com"
  }
]
```

### Get User Permissions Response:
```json
{
  "fileId": "file-id-123",
  "userEmail": "user@example.com",
  "canView": true,
  "canComment": true,
  "canEdit": true,
  "canDelete": false,
  "isOwner": false,
  "permissions": [
    {
      "id": "permission-id-123",
      "type": "user",
      "role": "writer",
      "emailAddress": "user@example.com"
    }
  ]
}
```

### Check Permission Response:
```json
true
```
or
```json
false
```

## Troubleshooting

### Error: "File not found in Google Drive"
- Verify the file ID is correct
- Ensure the service account has access to the file
- Check if the file is in a shared drive that's configured

### Error: "Google Drive integration is not configured correctly"
- Verify environment variables are set
- Check service account credentials
- Ensure domain-wide delegation is enabled

### Empty permissions array
- The file might not have explicit permissions set
- Check if the file is owned by the service account
- Verify the service account has proper scopes

### Permission check returns false unexpectedly
- Verify the user email matches exactly (case-insensitive)
- Check if domain permissions apply
- Ensure the user isn't blocked or removed

## Quick Test Script

Save this as `test-drive-permissions.sh`:

```bash
#!/bin/bash

BASE_URL="http://localhost:3000/api/v1"
FILE_ID="YOUR_FILE_ID_HERE"
USER_EMAIL="user@example.com"

# Get token
echo "Logging in..."
TOKEN=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@division5.com","password":"admin123"}' \
  | jq -r '.accessToken')

if [ "$TOKEN" == "null" ] || [ -z "$TOKEN" ]; then
  echo "Failed to get token"
  exit 1
fi

echo "Token obtained: ${TOKEN:0:20}..."

# Test endpoints
echo -e "\n1. Getting all permissions..."
curl -s -X GET "$BASE_URL/drive/files/$FILE_ID/permissions" \
  -H "Authorization: Bearer $TOKEN" | jq '.'

echo -e "\n2. Getting my permissions..."
curl -s -X GET "$BASE_URL/drive/files/$FILE_ID/permissions/me" \
  -H "Authorization: Bearer $TOKEN" | jq '.'

echo -e "\n3. Getting user permissions..."
curl -s -X GET "$BASE_URL/drive/files/$FILE_ID/permissions/user?email=$USER_EMAIL" \
  -H "Authorization: Bearer $TOKEN" | jq '.'

echo -e "\n4. Checking writer permission..."
curl -s -X GET "$BASE_URL/drive/files/$FILE_ID/permissions/check?email=$USER_EMAIL&role=writer" \
  -H "Authorization: Bearer $TOKEN" | jq '.'

echo -e "\nDone!"
```

Make it executable and run:
```bash
chmod +x test-drive-permissions.sh
./test-drive-permissions.sh
```

