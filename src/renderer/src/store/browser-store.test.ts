import { describe, expect, it } from 'vitest'
import { useBrowserStore } from './browser-store'

describe('browser store', () => {
  it('stores browser state', () => {
    useBrowserStore.setState({
      state: {
        activeTabId: null,
        tabs: [],
        preferences: {
          tabLayout: 'horizontal',
          sidebarVisible: true,
          onboardingCompleted: false,
          welcomeDismissed: false,
          theme: 'dark',
          searchEngine: 'astiango',
          adblockEnabled: true
        }
      }
    })

    const current = useBrowserStore.getState().state
    expect(current?.preferences.tabLayout).toBe('horizontal')
  })
})
