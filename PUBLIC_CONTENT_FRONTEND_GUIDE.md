# Public Content Frontend Implementation Guide

This guide explains how to implement the frontend display of content (blogs, case studies, and job positions) on your public-facing website.

## Overview

The content management system provides public APIs for:
- **Blogs** - Blog posts with rich content
- **Case Studies** - Client success stories and project showcases
- **Job Positions** - Open positions for recruitment

All endpoints are public (no authentication required) and designed for external website integration.

## Base URL

The API base URL depends on your environment:
- **Development**: `http://localhost:3000/api/v1`
- **Production**: `https://your-domain.com/api/v1`

---

## Job Positions Implementation

### API Endpoints

- `GET /api/v1/recruitment/positions/public` - List all open positions
- `GET /api/v1/recruitment/positions/public/:id` - Get single position by ID or slug

### Simplified Position Cards

Create simple position cards with image background and title only:

```tsx
import { useEffect, useState } from 'react';

interface Position {
  id: string;
  title: string;
  slug?: string;
  imageUrl?: string;
  description?: string;
  requirements?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

function PositionCard({ position }: { position: Position }) {
  return (
    <div
      className="relative h-64 rounded-lg overflow-hidden cursor-pointer group"
      style={{
        backgroundImage: position.imageUrl 
          ? `url(${position.imageUrl})` 
          : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {/* Overlay for better text readability */}
      <div className="absolute inset-0 bg-black/40 group-hover:bg-black/50 transition-colors" />
      
      {/* Position Title */}
      <div className="absolute inset-0 flex items-center justify-center p-6">
        <h3 className="text-2xl font-bold text-white text-center drop-shadow-lg">
          {position.title}
        </h3>
      </div>
    </div>
  );
}

function PositionsSection() {
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadPositions() {
      try {
        const response = await fetch(
          'http://localhost:3000/api/v1/recruitment/positions/public?pageSize=100'
        );
        const data = await response.json();
        
        // Filter out internships if needed
        const filtered = data.data.filter((pos: Position) => 
          !pos.title.toLowerCase().includes('internship') &&
          !pos.title.toLowerCase().includes('intern')
        );
        
        setPositions(filtered);
      } catch (error) {
        console.error('Failed to load positions:', error);
      } finally {
        setLoading(false);
      }
    }
    loadPositions();
  }, []);

  if (loading) return <div>Loading positions...</div>;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {positions.map((position) => (
        <PositionCard key={position.id} position={position} />
      ))}
    </div>
  );
}
```

### Complete Careers Page with Culture Section

```tsx
import { useEffect, useState } from 'react';

interface Position {
  id: string;
  title: string;
  slug?: string;
  imageUrl?: string;
  description?: string;
  requirements?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

function CareersPage() {
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadPositions() {
      try {
        const response = await fetch(
          'http://localhost:3000/api/v1/recruitment/positions/public?pageSize=100'
        );
        const data = await response.json();
        
        // Filter out internships
        const filtered = data.data.filter((pos: Position) => 
          !pos.title.toLowerCase().includes('internship') &&
          !pos.title.toLowerCase().includes('intern')
        );
        
        setPositions(filtered);
      } catch (error) {
        console.error('Failed to load positions:', error);
      } finally {
        setLoading(false);
      }
    }
    loadPositions();
  }, []);

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="bg-gradient-to-r from-blue-600 to-purple-600 text-white py-20">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-5xl font-bold mb-4">Join Our Team</h1>
          <p className="text-xl opacity-90">
            Build your career with us and make an impact
          </p>
        </div>
      </section>

      {/* Culture Section - BEFORE Positions */}
      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-4">
          <h2 className="text-4xl font-bold text-center mb-12">Our Culture</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center p-6 bg-white rounded-lg shadow-sm">
              <div className="text-4xl mb-4">🚀</div>
              <h3 className="text-xl font-semibold mb-2">Innovation</h3>
              <p className="text-gray-600">
                We encourage creative thinking and embrace new technologies
              </p>
            </div>
            <div className="text-center p-6 bg-white rounded-lg shadow-sm">
              <div className="text-4xl mb-4">🤝</div>
              <h3 className="text-xl font-semibold mb-2">Collaboration</h3>
              <p className="text-gray-600">
                Teamwork and open communication are at our core
              </p>
            </div>
            <div className="text-center p-6 bg-white rounded-lg shadow-sm">
              <div className="text-4xl mb-4">📈</div>
              <h3 className="text-xl font-semibold mb-2">Growth</h3>
              <p className="text-gray-600">
                Continuous learning and professional development opportunities
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Open Positions Section */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-4xl font-bold text-center mb-12">Open Positions</h2>
          
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="mt-4 text-gray-600">Loading positions...</p>
            </div>
          ) : positions.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-600">No open positions at the moment. Check back soon!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {positions.map((position) => (
                <div
                  key={position.id}
                  className="relative h-64 rounded-lg overflow-hidden cursor-pointer group shadow-lg hover:shadow-xl transition-shadow"
                  style={{
                    backgroundImage: position.imageUrl 
                      ? `url(${position.imageUrl})` 
                      : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                  }}
                >
                  {/* Overlay */}
                  <div className="absolute inset-0 bg-black/50 group-hover:bg-black/60 transition-colors" />
                  
                  {/* Position Title */}
                  <div className="absolute inset-0 flex items-center justify-center p-6">
                    <h3 className="text-2xl font-bold text-white text-center drop-shadow-lg">
                      {position.title}
                    </h3>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

export default CareersPage;
```

---

## Blogs Implementation

### API Endpoints

- `GET /api/v1/content/blogs/public` - List published blogs
- `GET /api/v1/content/blogs/public/:slug` - Get single blog by slug

### Blog List Component

```tsx
import { useEffect, useState } from 'react';

interface Blog {
  id: string;
  title: string;
  slug: string;
  excerpt?: string;
  featuredImage?: string;
  publishedAt?: string;
  author: {
    firstName: string;
    lastName: string;
  };
  createdAt: string;
}

function BlogCard({ blog }: { blog: Blog }) {
  return (
    <article className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow">
      {blog.featuredImage && (
        <img
          src={blog.featuredImage}
          alt={blog.title}
          className="w-full h-48 object-cover"
        />
      )}
      <div className="p-6">
        <h2 className="text-2xl font-bold mb-2">{blog.title}</h2>
        {blog.excerpt && (
          <p className="text-gray-600 mb-4 line-clamp-3">{blog.excerpt}</p>
        )}
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>
            By {blog.author.firstName} {blog.author.lastName}
          </span>
          {blog.publishedAt && (
            <span>{new Date(blog.publishedAt).toLocaleDateString()}</span>
          )}
        </div>
      </div>
    </article>
  );
}

function BlogsPage() {
  const [blogs, setBlogs] = useState<Blog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadBlogs() {
      try {
        const response = await fetch(
          'http://localhost:3000/api/v1/content/blogs/public?pageSize=20&status=PUBLISHED'
        );
        const data = await response.json();
        setBlogs(data.data);
      } catch (error) {
        console.error('Failed to load blogs:', error);
      } finally {
        setLoading(false);
      }
    }
    loadBlogs();
  }, []);

  if (loading) return <div>Loading blogs...</div>;

  return (
    <div className="container mx-auto px-4 py-12">
      <h1 className="text-4xl font-bold mb-8">Our Blog</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {blogs.map((blog) => (
          <BlogCard key={blog.id} blog={blog} />
        ))}
      </div>
    </div>
  );
}
```

### Blog Detail Page

```tsx
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

interface Blog {
  id: string;
  title: string;
  slug: string;
  content: string;
  featuredImage?: string;
  publishedAt?: string;
  author: {
    firstName: string;
    lastName: string;
  };
  metaTitle?: string;
  metaDescription?: string;
}

function BlogDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const [blog, setBlog] = useState<Blog | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadBlog() {
      if (!slug) return;
      
      try {
        const response = await fetch(
          `http://localhost:3000/api/v1/content/blogs/public/${slug}`
        );
        const data = await response.json();
        setBlog(data);
      } catch (error) {
        console.error('Failed to load blog:', error);
      } finally {
        setLoading(false);
      }
    }
    loadBlog();
  }, [slug]);

  if (loading) return <div>Loading...</div>;
  if (!blog) return <div>Blog not found</div>;

  return (
    <article className="container mx-auto px-4 py-12 max-w-4xl">
      <h1 className="text-4xl font-bold mb-4">{blog.title}</h1>
      
      <div className="flex items-center gap-4 text-gray-600 mb-8">
        <span>
          By {blog.author.firstName} {blog.author.lastName}
        </span>
        {blog.publishedAt && (
          <span>• {new Date(blog.publishedAt).toLocaleDateString()}</span>
        )}
      </div>

      {blog.featuredImage && (
        <img
          src={blog.featuredImage}
          alt={blog.title}
          className="w-full h-96 object-cover rounded-lg mb-8"
        />
      )}

      <div
        className="prose prose-lg max-w-none"
        dangerouslySetInnerHTML={{ __html: blog.content }}
      />
    </article>
  );
}
```

---

## Case Studies Implementation

### API Endpoints

- `GET /api/v1/content/case-studies/public` - List published case studies
- `GET /api/v1/content/case-studies/public/:slug` - Get single case study by slug

### Case Studies List Component

```tsx
import { useEffect, useState } from 'react';

interface CaseStudy {
  id: string;
  title: string;
  slug: string;
  excerpt?: string;
  featuredImage?: string;
  challenge?: string; // The challenge the customer faced
  solution?: string; // The solution provided
  aboutCustomer?: string; // Information about the customer
  clientName?: string;
  clientLogo?: string;
  industry?: string;
  projectDate?: string;
  results?: Record<string, any>; // Results/metrics (JSON object)
  publishedAt?: string;
  createdAt: string;
}

function CaseStudyCard({ caseStudy }: { caseStudy: CaseStudy }) {
  return (
    <article className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow">
      {caseStudy.featuredImage && (
        <img
          src={caseStudy.featuredImage}
          alt={caseStudy.title}
          className="w-full h-48 object-cover"
        />
      )}
      <div className="p-6">
        {caseStudy.clientLogo && (
          <img
            src={caseStudy.clientLogo}
            alt={caseStudy.clientName || 'Client'}
            className="h-12 mb-4"
          />
        )}
        <h2 className="text-2xl font-bold mb-2">{caseStudy.title}</h2>
        {caseStudy.clientName && (
          <p className="text-blue-600 font-semibold mb-2">{caseStudy.clientName}</p>
        )}
        {caseStudy.excerpt && (
          <p className="text-gray-600 mb-4 line-clamp-3">{caseStudy.excerpt}</p>
        )}
        {caseStudy.industry && (
          <span className="inline-block px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm">
            {caseStudy.industry}
          </span>
        )}
      </div>
    </article>
  );
}

function CaseStudiesPage() {
  const [caseStudies, setCaseStudies] = useState<CaseStudy[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadCaseStudies() {
      try {
        const response = await fetch(
          'http://localhost:3000/api/v1/content/case-studies/public?pageSize=20&status=PUBLISHED'
        );
        const data = await response.json();
        setCaseStudies(data.data);
      } catch (error) {
        console.error('Failed to load case studies:', error);
      } finally {
        setLoading(false);
      }
    }
    loadCaseStudies();
  }, []);

  if (loading) return <div>Loading case studies...</div>;

  return (
    <div className="container mx-auto px-4 py-12">
      <h1 className="text-4xl font-bold mb-8">Case Studies</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {caseStudies.map((caseStudy) => (
          <CaseStudyCard key={caseStudy.id} caseStudy={caseStudy} />
        ))}
      </div>
    </div>
  );
}
```

### Case Study Detail Page

```tsx
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

interface CaseStudy {
  id: string;
  title: string;
  slug: string;
  excerpt?: string;
  content: string;
  featuredImage?: string;
  challenge?: string;
  solution?: string;
  aboutCustomer?: string;
  clientName?: string;
  clientLogo?: string;
  industry?: string;
  projectDate?: string;
  results?: Record<string, any>;
  publishedAt?: string;
  author: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
}

function CaseStudyDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const [caseStudy, setCaseStudy] = useState<CaseStudy | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadCaseStudy() {
      if (!slug) return;
      
      try {
        const response = await fetch(
          `http://localhost:3000/api/v1/content/case-studies/public/${slug}`
        );
        const data = await response.json();
        setCaseStudy(data);
      } catch (error) {
        console.error('Failed to load case study:', error);
      } finally {
        setLoading(false);
      }
    }
    loadCaseStudy();
  }, [slug]);

  if (loading) return <div>Loading...</div>;
  if (!caseStudy) return <div>Case study not found</div>;

  return (
    <article className="container mx-auto px-4 py-12 max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        {caseStudy.clientLogo && (
          <img
            src={caseStudy.clientLogo}
            alt={caseStudy.clientName || 'Client'}
            className="h-16 mb-4"
          />
        )}
        <h1 className="text-4xl font-bold mb-4">{caseStudy.title}</h1>
        {caseStudy.clientName && (
          <p className="text-2xl text-blue-600 font-semibold mb-2">
            {caseStudy.clientName}
          </p>
        )}
        {caseStudy.industry && (
          <span className="inline-block px-4 py-2 bg-gray-100 text-gray-700 rounded-full text-sm mb-4">
            {caseStudy.industry}
          </span>
        )}
        {caseStudy.excerpt && (
          <p className="text-xl text-gray-600 mt-4">{caseStudy.excerpt}</p>
        )}
      </div>

      {/* Featured Image */}
      {caseStudy.featuredImage && (
        <img
          src={caseStudy.featuredImage}
          alt={caseStudy.title}
          className="w-full h-96 object-cover rounded-lg mb-12"
        />
      )}

      {/* About the Customer */}
      {caseStudy.aboutCustomer && (
        <section className="mb-12">
          <h2 className="text-3xl font-bold mb-4">About the Customer</h2>
          <div
            className="prose prose-lg max-w-none"
            dangerouslySetInnerHTML={{ __html: caseStudy.aboutCustomer }}
          />
        </section>
      )}

      {/* Challenge */}
      {caseStudy.challenge && (
        <section className="mb-12">
          <h2 className="text-3xl font-bold mb-4">The Challenge</h2>
          <div
            className="prose prose-lg max-w-none"
            dangerouslySetInnerHTML={{ __html: caseStudy.challenge }}
          />
        </section>
      )}

      {/* Solution */}
      {caseStudy.solution && (
        <section className="mb-12">
          <h2 className="text-3xl font-bold mb-4">The Solution</h2>
          <div
            className="prose prose-lg max-w-none"
            dangerouslySetInnerHTML={{ __html: caseStudy.solution }}
          />
        </section>
      )}

      {/* Results */}
      {caseStudy.results && Object.keys(caseStudy.results).length > 0 && (
        <section className="mb-12 bg-gray-50 rounded-lg p-8">
          <h2 className="text-3xl font-bold mb-6">Results</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {Object.entries(caseStudy.results).map(([key, value]) => (
              <div key={key} className="bg-white p-6 rounded-lg shadow-sm">
                <h3 className="text-lg font-semibold text-gray-700 mb-2">
                  {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                </h3>
                <p className="text-2xl font-bold text-blue-600">{String(value)}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Additional Content */}
      {caseStudy.content && (
        <section className="mb-12">
          <div
            className="prose prose-lg max-w-none"
            dangerouslySetInnerHTML={{ __html: caseStudy.content }}
          />
        </section>
      )}

      {/* Metadata */}
      <div className="border-t pt-6 mt-12 text-sm text-gray-600">
        <p>
          Published by {caseStudy.author.firstName} {caseStudy.author.lastName}
          {caseStudy.publishedAt && (
            <> on {new Date(caseStudy.publishedAt).toLocaleDateString()}</>
          )}
        </p>
        {caseStudy.projectDate && (
          <p>Project Date: {new Date(caseStudy.projectDate).toLocaleDateString()}</p>
        )}
      </div>
    </article>
  );
}

export default CaseStudyDetailPage;
```

---

## Complete Example: Careers Page with All Sections

```tsx
import { useEffect, useState } from 'react';

interface Position {
  id: string;
  title: string;
  slug?: string;
  imageUrl?: string;
  description?: string;
  status: string;
}

function CareersPage() {
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadPositions() {
      try {
        const response = await fetch(
          `${import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1'}/recruitment/positions/public?pageSize=100`
        );
        const data = await response.json();
        
        // Filter out internships
        const filtered = data.data.filter((pos: Position) => 
          !pos.title.toLowerCase().includes('internship') &&
          !pos.title.toLowerCase().includes('intern')
        );
        
        setPositions(filtered);
      } catch (error) {
        console.error('Failed to load positions:', error);
      } finally {
        setLoading(false);
      }
    }
    loadPositions();
  }, []);

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <section className="bg-gradient-to-r from-blue-600 to-purple-600 text-white py-20">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-5xl font-bold mb-4">Join Our Team</h1>
          <p className="text-xl opacity-90">
            Build your career with us and make an impact
          </p>
        </div>
      </section>

      {/* Culture Section - BEFORE Positions */}
      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-4">
          <h2 className="text-4xl font-bold text-center mb-12">Our Culture</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <div className="text-center p-8 bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow">
              <div className="text-5xl mb-4">🚀</div>
              <h3 className="text-2xl font-semibold mb-3">Innovation</h3>
              <p className="text-gray-600">
                We encourage creative thinking and embrace new technologies to solve complex challenges.
              </p>
            </div>
            <div className="text-center p-8 bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow">
              <div className="text-5xl mb-4">🤝</div>
              <h3 className="text-2xl font-semibold mb-3">Collaboration</h3>
              <p className="text-gray-600">
                Teamwork and open communication are at our core. We believe in the power of working together.
              </p>
            </div>
            <div className="text-center p-8 bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow">
              <div className="text-5xl mb-4">📈</div>
              <h3 className="text-2xl font-semibold mb-3">Growth</h3>
              <p className="text-gray-600">
                Continuous learning and professional development opportunities for every team member.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Open Positions Section */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-4xl font-bold text-center mb-12">Open Positions</h2>
          
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="mt-4 text-gray-600">Loading positions...</p>
            </div>
          ) : positions.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-600 text-lg">
                No open positions at the moment. Check back soon!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
              {positions.map((position) => (
                <div
                  key={position.id}
                  className="relative h-64 rounded-xl overflow-hidden cursor-pointer group shadow-lg hover:shadow-xl transition-all hover:scale-105"
                  style={{
                    backgroundImage: position.imageUrl 
                      ? `url(${position.imageUrl})` 
                      : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                  }}
                >
                  {/* Gradient Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/40 to-black/30 group-hover:from-black/80 group-hover:via-black/50 transition-colors" />
                  
                  {/* Position Title */}
                  <div className="absolute inset-0 flex items-end p-6">
                    <h3 className="text-2xl font-bold text-white drop-shadow-lg">
                      {position.title}
                    </h3>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

export default CareersPage;
```

---

## Adding Images to Positions

To add images to positions, you'll need to:

1. **Add an `imageUrl` field to the Position model** (if not already present)
2. **Update the position creation/editing form** to include an image URL field
3. **Use Google Drive links** - The system automatically converts Google Drive image URLs to proxy URLs

### Example: Adding Image to Position

```tsx
// In your position creation form
<input
  type="url"
  placeholder="Position image URL (Google Drive links supported)"
  value={imageUrl}
  onChange={(e) => setImageUrl(e.target.value)}
/>
```

The backend will automatically convert Google Drive URLs to proxy URLs that work reliably.

---

## Filtering Out Internships

To filter out internships from positions:

```typescript
// Filter positions
const filteredPositions = positions.filter((position) => {
  const title = position.title.toLowerCase();
  return !title.includes('internship') && !title.includes('intern');
});
```

Or you can filter on the backend by adding a filter parameter (if implemented).

---

## Styling Tips

### Position Cards with Image Background

```css
/* Simple card with image background */
.position-card {
  height: 300px;
  background-size: cover;
  background-position: center;
  position: relative;
  overflow: hidden;
  border-radius: 12px;
}

.position-card::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(to top, rgba(0,0,0,0.7), rgba(0,0,0,0.3));
}

.position-title {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 1.5rem;
  color: white;
  font-weight: bold;
  z-index: 1;
}
```

---

## Environment Variables

For your frontend, set up environment variables:

```env
# .env
VITE_API_URL=http://localhost:3000/api/v1
# or in production:
# VITE_API_URL=https://your-domain.com/api/v1
```

Then use in your code:

```typescript
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';
```

---

## CORS Configuration

Make sure your website domain is added to the backend's `CORS_ORIGINS` environment variable:

```env
CORS_ORIGINS=https://your-website.com,https://www.your-website.com,http://localhost:5173
```

---

## Complete TypeScript Types

```typescript
// types/content.ts

export interface Position {
  id: string;
  title: string;
  slug?: string;
  imageUrl?: string;
  description?: string;
  requirements?: string;
  status: string;
  recruitmentStatus?: 'STANDARD' | 'HEADHUNTING';
  createdAt: string;
  updatedAt: string;
}

export interface Blog {
  id: string;
  title: string;
  slug: string;
  excerpt?: string;
  content: string;
  featuredImage?: string;
  publishedAt?: string;
  author: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  metaTitle?: string;
  metaDescription?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CaseStudy {
  id: string;
  title: string;
  slug: string;
  excerpt?: string;
  content: string;
  featuredImage?: string;
  challenge?: string; // The challenge the customer faced
  solution?: string; // The solution provided
  aboutCustomer?: string; // Information about the customer
  clientName?: string;
  clientLogo?: string;
  industry?: string;
  projectDate?: string;
  results?: Record<string, any>; // Results/metrics (JSON object)
  publishedAt?: string;
  author: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}
```

---

## Next Steps

1. **Add image support to positions** - Update the position model to include an `imageUrl` field
2. **Implement the careers page** - Use the examples above to create your public careers page
3. **Add culture section content** - Customize the culture section with your company values
4. **Style the cards** - Adjust the card design to match your brand
5. **Add position detail pages** - Create detail pages that link from the cards

For more details on the API endpoints, see [PUBLIC_POSITIONS_API.md](./PUBLIC_POSITIONS_API.md).

