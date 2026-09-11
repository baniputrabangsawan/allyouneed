import { Link } from '@tanstack/react-router'
import { ArrowRight, Grid2X2 } from 'lucide-react'
import { useRef } from 'react'
import type { ToolCategory } from '@/features/tools/tool-registry'
import { revealFooter } from '@/lib/motion/footer'
import { useGSAP } from '@/lib/motion/gsap'

const explorerSearch = { q: '', category: 'all', group: 'all' } as const

const resources: ReadonlyArray<{ label: string; category: ToolCategory }> = [
  { label: 'Image tools', category: 'image' },
  { label: 'PDF tools', category: 'pdf' },
  { label: 'Audio tools', category: 'audio' },
  { label: 'Video tools', category: 'video' },
  { label: 'Developer tools', category: 'developer' },
  { label: 'QR tools', category: 'qr' },
  { label: 'Text tools', category: 'text' },
  { label: 'Generator tools', category: 'generator' },
  { label: 'Converter tools', category: 'converter' },
]

export function AppFooter() {
  const footerRef = useRef<HTMLElement>(null)

  useGSAP(() => {
    revealFooter(footerRef.current)
  }, { scope: footerRef })

  return (
    <footer ref={footerRef} className="site-footer">
      <div className="footer-stage">
        <p className="footer-wordmark" aria-hidden="true"><span>Kits</span></p>

        <section className="footer-cta" aria-labelledby="footer-cta-heading">
          <p className="eyebrow">All the tools. One place.</p>
          <h2 id="footer-cta-heading">Ready to get more done?</h2>
          <p>Fast, private, and practical tools for everyday work.</p>
          <div className="footer-cta-actions">
            <Link className="button primary" to="/tools">
              Explore all tools
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
            <Link className="button" to="/pricing">Get Kits Pro</Link>
          </div>
        </section>

        <div className="footer-card">
          <div className="footer-card-top">
            <div className="footer-brand">
              <Link to="/" className="brand">
                <span className="brand-mark"><Grid2X2 size={16} /></span>
                Kits
              </Link>
              <p>Small tools. No account. Less waiting.</p>
              <p>Files stay on your device whenever the tool supports it.</p>
            </div>
            <nav className="footer-nav" aria-label="Footer">
              <div className="footer-nav-group">
                <strong>Product</strong>
                <Link to="/tools">All tools</Link>
                <Link to="/" search={explorerSearch} hash="all-tools" resetScroll={false}>Popular</Link>
                <Link to="/" search={explorerSearch} hash="new" resetScroll={false}>New</Link>
                <Link to="/" search={explorerSearch} hash="favorites" resetScroll={false}>Favorites</Link>
                <Link to="/" search={explorerSearch} hash="recent" resetScroll={false}>Recent</Link>
                <Link to="/pricing">Pricing</Link>
              </div>
              <div className="footer-nav-group">
                <strong>Resources</strong>
                {resources.map((item) => (
                  <Link key={item.category} to="/tools/$category" params={{ category: item.category }}>{item.label}</Link>
                ))}
              </div>
              <div className="footer-nav-group">
                <strong>Kits</strong>
                <Link to="/pricing">Pricing</Link>
                <Link to="/license">Activate Pro</Link>
              </div>
            </nav>
          </div>
          <div className="footer-legal">
            <p>© {new Date().getFullYear()} Kits. All rights reserved.</p>
          </div>
        </div>
      </div>
    </footer>
  )
}
