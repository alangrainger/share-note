import { describe, it, expect } from 'vitest'
import { buildFieldKey, buildFieldKeys, YamlField } from './field-keys'

describe('buildFieldKey', () => {
  it('formats as <prefix>_<fieldName>', () => {
    expect(buildFieldKey('share', YamlField.link)).toBe('share_link')
    expect(buildFieldKey('share', YamlField.updated)).toBe('share_updated')
    expect(buildFieldKey('share', YamlField.encrypted)).toBe('share_encrypted')
    expect(buildFieldKey('share', YamlField.unencrypted)).toBe('share_unencrypted')
    expect(buildFieldKey('share', YamlField.title)).toBe('share_title')
    expect(buildFieldKey('share', YamlField.expires)).toBe('share_expires')
  })

  it('respects a custom prefix', () => {
    expect(buildFieldKey('custom', YamlField.link)).toBe('custom_link')
  })
})

describe('buildFieldKeys', () => {
  it('returns the full set of frontmatter keys for a given prefix', () => {
    expect(buildFieldKeys('share')).toEqual({
      link: 'share_link',
      updated: 'share_updated',
      encrypted: 'share_encrypted',
      unencrypted: 'share_unencrypted',
      title: 'share_title',
      expires: 'share_expires'
    })
  })
})
