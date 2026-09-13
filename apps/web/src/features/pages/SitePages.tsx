import { useMemo, useState } from 'react'
import { ContentPage } from '@/features/pages/ContentPage'
import {
  CTASection,
  FAQAccordion,
  FeatureCard,
  PageSearch,
  SectionHeader,
  SupportCategoryCard,
} from '@/features/pages/marketing'
import { LocaleLink } from '@/i18n/link'
import { useLocale, useT } from '@/i18n'
import { InstallKitsCTA } from '@/components/common/InstallKitsCTA'

function homePath(locale: string) {
  return locale === 'id' ? '/id' : '/'
}

export function AboutPage() {
  const copy = useT()
  const locale = useLocale()
  const p = copy.pages
  return (
    <ContentPage
      eyebrow={p.aboutEyebrow}
      title={p.aboutTitle}
      lead={p.aboutLead}
      crumbs={[
        { name: copy.catalog.home, path: homePath(locale), to: '/' },
        { name: copy.nav.about, path: locale === 'id' ? '/id/about' : '/about' },
      ]}
    >
      <section>
        <h2>{p.aboutWhatHeading}</h2>
        <p>{p.aboutWhat}</p>
      </section>

      <section>
        <h2>{p.aboutProblemsHeading}</h2>
        <p>{p.aboutProblems}</p>
      </section>

      <section>
        <SectionHeader title={p.aboutDoesHeading} />
        <div className="feature-grid">
          <FeatureCard title={p.aboutFeatureImageTitle} copy={p.aboutFeatureImage} />
          <FeatureCard title={p.aboutFeatureBrowserTitle} copy={p.aboutFeatureBrowser} />
          <FeatureCard title={p.aboutFeatureServerTitle} copy={p.aboutFeatureServer} />
          <FeatureCard title={p.aboutFeatureAccessTitle} copy={p.aboutFeatureAccess} />
        </div>
      </section>

      <section>
        <h2>{p.aboutPrivacyHeading}</h2>
        <p>{p.aboutPrivacy}</p>
        <div className="process-grid">
          <FeatureCard title={p.aboutLocalTitle} copy={p.aboutLocalCopy} />
          <FeatureCard title={p.aboutServerTitle} copy={p.aboutServerCopy} />
        </div>
      </section>

      <section>
        <h2>{p.aboutProcessingHeading}</h2>
        <p>{p.aboutProcessing}</p>
        <p><LocaleLink to="/docs/privacy-and-processing">{copy.footer.privacy}</LocaleLink></p>
      </section>

      <section>
        <SectionHeader title={p.aboutWhyHeading} />
        <div className="feature-grid">
          <FeatureCard title={p.aboutWhyFastTitle} copy={p.aboutWhyFast} />
          <FeatureCard title={p.aboutWhySimpleTitle} copy={p.aboutWhySimple} />
          <FeatureCard title={p.aboutWhyPrivacyTitle} copy={p.aboutWhyPrivacy} />
          <FeatureCard title={p.aboutWhyAccountTitle} copy={p.aboutWhyAccount} />
        </div>
      </section>

      <section>
        <h2>{p.aboutProHeading}</h2>
        <p>{p.aboutPro}</p>
      </section>

      <CTASection title={p.exploreTools} copy={p.exploreToolsCopy}>
        <LocaleLink className="button primary" to="/tools">{copy.nav.tools}</LocaleLink>
        <LocaleLink className="button" to="/pricing">{copy.nav.pricing}</LocaleLink>
        <InstallKitsCTA />
      </CTASection>
    </ContentPage>
  )
}

export function SupportPage() {
  const copy = useT()
  const locale = useLocale()
  const p = copy.pages
  const [query, setQuery] = useState('')
  const normalized = query.trim().toLowerCase()

  const topics = [
    { title: copy.footer.gettingStarted, copy: p.supportTopicStart, to: '/docs/getting-started' as const },
    { title: p.supportTopicUploadsTitle, copy: p.supportTopicUploads, href: '#file-limits' },
    { title: copy.nav.license, copy: p.supportTopicLicense, to: '/license' as const },
    { title: copy.footer.imageTools, copy: p.supportTopicImage, to: '/tools/$category' as const, params: { category: 'image' } },
    { title: p.supportTopicMediaTitle, copy: p.supportTopicMedia, to: '/tools/$category' as const, params: { category: 'audio' } },
    { title: copy.footer.troubleshooting, copy: p.supportTopicTrouble, to: '/docs/troubleshooting' as const },
  ]

  const faqs = useMemo(() => [
    { question: p.supportFaqUploadQ, answer: p.supportIssues },
    { question: p.supportFaqFormatsQ, answer: p.supportFormats },
    { question: p.supportFaqServerQ, answer: p.supportProcessing },
    { question: p.supportFaqProQ, answer: p.supportPro },
    { question: p.supportFaqSlowQ, answer: p.supportFaqSlowA },
    { question: p.supportFaqDownloadQ, answer: p.supportFaqDownloadA },
  ], [p])
  const visibleFaqCount = faqs.filter((item) => (
    !normalized || `${item.question} ${item.answer}`.toLowerCase().includes(normalized)
  )).length

  return (
    <ContentPage
      eyebrow={p.supportEyebrow}
      title={p.supportHelpTitle}
      lead={p.supportLead}
      crumbs={[
        { name: copy.catalog.home, path: homePath(locale), to: '/' },
        { name: copy.nav.support, path: locale === 'id' ? '/id/support' : '/support' },
      ]}
      hero={(
        <PageSearch
          id="support-search"
          label={p.searchSupport}
          value={query}
          onChange={setQuery}
          placeholder={p.searchSupport}
        />
      )}
    >
      <section>
        <SectionHeader title={p.supportPopularHeading} />
        <div className="support-topics">
          {topics.map((topic) => (
            <SupportCategoryCard
              key={topic.title}
              title={topic.title}
              copy={topic.copy}
              to={topic.to}
              params={topic.params}
              href={topic.href}
            />
          ))}
        </div>
      </section>

      <section>
        <SectionHeader title={p.supportFaqHeading} />
        {visibleFaqCount === 0 ? <p className="guide-empty">{p.supportEmpty}</p> : null}
        <FAQAccordion
          items={faqs.map((item) => ({
            ...item,
            hidden: Boolean(normalized) && !`${item.question} ${item.answer}`.toLowerCase().includes(normalized),
          }))}
        />
      </section>

      <section>
        <h2>{p.supportIssuesHeading}</h2>
        <p>{p.supportIssues}</p>
      </section>
      <section id="file-limits">
        <h2>{p.supportLimitsHeading}</h2>
        <p>{p.supportLimits}</p>
      </section>
      <section>
        <h2>{p.supportFormatsHeading}</h2>
        <p>{p.supportFormats}</p>
      </section>
      <section>
        <h2>{p.supportProcessingHeading}</h2>
        <p>{p.supportProcessing}</p>
      </section>
      <section>
        <h2>{p.supportProHeading}</h2>
        <p>{p.supportPro}</p>
        <ul className="content-links">
          <li><LocaleLink to="/docs/troubleshooting">{copy.footer.troubleshooting}</LocaleLink></li>
          <li><LocaleLink to="/docs/getting-started">{copy.footer.gettingStarted}</LocaleLink></li>
          <li><LocaleLink to="/docs">{copy.footer.docs}</LocaleLink></li>
          <li><LocaleLink to="/license">{copy.nav.license}</LocaleLink></li>
          <li><LocaleLink to="/guides">{copy.nav.guides}</LocaleLink></li>
        </ul>
      </section>
      <CTASection title={copy.pages.exploreTools} copy={copy.pages.exploreToolsCopy}>
        <LocaleLink className="button primary" to="/tools">{copy.nav.tools}</LocaleLink>
        <LocaleLink className="button" to="/docs/troubleshooting">{copy.footer.troubleshooting}</LocaleLink>
        <InstallKitsCTA />
      </CTASection>
    </ContentPage>
  )
}

export function ContactPage() {
  const copy = useT()
  const locale = useLocale()
  const p = copy.pages
  return (
    <ContentPage
      eyebrow={p.contactEyebrow}
      title={p.contactTitle}
      lead={p.contactLead}
      crumbs={[
        { name: copy.catalog.home, path: homePath(locale), to: '/' },
        { name: copy.footer.contact, path: locale === 'id' ? '/id/contact' : '/contact' },
      ]}
    >
      <section>
        <h2>{p.contactHowHeading}</h2>
        <p>{p.contactHow}</p>
        <ul className="content-links">
          <li><LocaleLink to="/support">{copy.nav.support}</LocaleLink></li>
          <li><LocaleLink to="/docs/troubleshooting">{copy.footer.troubleshooting}</LocaleLink></li>
          <li><LocaleLink to="/license">{copy.nav.license}</LocaleLink></li>
        </ul>
      </section>
    </ContentPage>
  )
}

export function PrivacyPolicyPage() {
  const copy = useT()
  const locale = useLocale()
  const p = copy.pages
  return (
    <ContentPage
      eyebrow={p.privacyEyebrow}
      title={p.privacyTitle}
      lead={p.privacyLead}
      crumbs={[
        { name: copy.catalog.home, path: homePath(locale), to: '/' },
        { name: copy.footer.privacyPolicy, path: locale === 'id' ? '/id/privacy' : '/privacy' },
      ]}
    >
      <section>
        <h2>{p.privacyLocalHeading}</h2>
        <p>{p.privacyLocal}</p>
      </section>
      <section>
        <h2>{p.privacyServerHeading}</h2>
        <p>{p.privacyServer}</p>
      </section>
      <section>
        <h2>{p.privacyAccountsHeading}</h2>
        <p>{p.privacyAccounts}</p>
        <p><LocaleLink to="/docs/privacy-and-processing">{copy.footer.privacy}</LocaleLink></p>
      </section>
    </ContentPage>
  )
}

export function TermsPage() {
  const copy = useT()
  const locale = useLocale()
  const p = copy.pages
  return (
    <ContentPage
      eyebrow={p.termsEyebrow}
      title={p.termsTitle}
      lead={p.termsLead}
      crumbs={[
        { name: copy.catalog.home, path: homePath(locale), to: '/' },
        { name: copy.footer.terms, path: locale === 'id' ? '/id/terms' : '/terms' },
      ]}
    >
      <section>
        <h2>{p.termsUseHeading}</h2>
        <p>{p.termsUse}</p>
      </section>
      <section>
        <h2>{p.termsFilesHeading}</h2>
        <p>{p.termsFiles}</p>
      </section>
      <section>
        <h2>{p.termsLicenseHeading}</h2>
        <p>{p.termsLicense}</p>
      </section>
    </ContentPage>
  )
}
