import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Calendar, User } from 'lucide-react';
import { blogsApi } from '@/lib/api/content';
import { SafeHtml } from '@/components/ui/SafeHtml';

export default function BlogDetailPage() {
  const { id } = useParams<{ id: string }>();

  const blogQuery = useQuery({
    queryKey: ['blog', id],
    queryFn: () => blogsApi.getById(id!),
    enabled: Boolean(id),
  });

  const blog = blogQuery.data;

  if (blogQuery.isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
          <p className="mt-4 text-muted-foreground">Loading blog...</p>
        </div>
      </div>
    );
  }

  if (blogQuery.isError || !blog) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-center">
          <p className="text-lg font-semibold text-foreground">Blog not found</p>
          <p className="mt-2 text-muted-foreground">
            The blog you're looking for doesn't exist or has been deleted.
          </p>
          <Link
            to="/content/blogs"
            className="mt-4 inline-flex items-center gap-2 text-blue-600 hover:text-blue-700"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Blogs
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Link
          to="/content/blogs"
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Blogs
        </Link>
      </div>

      {/* Blog Content */}
      <article className="rounded-xl border border-border bg-card shadow-sm">
        <div className="p-6 space-y-6">
          {/* Title and Meta */}
          <div className="space-y-4">
            <div>
              <h1 className="text-4xl font-bold text-foreground mb-4">{blog.title}</h1>
              
              {blog.excerpt && (
                <p className="text-xl text-muted-foreground mb-6">{blog.excerpt}</p>
              )}

              <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  <span>
                    {blog.author.firstName} {blog.author.lastName}
                  </span>
                </div>
                {blog.publishedAt && (
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    <span>
                      Published {new Date(blog.publishedAt).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  <span>
                    Created {new Date(blog.createdAt).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                    {blog.status}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Featured Image */}
          {blog.featuredImage && (
            <div className="w-full rounded-lg overflow-hidden">
              <img
                src={blog.featuredImage}
                alt={blog.title}
                className="w-full h-auto object-cover"
              />
            </div>
          )}

          {/* Content */}
          <div className="prose prose-lg max-w-none">
            <SafeHtml html={blog.content} />
          </div>

          {/* SEO Meta Info (if available) */}
          {(blog.metaTitle || blog.metaDescription) && (
            <div className="mt-8 pt-6 border-t border-border">
              <h3 className="text-sm font-semibold text-muted-foreground mb-2">SEO Information</h3>
              <div className="space-y-2 text-sm">
                {blog.metaTitle && (
                  <div>
                    <span className="font-medium text-muted-foreground">Meta Title: </span>
                    <span className="text-foreground">{blog.metaTitle}</span>
                  </div>
                )}
                {blog.metaDescription && (
                  <div>
                    <span className="font-medium text-muted-foreground">Meta Description: </span>
                    <span className="text-foreground">{blog.metaDescription}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </article>
    </div>
  );
}

