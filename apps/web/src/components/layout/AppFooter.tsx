import { ArrowRight, Grid2X2 } from 'lucide-react'
import { useRef } from 'react'
import type { ToolCategory } from '@/features/tools/tool-registry'
import { LanguageChoices } from '@/components/common/LanguageSwitcher'
import { LocaleLink } from '@/i18n/link'
import { useT } from '@/i18n'
import { useGoHomeTop } from '@/i18n/navigate'
import { revealFooter } from '@/lib/motion/footer'
import { useGSAP } from '@/lib/motion/gsap'

const explorerSearch = { q: '', category: 'all', group: 'all' } as const

const resourceKeys = [
  { key: 'imageTools', category: 'image' },
  { key: 'pdfTools', category: 'pdf' },
  { key: 'audioTools', category: 'audio' },
  { key: 'videoTools', category: 'video' },
  { key: 'developerTools', category: 'developer' },
  { key: 'qrTools', category: 'qr' },
  { key: 'textTools', category: 'text' },
  { key: 'generatorTools', category: 'generator' },
  { key: 'converterTools', category: 'converter' },
] as const satisfies ReadonlyArray<{ key: 'imageTools' | 'pdfTools' | 'audioTools' | 'videoTools' | 'developerTools' | 'qrTools' | 'textTools' | 'generatorTools' | 'converterTools'; category: ToolCategory }>

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
                <strong>{copy.footer.product}</strong>
                <LocaleLink to="/tools">{copy.footer.allTools}</LocaleLink>
                <LocaleLink to="/" search={explorerSearch} hash="all-tools" resetScroll={false}>{copy.footer.popular}</LocaleLink>
                <LocaleLink to="/" search={explorerSearch} hash="new" resetScroll={false}>{copy.nav.new}</LocaleLink>
                <LocaleLink to="/" search={explorerSearch} hash="favorites" resetScroll={false}>{copy.nav.favorites}</LocaleLink>
                <LocaleLink to="/" search={explorerSearch} hash="recent" resetScroll={false}>{copy.nav.recent}</LocaleLink>
                <LocaleLink to="/pricing">{copy.nav.pricing}</LocaleLink>
              </div>
              <div className="footer-nav-group">
                <strong>{copy.footer.resources}</strong>
                <LocaleLink to="/docs">{copy.footer.docs}</LocaleLink>
                <LocaleLink to="/docs/getting-started">{copy.footer.gettingStarted}</LocaleLink>
                <LocaleLink to="/docs/privacy-and-processing">{copy.footer.privacy}</LocaleLink>
                <LocaleLink to="/docs/troubleshooting">{copy.footer.troubleshooting}</LocaleLink>
                {resourceKeys.map((item) => (
                  <LocaleLink key={item.category} to="/tools/$category" params={{ category: item.category }}>{copy.footer[item.key]}</LocaleLink>
                ))}
              </div>
              <div className="footer-nav-group">
                <strong>{copy.footer.kits}</strong>
                <LocaleLink to="/pricing">{copy.nav.pricing}</LocaleLink>
                <LocaleLink to="/license">{copy.nav.license}</LocaleLink>
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
