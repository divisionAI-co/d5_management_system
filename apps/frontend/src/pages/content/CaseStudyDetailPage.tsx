import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Calendar, User, Building } from 'lucide-react';
import { caseStudiesApi } from '@/lib/api/content';
import { SafeHtml } from '@/components/ui/SafeHtml';

export default function CaseStudyDetailPage() {
  const { id } = useParams<{ id: string }>();

  const caseStudyQuery = useQuery({
    queryKey: ['case-study', id],
    queryFn: () => caseStudiesApi.getById(id!),
    enabled: Boolean(id),
  });

  const caseStudy = caseStudyQuery.data;

  if (caseStudyQuery.isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
          <p className="mt-4 text-muted-foreground">Loading case study...</p>
        </div>
      </div>
    );
  }

  if (caseStudyQuery.isError || !caseStudy) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-center">
          <p className="text-lg font-semibold text-foreground">Case study not found</p>
          <p className="mt-2 text-muted-foreground">
            The case study you're looking for doesn't exist or has been deleted.
          </p>
          <Link
            to="/content/case-studies"
            className="mt-4 inline-flex items-center gap-2 text-blue-600 hover:text-blue-700"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Case Studies
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
          to="/content/case-studies"
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Case Studies
        </Link>
      </div>

      {/* Case Study Content */}
      <article className="rounded-xl border border-border bg-card shadow-sm">
        <div className="p-6 space-y-8">
          {/* Title and Meta */}
          <div className="space-y-4">
            <div>
              <h1 className="text-4xl font-bold text-foreground mb-4">{caseStudy.title}</h1>
              
              {caseStudy.excerpt && (
                <p className="text-xl text-muted-foreground mb-6">{caseStudy.excerpt}</p>
              )}

              {/* Client Info */}
              {(caseStudy.clientName || caseStudy.clientLogo || caseStudy.industry) && (
                <div className="flex items-start gap-4 mb-6 p-4 bg-muted rounded-lg">
                  {caseStudy.clientLogo && (
                    <img
                      src={caseStudy.clientLogo}
                      alt={caseStudy.clientName || 'Client'}
                      className="h-16 w-auto object-contain"
                    />
                  )}
                  <div className="flex-1">
                    {caseStudy.clientName && (
                      <div className="flex items-center gap-2 mb-2">
                        <Building className="h-4 w-4 text-muted-foreground" />
                        <span className="text-lg font-semibold text-foreground">
                          {caseStudy.clientName}
                        </span>
                      </div>
                    )}
                    {caseStudy.industry && (
                      <span className="inline-block px-3 py-1 bg-background text-foreground rounded-full text-sm font-medium">
                        {caseStudy.industry}
                      </span>
                    )}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  <span>
                    {caseStudy.author.firstName} {caseStudy.author.lastName}
                  </span>
                </div>
                {caseStudy.publishedAt && (
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    <span>
                      Published {new Date(caseStudy.publishedAt).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </span>
                  </div>
                )}
                {caseStudy.projectDate && (
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    <span>
                      Project Date: {new Date(caseStudy.projectDate).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <span className="px-2 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                    {caseStudy.status}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Featured Image */}
          {caseStudy.featuredImage && (
            <div className="w-full rounded-lg overflow-hidden">
              <img
                src={caseStudy.featuredImage}
                alt={caseStudy.title}
                className="w-full h-auto object-cover"
              />
            </div>
          )}

          {/* About the Customer */}
          {caseStudy.aboutCustomer && (
            <section>
              <h2 className="text-3xl font-bold text-foreground mb-4">About the Customer</h2>
              <div className="prose prose-lg max-w-none">
                <SafeHtml html={caseStudy.aboutCustomer} />
              </div>
            </section>
          )}

          {/* Challenge */}
          {caseStudy.challenge && (
            <section>
              <h2 className="text-3xl font-bold text-foreground mb-4">The Challenge</h2>
              <div className="prose prose-lg max-w-none">
                <SafeHtml html={caseStudy.challenge} />
              </div>
            </section>
          )}

          {/* Solution */}
          {caseStudy.solution && (
            <section>
              <h2 className="text-3xl font-bold text-foreground mb-4">The Solution</h2>
              <div className="prose prose-lg max-w-none">
                <SafeHtml html={caseStudy.solution} />
              </div>
            </section>
          )}

          {/* Results */}
          {caseStudy.results && Object.keys(caseStudy.results).length > 0 && (
            <section className="bg-muted rounded-lg p-6">
              <h2 className="text-3xl font-bold text-foreground mb-6">Results</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.entries(caseStudy.results).map(([key, value]) => (
                  <div key={key} className="bg-background p-4 rounded-lg shadow-sm">
                    <h3 className="text-sm font-semibold text-muted-foreground mb-2">
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
            <section>
              <h2 className="text-3xl font-bold text-foreground mb-4">Additional Information</h2>
              <div className="prose prose-lg max-w-none">
                <SafeHtml html={caseStudy.content} />
              </div>
            </section>
          )}

          {/* SEO Meta Info (if available) */}
          {(caseStudy.metaTitle || caseStudy.metaDescription) && (
            <div className="mt-8 pt-6 border-t border-border">
              <h3 className="text-sm font-semibold text-muted-foreground mb-2">SEO Information</h3>
              <div className="space-y-2 text-sm">
                {caseStudy.metaTitle && (
                  <div>
                    <span className="font-medium text-muted-foreground">Meta Title: </span>
                    <span className="text-foreground">{caseStudy.metaTitle}</span>
                  </div>
                )}
                {caseStudy.metaDescription && (
                  <div>
                    <span className="font-medium text-muted-foreground">Meta Description: </span>
                    <span className="text-foreground">{caseStudy.metaDescription}</span>
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

