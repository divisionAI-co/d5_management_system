# XSS Protection Guide

This document describes the XSS (Cross-Site Scripting) protection measures implemented in the frontend application.

## Overview

XSS attacks occur when malicious scripts are injected into web pages viewed by other users. This application implements multiple layers of protection to prevent XSS attacks.

## Protection Mechanisms

### 1. Content Security Policy (CSP)

CSP headers are set in `index.html` to restrict which resources can be loaded and executed:

```html
<meta http-equiv="Content-Security-Policy" content="...">
```

**Current Policy:**
- `default-src 'self'` - Only load resources from same origin
- `script-src 'self' 'unsafe-inline' 'unsafe-eval'` - Scripts from same origin (relaxed for Vite dev mode)
- `style-src 'self' 'unsafe-inline'` - Styles from same origin
- `img-src 'self' data: https:` - Images from same origin, data URIs, and HTTPS
- `connect-src 'self' http://localhost:* https:` - API connections
- `object-src 'none'` - No plugins/objects
- `frame-ancestors 'self'` - Prevent clickjacking

**Note:** In production, consider tightening CSP by removing `'unsafe-inline'` and `'unsafe-eval'` if possible.

### 2. Input Sanitization

#### Text Sanitization (`sanitizeText`)
- Removes null bytes and control characters
- Trims whitespace
- Use for: User input that will be displayed as plain text

#### HTML Sanitization (`sanitizeHtml`)
- Whitelist approach - only allows safe HTML tags
- Removes dangerous attributes
- Sanitizes URLs in `href` and `src` attributes
- Use for: User-generated HTML content

#### HTML Escaping (`escapeHtml`)
- Converts special characters to HTML entities
- Use for: Displaying user input as text (not HTML)

### 3. Safe Components

#### `SafeHtml` Component
Safely renders HTML content with automatic sanitization:

```tsx
import { SafeHtml } from '@/components/ui/SafeHtml';

// Render as HTML (sanitized)
<SafeHtml html={userContent} />

// Render as plain text (fully escaped)
<SafeHtml html={userContent} asText />
```

#### `SafeText` Component
Renders content as plain text (always escaped):

```tsx
import { SafeText } from '@/components/ui/SafeHtml';

<SafeText text={userInput} />
```

### 4. Input Validation

Validation utilities in `input-validation.ts`:

- **Email validation**: Format and length checks
- **Password validation**: Strength requirements
- **URL validation**: Protocol and format checks
- **Phone validation**: Basic format validation
- **Text validation**: Length and pattern checks

### 5. React Best Practices

#### ✅ DO:
- Use `SafeHtml` or `SafeText` for user-generated content
- Sanitize input before storing in state
- Validate input on form submission
- Use React's built-in escaping (default behavior)

#### ❌ DON'T:
- Use `dangerouslySetInnerHTML` with unsanitized content
- Trust user input without validation
- Concatenate user input into HTML strings
- Use `eval()` or `Function()` with user input

## Usage Examples

### Displaying User Input Safely

```tsx
// ✅ GOOD: Using SafeText (always safe)
import { SafeText } from '@/components/ui/SafeHtml';

function UserProfile({ user }) {
  return (
    <div>
      <h1><SafeText text={user.name} /></h1>
      <p><SafeText text={user.bio} /></p>
    </div>
  );
}

// ❌ BAD: Direct rendering (vulnerable to XSS)
function UserProfile({ user }) {
  return (
    <div>
      <h1>{user.name}</h1> {/* Safe in React, but not if user.name contains HTML */}
      <p dangerouslySetInnerHTML={{ __html: user.bio }} /> {/* DANGEROUS! */}
    </div>
  );
}
```

### Rendering HTML Content

```tsx
// ✅ GOOD: Using SafeHtml with sanitization
import { SafeHtml } from '@/components/ui/SafeHtml';

function TemplatePreview({ html }) {
  return <SafeHtml html={html} className="preview" />;
}

// ❌ BAD: Direct dangerouslySetInnerHTML
function TemplatePreview({ html }) {
  return <div dangerouslySetInnerHTML={{ __html: html }} />; // DANGEROUS!
}
```

### Form Input Validation

```tsx
import { validateAndSanitizeEmail, validatePassword } from '@/lib/utils/input-validation';

function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();

    // Validate and sanitize email
    const emailResult = validateAndSanitizeEmail(email);
    if (!emailResult.valid) {
      alert(emailResult.error);
      return;
    }

    // Validate password
    const passwordResult = validatePassword(password);
    if (!passwordResult.valid) {
      alert(passwordResult.errors.join(', '));
      return;
    }

    // Submit sanitized data
    submitLogin(emailResult.sanitized, password);
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <button type="submit">Login</button>
    </form>
  );
}
```

## Known Vulnerable Patterns

### Template Rendering

The template preview modal renders server-side HTML. This is handled safely by:
1. Using `SafeHtml` component (sanitizes HTML)
2. Rendering in an iframe (isolates from main page)
3. Server-side sanitization (backend should also sanitize)

### Rich Text Editors

If using rich text editors (TipTap, etc.):
- Sanitize content before saving
- Use `SafeHtml` when displaying saved content
- Consider using a library like DOMPurify for advanced sanitization

## Production Recommendations

### 1. Use DOMPurify (Optional but Recommended)

For production, consider using DOMPurify for more robust HTML sanitization:

```bash
npm install dompurify
npm install --save-dev @types/dompurify
```

Then update `sanitizeHtml` function:

```typescript
import DOMPurify from 'dompurify';

export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'a', 'ul', 'ol', 'li', ...],
    ALLOWED_ATTR: ['href', 'title', 'target', 'rel'],
  });
}
```

### 2. Tighten CSP in Production

Remove `'unsafe-inline'` and `'unsafe-eval'` from CSP if possible:

```html
<!-- Production CSP -->
<meta
  http-equiv="Content-Security-Policy"
  content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; ..."
/>
```

### 3. Server-Side Validation

Always validate and sanitize on the backend as well:
- Never trust client-side validation alone
- Backend should sanitize all user input
- Use libraries like `validator` or `sanitize-html` on the server

## Testing XSS Protection

### Test Cases

1. **Script Injection:**
   ```javascript
   // Try injecting: <script>alert('XSS')</script>
   // Should be escaped or removed
   ```

2. **Event Handlers:**
   ```javascript
   // Try: <img src=x onerror="alert('XSS')">
   // Should be sanitized
   ```

3. **JavaScript URLs:**
   ```javascript
   // Try: <a href="javascript:alert('XSS')">Click</a>
   // Should be blocked
   ```

4. **Data URLs:**
   ```javascript
   // Try: <img src="data:text/html,<script>alert('XSS')</script>">
   // Should be blocked for images
   ```

### Manual Testing

1. Enter XSS payloads in form fields
2. Check that they are escaped when displayed
3. Verify CSP headers are present (browser DevTools)
4. Test with browser extensions disabled

## Monitoring

Monitor for:
- CSP violations (check browser console)
- Unusual user input patterns
- Failed validation attempts
- Security headers in production

## Additional Resources

- [OWASP XSS Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)
- [MDN Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- [React Security Best Practices](https://reactjs.org/docs/dom-elements.html#dangerouslysetinnerhtml)

