import { Grid2X2 } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useT } from '@/i18n'
import { analytics } from '@/lib/analytics'
import { useInstallPrompt } from '@/lib/use-install-prompt'

export function InstallKitsCTA({
  variant = 'button',
}: {
  variant?: 'button' | 'secondary' | 'link' | 'row'
}) {
  const copy = useT()
  const { status, iosHelp, setIosHelp, promptInstall } = useInstallPrompt()
  const seen = useRef(false)

  useEffect(() => {
    if (seen.current || (status !== 'prompt' && status !== 'ios')) return
    seen.current = true
    analytics.track({ name: 'install_cta_view' })
  }, [status])

  if (status === 'hidden' || status === 'installed') return null

  async function activate() {
    analytics.track({ name: 'install_cta_click' })
    if (status === 'ios') {
      setIosHelp(true)
      return
    }
    const outcome = await promptInstall()
    if (outcome === 'accepted') analytics.track({ name: 'install_accepted' })
    if (outcome === 'dismissed') analytics.track({ name: 'install_dismissed' })
  }

  const hint = iosHelp ? <p className="install-ios-hint">{copy.install.iosHint}</p> : null

  if (variant === 'link') {
    return (
      <>
        <button type="button" className="install-cta-link" aria-label={copy.install.aria} onClick={() => void activate()}>
          {copy.install.cta}
        </button>
        {hint}
      </>
    )
  }

  if (variant === 'row') {
    return (
      <>
        <p className="mobile-sheet-label">{copy.install.appSection}</p>
        <button type="button" className="mobile-sheet-row" aria-label={copy.install.aria} onClick={() => void activate()}>
          <Grid2X2 size={18} aria-hidden="true" />
          <span>{copy.install.cta}</span>
        </button>
        {hint}
      </>
    )
  }

  return (
    <>
      <button
        type="button"
        className={variant === 'secondary' ? 'button' : 'button secondary'}
        aria-label={copy.install.aria}
        onClick={() => void activate()}
      >
        {copy.install.cta}
      </button>
      {hint}
    </>
  )
}
