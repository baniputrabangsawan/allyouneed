import { ContentPage } from '@/features/pages/ContentPage'
import { LocaleLink } from '@/i18n/link'
import { useLocale, useT } from '@/i18n'

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
        <h2>{p.aboutPrivacyHeading}</h2>
        <p>{p.aboutPrivacy}</p>
        <p><LocaleLink to="/docs/privacy-and-processing">{copy.footer.privacy}</LocaleLink></p>
      </section>
      <section>
        <h2>{p.aboutProcessingHeading}</h2>
        <p>{p.aboutProcessing}</p>
      </section>
      <section>
        <h2>{p.aboutProHeading}</h2>
        <p>{p.aboutPro}</p>
        <p>
          <LocaleLink to="/pricing">{copy.nav.pricing}</LocaleLink>
          {' · '}
          <LocaleLink to="/license">{copy.nav.license}</LocaleLink>
        </p>
      </section>
    </ContentPage>
  )
}

export function SupportPage() {
  const copy = useT()
  const locale = useLocale()
  const p = copy.pages
  return (
    <ContentPage
      eyebrow={p.supportEyebrow}
      title={p.supportTitle}
      lead={p.supportLead}
      crumbs={[
        { name: copy.catalog.home, path: homePath(locale), to: '/' },
        { name: copy.nav.support, path: locale === 'id' ? '/id/support' : '/support' },
      ]}
    >
      <section>
        <h2>{p.supportIssuesHeading}</h2>
        <p>{p.supportIssues}</p>
      </section>
      <section>
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
