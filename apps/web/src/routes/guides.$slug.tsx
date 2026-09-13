import { createFileRoute, notFound } from '@tanstack/react-router'
import { getGuide, guideCopy, guideJsonLd, guidePath } from '@/content/guides/catalog'
import { GuideArticlePage } from '@/features/pages/GuidesPages'
import { marketingHead } from '@/features/seo/page-head'

export const Route = createFileRoute('/guides/$slug')({
  beforeLoad: ({ params }) => {
    if (!getGuide(params.slug)) throw notFound()
  },
  head: ({ params }) => {
    const article = getGuide(params.slug)
    if (!article) return { meta: [{ title: 'Guide | Kits' }] }
    const copy = guideCopy(article, 'en')
    const head = marketingHead('en', guidePath(article.slug), `${copy.title} | Kits`, copy.description)
    const jsonLd = guideJsonLd(article.slug, 'en')
    return jsonLd ? { ...head, scripts: [{ type: 'application/ld+json', children: JSON.stringify(jsonLd) }] } : head
  },
  component: GuideArticleRoute,
})

function GuideArticleRoute() {
  const { slug } = Route.useParams()
  return <GuideArticlePage slug={slug} />
}
