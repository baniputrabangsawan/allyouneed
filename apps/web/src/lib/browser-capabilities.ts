const hasFunction = (scope: object, name: PropertyKey) => typeof Reflect.get(scope, name) === 'function'

export const supportsOffscreenCanvas = (scope: object = globalThis) => hasFunction(scope, 'OffscreenCanvas')
export const supportsWebWorkers = (scope: object = globalThis) => hasFunction(scope, 'Worker')
export const supportsWebSpeech = (scope: object = globalThis) =>
  hasFunction(scope, 'SpeechRecognition') || hasFunction(scope, 'webkitSpeechRecognition')
export const supportsMediaRecorder = (scope: object = globalThis) => hasFunction(scope, 'MediaRecorder')
export const supportsClipboard = (scope: object = globalThis) => {
  const navigatorValue: unknown = Reflect.get(scope, 'navigator')
  if (typeof navigatorValue !== 'object' || navigatorValue === null) return false
  const clipboard: unknown = Reflect.get(navigatorValue, 'clipboard')
  return typeof clipboard === 'object' && clipboard !== null && hasFunction(clipboard, 'writeText')
}

export const getBrowserCapabilities = (scope: object = globalThis) => ({
  offscreenCanvas: supportsOffscreenCanvas(scope),
  webWorkers: supportsWebWorkers(scope),
  webSpeech: supportsWebSpeech(scope),
  mediaRecorder: supportsMediaRecorder(scope),
  clipboard: supportsClipboard(scope),
})
