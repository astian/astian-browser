import { describe, expect, it } from 'vitest'
import { useBrowserStore } from './browser-store'

describe('browser store', () => {
  it('stores browser state', () => {
    useBrowserStore.setState({
      state: {
        activeTabId: null,
        tabs: [],
        profiles: [{ id: 'default', name: 'Default', createdAt: Date.now() }],
        spaces: [
          { id: 'default-space', profileId: 'default', name: 'General', createdAt: Date.now() }
        ],
        activeProfileId: 'default',
        activeSpaceId: 'default-space',
        history: [],
        bookmarks: [],
        extensions: [],
        preferences: {
          tabLayout: 'horizontal',
          sidebarVisible: true,
          onboardingCompleted: false,
          welcomeDismissed: false,
          theme: 'dark',
          searchEngine: 'astiango',
          adblockEnabled: true,
          sleepTabsEnabled: true,
          appIconGlyph: 'A'
        }
      }
    })

    const current = useBrowserStore.getState().state
    expect(current?.preferences.tabLayout).toBe('horizontal')
  })
})
