import { ArrowRight, Grid2X2 } from 'lucide-react'
import { useRef } from 'react'
import { footerToolNav } from '@/components/layout/primary-nav'
import { LanguageChoices } from '@/components/common/LanguageSwitcher'
import { InstallKitsCTA } from '@/components/common/InstallKitsCTA'
import { LocaleLink } from '@/i18n/link'
import { useT } from '@/i18n'
import { useGoHomeTop } from '@/i18n/navigate'
import { revealFooter } from '@/lib/motion/footer'
import { useGSAP } from '@/lib/motion/gsap'

export function AppFooter() {
  const copy = useT()
  const goHomeTop = useGoHomeTop()
  const footerRef = useRef<HTMLElement>(null)

  useGSAP(() => {
    revealFooter(footerRef.current)
  }, { scope: footerRef })

  return (
    <footer ref={footerRef} className="site-footer">
      <div className="footer-stage">
        <p className="footer-wordmark" aria-hidden="true"><span>{copy.brand}</span></p>

        <section className="footer-cta" aria-labelledby="footer-cta-heading">
          <p className="eyebrow">{copy.footer.ctaEyebrow}</p>
          <h2 id="footer-cta-heading">{copy.footer.ctaTitle}</h2>
          <p>{copy.footer.ctaCopy}</p>
          <div className="footer-cta-actions">
            <LocaleLink className="button primary" to="/tools">
              {copy.footer.explore}
              <ArrowRight size={16} aria-hidden="true" />
            </LocaleLink>
            <LocaleLink className="button" to="/pricing">{copy.footer.getPro}</LocaleLink>
            <InstallKitsCTA />
          </div>
        </section>

        <div className="footer-card">
          <div className="footer-card-top">
            <div className="footer-brand">
              <LocaleLink to="/" className="brand" onClick={goHomeTop}>
                <span className="brand-mark"><Grid2X2 size={16} /></span>
                {copy.brand}
              </LocaleLink>
              <p>{copy.footer.tagline}</p>
              <p>{copy.footer.filesStay}</p>
            </div>
            <nav className="footer-nav" aria-label="Footer">
              <div className="footer-nav-group">
                <strong>{copy.footer.company}</strong>
                <LocaleLink to="/about">{copy.footer.about}</LocaleLink>
                <LocaleLink to="/contact">{copy.footer.contact}</LocaleLink>
              </div>
              <div className="footer-nav-group">
                <strong>{copy.footer.resources}</strong>
                <LocaleLink to="/guides">{copy.footer.guides}</LocaleLink>
                <LocaleLink to="/docs">{copy.footer.docs}</LocaleLink>
                <LocaleLink to="/support">{copy.footer.support}</LocaleLink>
              </div>
              <div className="footer-nav-group">
                <strong>{copy.nav.tools}</strong>
                {footerToolNav.map((item) => (
                  <LocaleLink key={item.category} to="/tools/$category" params={{ category: item.category }}>
                    {copy.footer[item.key]}
                  </LocaleLink>
                ))}
                <InstallKitsCTA variant="link" />
              </div>
              <div className="footer-nav-group">
                <strong>{copy.pages.privacyEyebrow}</strong>
                <LocaleLink to="/privacy">{copy.footer.privacyPolicy}</LocaleLink>
                <LocaleLink to="/terms">{copy.footer.terms}</LocaleLink>
                <a href="/sitemap.xml">{copy.footer.sitemap}</a>
                <LanguageChoices />
              </div>
            </nav>
          </div>
          <div className="footer-legal">
            <p>{copy.footer.legal(new Date().getFullYear())}</p>
          </div>
        </div>
      </div>
    </footer>
  )
}
