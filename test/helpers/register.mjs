// Permite `import './paths'` (sin extensión) en los tests, como hace el bundler.
// Sin dependencias: usa los hooks nativos de Node.
import { registerHooks } from 'node:module'

const HAS_EXTENSION = /\.[cm]?[jt]sx?$|\.json$/i

registerHooks({
  resolve(specifier, context, nextResolve) {
    const isRelative = specifier.startsWith('./') || specifier.startsWith('../')
    if (isRelative && !HAS_EXTENSION.test(specifier)) {
      try {
        return nextResolve(`${specifier}.ts`, context)
      } catch {
        // no existe como .ts: seguimos con la resolución normal
      }
    }
    return nextResolve(specifier, context)
  }
})
