export interface SourcePolicyInputs {
  /** The user's "include Markdown source in shared notes" setting. */
  defaultInclude: boolean
  /** The active note's frontmatter, if any. */
  frontmatter: Record<string, unknown> | undefined
  /** The frontmatter property name for the per-note override. */
  sourceKey: string
}

/**
 * Resolve whether a note's Markdown source should be embedded in the shared
 * page. The plugin setting supplies the default; an explicit boolean in the
 * note's frontmatter (`<prefix>_source: true|false`) overrides it either way.
 * Any other frontmatter value is ignored.
 */
export function resolveIncludeSource (input: SourcePolicyInputs): boolean {
  const override = input.frontmatter?.[input.sourceKey]
  return typeof override === 'boolean' ? override : input.defaultInclude
}
