export function isRestoringNavigation() {
  return typeof document !== 'undefined' && document.documentElement.hasAttribute('data-kits-restore')
}
