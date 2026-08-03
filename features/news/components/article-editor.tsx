'use client';

import React, { useState, useEffect } from 'react';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import { NewsArticle, NewsCategory, NewsStatus, NewsVisibility, NewsSEO } from '@/features/news/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Save, 
  Eye, 
  Upload, 
  X, 
  Plus,
  ArrowLeft,
  AlertCircle,
  CheckCircle,
  Loader2,
  Sparkles,
  Newspaper,
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { saveArticle, publishArticle, ArticleFormState } from '@/app/_actions/news';
import { TipTapNewsEditor } from '@/features/news/components/editor/tiptap-news-editor';
import { ArticleVersionSlider } from '@/features/news/components/article-version-slider';
import { GenerateImageDialog } from '@/components/media/generate-image-dialog';
import { GenerateArticleDialog } from '@/components/media/generate-article-dialog';
import {
  coerceMediaImageAsset,
  type MediaImageAsset,
} from '@/lib/file/media-asset';
import type { ContentCommit } from '@/lib/versioning';

const NEWS_DRAFT_KEY = (userId: string) => `news_draft_${userId}`;

interface ArticleEditorProps {
  mode: 'create' | 'edit';
  article?: NewsArticle;
  locale: string;
  /** Override back link (member flow → My News). */
  backHref?: string;
  /** Softens admin-only chrome for member authors. */
  audience?: 'admin' | 'member';
}

interface ArticleEditorFormState {
  title: string;
  slug: string;
  content: string;
  excerpt: string;
  category: NewsCategory;
  tags: string[];
  /** Denormalized preview URL (also submitted as featuredImage). */
  featuredImage: string;
  featuredImageAsset?: MediaImageAsset;
  gallery: MediaImageAsset[];
  status: NewsStatus;
  visibility: NewsVisibility;
  featured: boolean;
  seo: NewsSEO;
}

const initialFormData: ArticleEditorFormState = {
  title: '',
  slug: '',
  content: '',
  excerpt: '',
  category: 'other',
  tags: [],
  featuredImage: '',
  featuredImageAsset: undefined,
  gallery: [],
  status: 'draft',
  visibility: 'public',
  featured: false,
  seo: {
    metaTitle: '',
    metaDescription: '',
    keywords: [],
    canonicalUrl: '',
    ogImage: '',
    ogTitle: '',
    ogDescription: '',
    twitterTitle: '',
    twitterDescription: '',
    twitterImage: ''
  }
};

function assetFromUpload(result: {
  url: string
  fileId?: string
  derivatives?: MediaImageAsset['derivatives']
}): MediaImageAsset {
  return {
    url: result.url,
    ...(result.fileId ? { fileId: result.fileId } : {}),
    ...(result.derivatives ? { derivatives: result.derivatives } : {}),
  }
}

function appendArticleFormFields(
  form: FormData,
  mode: 'create' | 'edit',
  articleId: string | undefined,
  locale: string,
  state: ArticleEditorFormState,
  status: NewsStatus,
) {
  form.append('mode', mode);
  if (articleId) form.append('articleId', articleId);
  form.append('locale', locale);
  form.append('title', state.title);
  form.append('slug', state.slug);
  form.append('content', state.content);
  form.append('excerpt', state.excerpt);
  form.append('category', state.category);
  form.append('status', status);
  form.append('visibility', state.visibility);
  form.append('featured', state.featured.toString());
  form.append('featuredImage', state.featuredImage);
  if (state.featuredImageAsset) {
    form.append('featuredImageAsset', JSON.stringify(state.featuredImageAsset));
  }
  form.append('tags', state.tags.join(','));
  form.append('gallery', JSON.stringify(state.gallery));

  Object.entries(state.seo).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      form.append(`seo${key.charAt(0).toUpperCase() + key.slice(1)}`, value.join(','));
    } else {
      form.append(`seo${key.charAt(0).toUpperCase() + key.slice(1)}`, value || '');
    }
  });
}

const categories: { value: NewsCategory; label: string; color: string }[] = [
  { value: 'other', label: 'Other', color: '#6B7280' },
  { value: 'platform-updates', label: 'Platform Updates', color: '#3B82F6' },
  { value: 'community', label: 'Community', color: '#10B981' },
  { value: 'partnerships', label: 'Partnerships', color: '#8B5CF6' },
  { value: 'industry-news', label: 'Industry News', color: '#F59E0B' },
  { value: 'events', label: 'Events', color: '#EF4444' },
  { value: 'announcements', label: 'Announcements', color: '#EC4899' }
];

/**
 * Submit Button Component with useFormStatus
 * Automatically handles loading states with React 19
 */
function SubmitButton({ 
  children, 
  variant = "default", 
  className = "",
  type = "submit"
}: { 
  children: React.ReactNode; 
  variant?: "default" | "outline";
  className?: string;
  type?: "submit" | "button";
}) {
  const { pending } = useFormStatus()
  
  return (
    <Button
      type={type}
      variant={variant}
      className={`w-full ${className}`}
      disabled={pending}
    >
      {pending ? (
        <>
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          {variant === "outline" ? "Saving..." : "Publishing..."}
        </>
      ) : (
        <>
          <Save className="h-4 w-4 mr-2" />
          {children}
        </>
      )}
    </Button>
  )
}

export function ArticleEditor({
  mode,
  article,
  locale,
  backHref,
  audience = 'admin',
}: ArticleEditorProps) {
  const router = useRouter();
  const { data: session } = useSession();
  const tNews = useTranslations('news');
  const initialAsset =
    article?.featuredImageAsset ||
    coerceMediaImageAsset(article?.featuredImage);
  const [formData, setFormData] = useState<ArticleEditorFormState>(
    article ? {
      title: article.title,
      slug: article.slug,
      content: article.content,
      excerpt: article.excerpt,
      category: article.category,
      tags: article.tags,
      featuredImage: initialAsset?.url || article.featuredImage || '',
      featuredImageAsset: initialAsset,
      gallery: article.gallery || [],
      status: article.status,
      visibility: article.visibility,
      featured: article.featured,
      seo: article.seo || initialFormData.seo
    } : initialFormData
  );
  
  const [newTag, setNewTag] = useState('');
  const [previewMode, setPreviewMode] = useState(false);
  const [generateFeaturedOpen, setGenerateFeaturedOpen] = useState(false);
  const [generateGalleryOpen, setGenerateGalleryOpen] = useState(false);
  const [generateArticleOpen, setGenerateArticleOpen] = useState(false);
  const versionCommits: ContentCommit[] = (article?.versions?.commits ?? []) as ContentCommit[];
  const tipIndex = Math.max(0, versionCommits.length - 1);
  const [viewingCommitIndex, setViewingCommitIndex] = useState(tipIndex);
  const [localDraftHydrated, setLocalDraftHydrated] = useState(false);
  const viewingHistorical =
    versionCommits.length > 1 && viewingCommitIndex < tipIndex;

  // Hydrate unsaved create draft from localStorage (not version history)
  useEffect(() => {
    if (mode !== 'create' || !session?.user?.id) return;
    try {
      const raw = localStorage.getItem(NEWS_DRAFT_KEY(session.user.id));
      if (!raw) return;
      const draft = JSON.parse(raw) as Partial<ArticleEditorFormState>;
      if (!draft.title && !draft.content && !draft.excerpt) return;
      setFormData((prev) => ({
        ...prev,
        title: draft.title || prev.title,
        slug: draft.slug || prev.slug,
        content: draft.content || prev.content,
        excerpt: draft.excerpt || prev.excerpt,
        tags: Array.isArray(draft.tags) ? draft.tags : prev.tags,
        category: (draft.category as NewsCategory) || prev.category,
      }));
      setLocalDraftHydrated(true);
    } catch {
      // ignore corrupt draft
    }
  }, [mode, session?.user?.id]);

  // Persist create draft (debounced)
  useEffect(() => {
    if (mode !== 'create' || !session?.user?.id) return;
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(
          NEWS_DRAFT_KEY(session.user.id),
          JSON.stringify({
            title: formData.title,
            slug: formData.slug,
            content: formData.content,
            excerpt: formData.excerpt,
            tags: formData.tags,
            category: formData.category,
          }),
        );
      } catch {
        // quota / private mode
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [
    mode,
    session?.user?.id,
    formData.title,
    formData.slug,
    formData.content,
    formData.excerpt,
    formData.tags,
    formData.category,
  ]);

  const handleVersionSelect = (index: number) => {
    setViewingCommitIndex(index);
    const commit = versionCommits[index];
    if (commit?.content != null) {
      setFormData((prev) => ({ ...prev, content: commit.content }));
    }
  };

  // React 19 useActionState for draft saving
  const [draftState, draftAction] = useActionState<ArticleFormState | null, ArticleEditorFormState>(
    async (prevState: ArticleFormState | null, state: ArticleEditorFormState) => {
      const form = new FormData();
      appendArticleFormFields(form, mode, article?.id, locale, state, 'draft');
      try {
        const result = await saveArticle(prevState, form);
        return result;
      } catch (error: unknown) {
        // Successful save redirects — clear local draft only then (not on validation failure)
        const msg = error instanceof Error ? error.message : String(error);
        const digest =
          typeof error === 'object' && error && 'digest' in error
            ? String((error as { digest?: string }).digest ?? '')
            : '';
        if (msg.includes('NEXT_REDIRECT') || digest.startsWith('NEXT_REDIRECT')) {
          if (mode === 'create' && session?.user?.id) {
            try {
              localStorage.removeItem(NEWS_DRAFT_KEY(session.user.id));
            } catch {
              // ignore
            }
          }
        }
        throw error;
      }
    },
    null
  );

  // React 19 useActionState for publishing
  const [publishState, publishAction] = useActionState<ArticleFormState | null, ArticleEditorFormState>(
    async (prevState: ArticleFormState | null, state: ArticleEditorFormState) => {
      const form = new FormData();
      appendArticleFormFields(form, mode, article?.id, locale, state, 'published');
      try {
        const result = await publishArticle(prevState, form);
        return result;
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        const digest =
          typeof error === 'object' && error && 'digest' in error
            ? String((error as { digest?: string }).digest ?? '')
            : '';
        if (msg.includes('NEXT_REDIRECT') || digest.startsWith('NEXT_REDIRECT')) {
          if (mode === 'create' && session?.user?.id) {
            try {
              localStorage.removeItem(NEWS_DRAFT_KEY(session.user.id));
            } catch {
              // ignore
            }
          }
        }
        throw error;
      }
    },
    null
  );

  // Auto-generate slug from title
  useEffect(() => {
    if (mode === 'create' && formData.title && !formData.slug) {
      const slug = formData.title
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim();
      setFormData(prev => ({ ...prev, slug }));
    }
  }, [formData.title, mode]);

  // Auto-generate SEO fields from content
  useEffect(() => {
    if (formData.title && !formData.seo.metaTitle) {
      setFormData(prev => ({
        ...prev,
        seo: {
          ...prev.seo,
          metaTitle: formData.title,
          ogTitle: formData.title,
          twitterTitle: formData.title
        }
      }));
    }
    
    if (formData.excerpt && !formData.seo.metaDescription) {
      setFormData(prev => ({
        ...prev,
        seo: {
          ...prev.seo,
          metaDescription: formData.excerpt,
          ogDescription: formData.excerpt,
          twitterDescription: formData.excerpt
        }
      }));
    }
  }, [formData.title, formData.excerpt]);

  const handleInputChange = (field: keyof ArticleEditorFormState, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSEOChange = (field: keyof NewsSEO, value: string) => {
    setFormData(prev => ({
      ...prev,
      seo: { ...prev.seo, [field]: value }
    }));
  };

  const addTag = () => {
    if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, newTag.trim()]
      }));
      setNewTag('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }));
  };

  const handleImageUpload = async (file: File, type: 'featured' | 'gallery') => {
    try {
      const uploadForm = new FormData();
      uploadForm.append('file', file);
      uploadForm.append('purpose', type === 'featured' ? 'news-featured' : 'news-gallery');
      
      const response = await fetch('/api/entities/upload', {
        method: 'POST',
        body: uploadForm,
      });
      
      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Upload failed' }));
        throw new Error(err.error || `Upload failed with status ${response.status}`);
      }
      
      const result = await response.json();
      
      if (!result.success || !result.url) {
        throw new Error(result.error || 'Upload returned no URL');
      }

      const asset = assetFromUpload(result);
      
      if (type === 'featured') {
        setFormData(prev => ({
          ...prev,
          featuredImage: asset.url,
          featuredImageAsset: asset,
        }));
      } else {
        setFormData(prev => ({
          ...prev,
          gallery: [...prev.gallery, asset],
        }));
      }
    } catch (error) {
      console.error('Image upload error:', error);
      // Fallback: use object URL as placeholder so the UI remains usable
      const fallbackUrl = URL.createObjectURL(file);
      const fallbackAsset: MediaImageAsset = { url: fallbackUrl };
      if (type === 'featured') {
        setFormData(prev => ({
          ...prev,
          featuredImage: fallbackUrl,
          featuredImageAsset: fallbackAsset,
        }));
      } else {
        setFormData(prev => ({
          ...prev,
          gallery: [...prev.gallery, fallbackAsset],
        }));
      }
    }
  };

  const removeGalleryImage = (index: number) => {
    setFormData(prev => ({
      ...prev,
      gallery: prev.gallery.filter((_, i) => i !== index)
    }));
  };

  const getCategoryColor = (category: NewsCategory) => {
    return categories.find(cat => cat.value === category)?.color || '#6B7280';
  };

  const resolvedBackHref =
    backHref ??
    (audience === 'member' ? `/${locale}/my-news` : `/${locale}/admin/news`)

  // Get current state for error/success display
  const currentState = draftState || publishState;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Link 
          href={resolvedBackHref}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" />
          {audience === 'member' ? 'Back to My News' : 'Back to Articles'}
        </Link>
        
        <div className="flex items-center gap-2">
          {mode === 'create' ? (
            <Button type="button" variant="secondary" onClick={() => setGenerateArticleOpen(true)}>
              <Newspaper className="h-4 w-4 mr-2" />
              Generate with AI
            </Button>
          ) : null}
          <Button
            variant="outline"
            onClick={() => setPreviewMode(!previewMode)}
          >
            <Eye className="h-4 w-4 mr-2" />
            {previewMode ? 'Edit' : 'Preview'}
          </Button>
        </div>
      </div>

      {/* Alerts */}
      {currentState?.error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{currentState.error}</AlertDescription>
        </Alert>
      )}

      {currentState?.fieldErrors && Object.keys(currentState.fieldErrors).length > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Please fix the following errors:
            <ul className="mt-2 list-disc list-inside">
              {Object.entries(currentState.fieldErrors).map(([field, error]) => (
                <li key={field}>{error}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {currentState?.success && (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>{currentState.message}</AlertDescription>
        </Alert>
      )}

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Editor */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Article Content</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Title */}
              <div className="space-y-2">
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => handleInputChange('title', e.target.value)}
                  placeholder="Enter article title..."
                  className="text-lg font-semibold"
                />
              </div>

              {/* Slug */}
              <div className="space-y-2">
                <Label htmlFor="slug">URL Slug *</Label>
                <Input
                  id="slug"
                  value={formData.slug}
                  onChange={(e) => handleInputChange('slug', e.target.value)}
                  placeholder="article-url-slug"
                />
                <p className="text-sm text-gray-500">
                  URL: /{locale}/news/{formData.slug}
                </p>
              </div>

              {/* Excerpt */}
              <div className="space-y-2">
                <Label htmlFor="excerpt">Excerpt *</Label>
                <Textarea
                  id="excerpt"
                  value={formData.excerpt}
                  onChange={(e) => handleInputChange('excerpt', e.target.value)}
                  placeholder="Brief description of the article..."
                  rows={3}
                />
                <p className="text-sm text-gray-500">
                  {formData.excerpt.length}/300 characters
                </p>
              </div>

              {/* Content — TipTap NewsEditor (slash /, embeds, mood player) */}
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Label htmlFor="content">Content *</Label>
                  {localDraftHydrated ? (
                    <Badge variant="secondary">{tNews('versions.localDraft')}</Badge>
                  ) : null}
                </div>
                {versionCommits.length > 1 ? (
                  <ArticleVersionSlider
                    commits={versionCommits}
                    selectedIndex={viewingCommitIndex}
                    onSelect={handleVersionSelect}
                  />
                ) : null}
                {viewingHistorical ? (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      {tNews('versions.historicalBanner')}
                    </AlertDescription>
                  </Alert>
                ) : null}
                <TipTapNewsEditor
                  key={`ver-${viewingCommitIndex}-${versionCommits[viewingCommitIndex]?.id ?? 'tip'}`}
                  content={formData.content}
                  onChange={(content) => handleInputChange('content', content)}
                  articleId={article?.id}
                  placeholder={tNews('editor.placeholder')}
                />
                <p className="text-sm text-gray-500">{tNews('editor.tipTapHint')}</p>
              </div>
            </CardContent>
          </Card>

          {/* SEO Settings */}
          <Card>
            <CardHeader>
              <CardTitle>SEO Settings</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="basic" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="basic">Basic SEO</TabsTrigger>
                  <TabsTrigger value="social">Social Media</TabsTrigger>
                  <TabsTrigger value="advanced">Advanced</TabsTrigger>
                </TabsList>
                
                <TabsContent value="basic" className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="metaTitle">Meta Title</Label>
                    <Input
                      id="metaTitle"
                      value={formData.seo.metaTitle}
                      onChange={(e) => handleSEOChange('metaTitle', e.target.value)}
                      placeholder="SEO title for search engines"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="metaDescription">Meta Description</Label>
                    <Textarea
                      id="metaDescription"
                      value={formData.seo.metaDescription}
                      onChange={(e) => handleSEOChange('metaDescription', e.target.value)}
                      placeholder="SEO description for search engines"
                      rows={3}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="keywords">Keywords</Label>
                    <Input
                      id="keywords"
                      value={formData.seo.keywords?.join(', ') || ''}
                      onChange={(e) => handleSEOChange('keywords', e.target.value)}
                      placeholder="keyword1, keyword2, keyword3"
                    />
                  </div>
                </TabsContent>
                
                <TabsContent value="social" className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="ogTitle">Open Graph Title</Label>
                    <Input
                      id="ogTitle"
                      value={formData.seo.ogTitle}
                      onChange={(e) => handleSEOChange('ogTitle', e.target.value)}
                      placeholder="Title for social media sharing"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="ogDescription">Open Graph Description</Label>
                    <Textarea
                      id="ogDescription"
                      value={formData.seo.ogDescription}
                      onChange={(e) => handleSEOChange('ogDescription', e.target.value)}
                      placeholder="Description for social media sharing"
                      rows={3}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="twitterTitle">Twitter Title</Label>
                    <Input
                      id="twitterTitle"
                      value={formData.seo.twitterTitle}
                      onChange={(e) => handleSEOChange('twitterTitle', e.target.value)}
                      placeholder="Title for Twitter sharing"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="twitterDescription">Twitter Description</Label>
                    <Textarea
                      id="twitterDescription"
                      value={formData.seo.twitterDescription}
                      onChange={(e) => handleSEOChange('twitterDescription', e.target.value)}
                      placeholder="Description for Twitter sharing"
                      rows={3}
                    />
                  </div>
                </TabsContent>
                
                <TabsContent value="advanced" className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="canonicalUrl">Canonical URL</Label>
                    <Input
                      id="canonicalUrl"
                      value={formData.seo.canonicalUrl}
                      onChange={(e) => handleSEOChange('canonicalUrl', e.target.value)}
                      placeholder="https://example.com/canonical-url"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="ogImage">Open Graph Image URL</Label>
                    <Input
                      id="ogImage"
                      value={formData.seo.ogImage}
                      onChange={(e) => handleSEOChange('ogImage', e.target.value)}
                      placeholder="https://example.com/og-image.jpg"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="twitterImage">Twitter Image URL</Label>
                    <Input
                      id="twitterImage"
                      value={formData.seo.twitterImage}
                      onChange={(e) => handleSEOChange('twitterImage', e.target.value)}
                      placeholder="https://example.com/twitter-image.jpg"
                    />
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Publish Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Publish Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Status */}
              <div className="space-y-2">
                <Label>Status</Label>
                <Select 
                  value={formData.status} 
                  onValueChange={(value) => handleInputChange('status', value as NewsStatus)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="published">Published</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Visibility */}
              <div className="space-y-2">
                <Label>Visibility</Label>
                <Select 
                  value={formData.visibility} 
                  onValueChange={(value) => handleInputChange('visibility', value as NewsVisibility)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public">Public</SelectItem>
                    <SelectItem value="subscriber">Subscriber Only</SelectItem>
                    <SelectItem value="member">Member Only</SelectItem>
                    <SelectItem value="confidential">Confidential</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Featured */}
              <div className="flex items-center justify-between">
                <Label htmlFor="featured">Featured Article</Label>
                <Switch
                  id="featured"
                  checked={formData.featured}
                  onCheckedChange={(checked) => handleInputChange('featured', checked)}
                />
              </div>

              <Separator />

              {/* Action Buttons with React 19 Forms */}
              <div className="space-y-2">
                <form action={() => draftAction(formData)}>
                  <SubmitButton variant="outline">
                    Save as Draft
                  </SubmitButton>
                </form>
                
                <form action={() => publishAction(formData)}>
                  <SubmitButton>
                    Publish Article
                  </SubmitButton>
                </form>
              </div>
            </CardContent>
          </Card>

          {/* Category & Tags */}
          <Card>
            <CardHeader>
              <CardTitle>Category & Tags</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Category */}
              <div className="space-y-2">
                <Label>Category</Label>
                <Select 
                  value={formData.category} 
                  onValueChange={(value) => handleInputChange('category', value as NewsCategory)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem key={category.value} value={category.value}>
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: category.color }}
                          />
                          {category.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Tags */}
              <div className="space-y-2">
                <Label>Tags</Label>
                <div className="flex gap-2">
                  <Input
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    placeholder="Add tag..."
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                  />
                  <Button onClick={addTag} size="sm">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                
                <div className="flex flex-wrap gap-2">
                  {formData.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="flex items-center gap-1">
                      {tag}
                      <X 
                        className="h-3 w-3 cursor-pointer" 
                        onClick={() => removeTag(tag)}
                      />
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <GenerateArticleDialog
            open={generateArticleOpen}
            onOpenChange={setGenerateArticleOpen}
            onArticleReady={({ articleId }) => {
              router.push(`/${locale}/admin/news/edit/${articleId}`);
            }}
          />
          <GenerateImageDialog
            open={generateFeaturedOpen}
            onOpenChange={setGenerateFeaturedOpen}
            purpose={article?.id ? `news-featured-${article.id}` : 'news-featured'}
            defaultAspectRatio="16:9"
            title="Generate featured image"
            onImageReady={(url) => {
              const asset: MediaImageAsset = { url };
              setFormData((prev) => ({
                ...prev,
                featuredImage: url,
                featuredImageAsset: asset,
                seo: { ...prev.seo, ogImage: url, twitterImage: url },
              }));
            }}
          />
          <GenerateImageDialog
            open={generateGalleryOpen}
            onOpenChange={setGenerateGalleryOpen}
            purpose={article?.id ? `news-gallery-${article.id}` : 'news-gallery'}
            defaultAspectRatio="4:3"
            title="Generate gallery image"
            onImageReady={(url) => {
              setFormData((prev) => ({
                ...prev,
                gallery: [...prev.gallery, { url }],
              }));
            }}
          />

          {/* Featured Image */}
          <Card>
            <CardHeader>
              <CardTitle>Featured Image</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {formData.featuredImage ? (
                <div className="relative">
                  <img 
                    src={formData.featuredImage} 
                    alt="Featured" 
                    className="w-full h-32 object-cover rounded"
                  />
                  <Button
                    variant="destructive"
                    size="sm"
                    className="absolute top-2 right-2"
                    onClick={() =>
                      setFormData((prev) => ({
                        ...prev,
                        featuredImage: '',
                        featuredImageAsset: undefined,
                      }))
                    }
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center space-y-3">
                  <Upload className="h-8 w-8 mx-auto text-gray-400 mb-2" />
                  <p className="text-sm text-gray-500">Upload or generate featured image</p>
                  <div className="flex flex-col gap-2 items-center">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleImageUpload(file, 'featured');
                      }}
                    />
                    <Button type="button" variant="outline" size="sm" onClick={() => setGenerateFeaturedOpen(true)}>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Generate image
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Gallery */}
          <Card>
            <CardHeader>
              <CardTitle>Gallery</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                {formData.gallery.map((image, index) => (
                  <div key={image.fileId || image.url || index} className="relative">
                    <img 
                      src={image.url} 
                      alt={`Gallery ${index + 1}`} 
                      className="w-full h-20 object-cover rounded"
                    />
                    <Button
                      variant="destructive"
                      size="sm"
                      className="absolute top-1 right-1 h-6 w-6 p-0"
                      onClick={() => removeGalleryImage(index)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
              
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center space-y-2">
                <Upload className="h-6 w-6 mx-auto text-gray-400 mb-2" />
                <p className="text-xs text-gray-500">Upload or generate gallery image</p>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    files.forEach(file => handleImageUpload(file, 'gallery'));
                  }}
                  className="mt-1 text-xs"
                />
                <Button type="button" variant="outline" size="sm" onClick={() => setGenerateGalleryOpen(true)}>
                  <Sparkles className="h-4 w-4 mr-1" />
                  Generate
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
} 