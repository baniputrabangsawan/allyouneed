import { createFileRoute, notFound } from '@tanstack/react-router'
import { getGuide, guideCopy, guideJsonLd, guidePath } from '@/content/guides/catalog'
import { GuideArticlePage } from '@/features/pages/GuidesPages'
import { marketingHead } from '@/features/seo/page-head'

export const Route = createFileRoute('/id/guides/$slug')({
  beforeLoad: ({ params }) => {
    if (!getGuide(params.slug)) throw notFound()
  },
  head: ({ params }) => {
    const article = getGuide(params.slug)
    if (!article) return { meta: [{ title: 'Panduan | Kits' }] }
    const copy = guideCopy(article, 'id')
    const head = marketingHead('id', guidePath(article.slug), `${copy.title} | Kits`, copy.description)
    const jsonLd = guideJsonLd(article.slug, 'id')
    return jsonLd ? { ...head, scripts: [{ type: 'application/ld+json', children: JSON.stringify(jsonLd) }] } : head
  },
  component: GuideArticleRoute,
})

function GuideArticleRoute() {
  const { slug } = Route.useParams()
  return <GuideArticlePage slug={slug} />
}
