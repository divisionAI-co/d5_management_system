# Public Positions API

This document describes how to access and use the public positions API endpoints for showcasing job positions on your website.

## Overview

The public positions API allows you to fetch open job positions without authentication. These endpoints are designed for public-facing websites and only return safe, non-sensitive information.

## Base URL

The API base URL depends on your environment:
- **Development**: `http://localhost:3000/api/v1`
- **Production**: `https://your-domain.com/api/v1`

## Endpoints

### 1. List All Open Positions

**Endpoint**: `GET /api/v1/recruitment/positions/public`

**Description**: Returns a paginated list of all open, non-archived positions suitable for public display.

**Authentication**: None required (public endpoint)

**Query Parameters**:
- `page` (optional, default: 1) - Page number
- `pageSize` (optional, default: 25, max: 100) - Number of items per page
- `search` (optional) - Search term to filter by title, description, or customer name
- `sortBy` (optional, default: 'createdAt') - Sort field: 'createdAt', 'updatedAt', 'title', 'status'
- `sortOrder` (optional, default: 'desc') - Sort order: 'asc' or 'desc'

**Example Request**:
```bash
curl -X GET "http://localhost:3000/api/v1/recruitment/positions/public?page=1&pageSize=10&sortBy=createdAt&sortOrder=desc"
```

**Example Response**:
```json
{
  "data": [
    {
      "id": "uuid-here",
      "title": "Senior Software Engineer",
      "description": "We are looking for an experienced software engineer...",
      "requirements": "5+ years of experience, React, Node.js...",
      "status": "Open",
      "recruitmentStatus": "STANDARD",
      "createdAt": "2024-01-15T10:00:00Z",
      "updatedAt": "2024-01-20T15:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 10,
    "total": 25,
    "totalPages": 3
  }
}
```

### 2. Get Single Position

**Endpoint**: `GET /api/v1/recruitment/positions/public/:id`

**Description**: Returns details for a specific open position.

**Authentication**: None required (public endpoint)

**Path Parameters**:
- `id` (required) - The position ID (UUID)

**Example Request**:
```bash
curl -X GET "http://localhost:3000/api/v1/recruitment/positions/public/uuid-here"
```

**Example Response**:
```json
{
  "id": "uuid-here",
  "title": "Senior Software Engineer",
  "description": "We are looking for an experienced software engineer...",
  "requirements": "5+ years of experience, React, Node.js...",
  "status": "Open",
  "recruitmentStatus": "STANDARD",
  "createdAt": "2024-01-15T10:00:00Z",
  "updatedAt": "2024-01-20T15:30:00Z"
}
```

## Important Notes

1. **Only Open Positions**: These endpoints only return positions with status "Open" and that are not archived.

2. **No Sensitive Data**: Candidate information, opportunity information, internal notes, and other sensitive data are excluded from public endpoints. Only position-related information is returned.

3. **CORS Configuration**: Make sure your website domain is included in the `CORS_ORIGINS` environment variable on the backend to allow cross-origin requests.

4. **Rate Limiting**: Public endpoints may be subject to rate limiting. Check with your backend administrator for specific limits.

## JavaScript/TypeScript Example

```typescript
// Fetch all open positions
async function fetchOpenPositions(page = 1, pageSize = 10) {
  const response = await fetch(
    `http://localhost:3000/api/v1/recruitment/positions/public?page=${page}&pageSize=${pageSize}`
  );
  const data = await response.json();
  return data;
}

// Fetch a specific position
async function fetchPosition(id: string) {
  const response = await fetch(
    `http://localhost:3000/api/v1/recruitment/positions/public/${id}`
  );
  const data = await response.json();
  return data;
}

// Usage
const positions = await fetchOpenPositions(1, 20);
console.log(positions.data); // Array of positions
console.log(positions.pagination); // Pagination info
```

## React Example

```tsx
import { useEffect, useState } from 'react';

interface Position {
  id: string;
  title: string;
  description: string;
  requirements?: string;
  status: string;
  recruitmentStatus?: string;
  createdAt: string;
  updatedAt: string;
}

function PositionsList() {
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadPositions() {
      try {
        const response = await fetch(
          'http://localhost:3000/api/v1/recruitment/positions/public?pageSize=20'
        );
        const data = await response.json();
        setPositions(data.data);
      } catch (error) {
        console.error('Failed to load positions:', error);
      } finally {
        setLoading(false);
      }
    }
    loadPositions();
  }, []);

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <h1>Open Positions</h1>
      {positions.map((position) => (
        <div key={position.id}>
          <h2>{position.title}</h2>
          <p>{position.description}</p>
          {position.requirements && (
            <p>Requirements: {position.requirements}</p>
          )}
        </div>
      ))}
    </div>
  );
}
```

## Testing the API

You can test the API using:

1. **Browser**: Simply navigate to the endpoint URL
2. **cURL**: Use the examples above
3. **Postman/Insomnia**: Create GET requests to the endpoints
4. **Swagger UI**: Visit `http://localhost:3000/api/docs` and look for "Recruitment - Positions" endpoints marked as public

## Job Application Submission

### Submit Job Application

**Endpoint**: `POST /api/v1/recruitment/applications/public`

**Description**: Submit a job application with CV upload. The system will automatically create a candidate folder in Google Drive and upload the CV.

**Authentication**: None required (public endpoint)

**Content-Type**: `multipart/form-data`

**Form Fields**:
- `firstName` (required) - Candidate first name
- `lastName` (required) - Candidate last name
- `email` (required) - Candidate email address
- `phone` (optional) - Phone number
- `positionId` (optional) - UUID of the position to apply for
- `cv` (required) - CV file (PDF, DOC, or DOCX)

**Example Request** (using curl):
```bash
curl -X POST "http://localhost:3000/api/v1/recruitment/applications/public" \
  -F "firstName=John" \
  -F "lastName=Doe" \
  -F "email=john.doe@example.com" \
  -F "phone=+1234567890" \
  -F "positionId=uuid-of-position" \
  -F "cv=@/path/to/resume.pdf"
```

**Example Response**:
```json
{
  "success": true,
  "message": "Application submitted successfully",
  "candidateId": "uuid-here",
  "folderId": "google-drive-folder-id",
  "resumeUrl": "https://drive.google.com/file/d/..."
}
```

**What Happens**:
1. The system creates a folder in Google Drive (in the Recruitment folder) with format `F_L` (e.g., "J_D" for John Doe)
2. The CV is uploaded to that folder
3. A candidate record is created in the database
4. If `positionId` is provided, the candidate is linked to that position
5. The candidate's `resumeUrl` and `driveFolderId` fields are automatically populated

**JavaScript/TypeScript Example**:
```typescript
async function submitApplication(formData: FormData) {
  const response = await fetch(
    'http://localhost:3000/api/v1/recruitment/applications/public',
    {
      method: 'POST',
      body: formData,
    }
  );
  const data = await response.json();
  return data;
}

// Usage
const formData = new FormData();
formData.append('firstName', 'John');
formData.append('lastName', 'Doe');
formData.append('email', 'john.doe@example.com');
formData.append('phone', '+1234567890');
formData.append('positionId', 'position-uuid');
formData.append('cv', fileInput.files[0]); // File from input element

const result = await submitApplication(formData);
console.log(result);
```

**React Example**:
```tsx
function JobApplicationForm({ positionId }: { positionId?: string }) {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
  });
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const submitData = new FormData();
    submitData.append('firstName', formData.firstName);
    submitData.append('lastName', formData.lastName);
    submitData.append('email', formData.email);
    if (formData.phone) submitData.append('phone', formData.phone);
    if (positionId) submitData.append('positionId', positionId);
    if (cvFile) submitData.append('cv', cvFile);

    try {
      const response = await fetch(
        'http://localhost:3000/api/v1/recruitment/applications/public',
        {
          method: 'POST',
          body: submitData,
        }
      );
      const data = await response.json();
      setResult(data);
    } catch (error) {
      console.error('Failed to submit application:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        placeholder="First Name"
        value={formData.firstName}
        onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
        required
      />
      <input
        type="text"
        placeholder="Last Name"
        value={formData.lastName}
        onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
        required
      />
      <input
        type="email"
        placeholder="Email"
        value={formData.email}
        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
        required
      />
      <input
        type="tel"
        placeholder="Phone (optional)"
        value={formData.phone}
        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
      />
      <input
        type="file"
        accept=".pdf,.doc,.docx"
        onChange={(e) => setCvFile(e.target.files?.[0] || null)}
        required
      />
      <button type="submit" disabled={loading}>
        {loading ? 'Submitting...' : 'Submit Application'}
      </button>
      {result && <p>{result.message}</p>}
    </form>
  );
}
```

**Configuration Required**:
- `GOOGLE_DRIVE_RECRUITMENT_FOLDER_ID` (optional) - ID of the recruitment folder in Google Drive. If not set, the system will create one automatically in the shared drive.
- `GOOGLE_DRIVE_SHARED_DRIVE_ID` - Already configured as part of your Google Drive setup. The recruitment folder will be created within this shared drive if `GOOGLE_DRIVE_RECRUITMENT_FOLDER_ID` is not specified.

## Troubleshooting

### CORS Errors
If you see CORS errors, ensure your website domain is added to the `CORS_ORIGINS` environment variable:
```bash
CORS_ORIGINS=https://your-website.com,https://www.your-website.com
```

### 404 Not Found
- Verify the API base URL is correct
- Check that the endpoint path includes `/public`
- Ensure the backend server is running

### Empty Results
- Check that you have positions with status "Open" and `isArchived: false` in your database
- Verify the positions are not filtered out by your search parameters

### Application Submission Errors
- **"CV file is required"**: Make sure the CV file is included in the form data with the field name `cv`
- **"CV must be a PDF or Word document"**: Only PDF, DOC, and DOCX files are accepted
- **"A candidate with this email already exists"**: The email address has already been used. Contact support if this is an error.
- **Google Drive errors**: Ensure Google Drive integration is properly configured with service account credentials

