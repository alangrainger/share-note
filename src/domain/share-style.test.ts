import { describe, it, expect } from 'vitest'
import { shouldPromptShareStyle, toShareUnencrypted } from './share-style'

const FRESH = { shareStyleChosen: false, shareUnencrypted: false }

describe('shouldPromptShareStyle', () => {
  it('prompts on a fresh install, and keeps prompting while no choice is recorded', () => {
    // A cancelled share records nothing, so its state is the fresh state.
    expect(shouldPromptShareStyle(FRESH)).toBe(true)
  })

  it('prompts an existing encrypted-by-default user', () => {
    // Settings saved by an older release have no shareStyleChosen; the store
    // fills in the default, and encrypted is not evidence of a choice.
    expect(shouldPromptShareStyle({ ...FRESH, shareUnencrypted: false })).toBe(true)
  })

  it('does not prompt a user who already shares unencrypted', () => {
    // Unencrypted is never the default, so it must have been set deliberately.
    expect(shouldPromptShareStyle({ ...FRESH, shareUnencrypted: true })).toBe(false)
  })

  it('never prompts once a choice has been made', () => {
    expect(shouldPromptShareStyle({ shareStyleChosen: true, shareUnencrypted: false })).toBe(false)
    expect(shouldPromptShareStyle({ shareStyleChosen: true, shareUnencrypted: true })).toBe(false)
  })
})

describe('toShareUnencrypted', () => {
  it('maps a style to the inverted setting', () => {
    expect(toShareUnencrypted('short')).toBe(true)
    expect(toShareUnencrypted('encrypted')).toBe(false)
  })
})
