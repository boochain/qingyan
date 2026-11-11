export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith(".") && !/\.(?:ts|js|mjs|cjs|json|css)$/.test(specifier)) {
    try {
      return await nextResolve(`${specifier}.ts`, context);
    } catch {
      /* fall through */
    }
  }
  return nextResolve(specifier, context);
}
