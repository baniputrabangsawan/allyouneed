import { Link, type LinkComponentProps } from '@tanstack/react-router'
import { localizeTo, type EnglishTo, useLocale } from './index'

type LocaleLinkProps = Omit<LinkComponentProps, 'to'> & { to: EnglishTo }

export function LocaleLink(props: LocaleLinkProps) {
  const locale = useLocale()
  const { to, ...rest } = props
  return <Link {...rest} to={localizeTo(locale, to) as never} />
}
