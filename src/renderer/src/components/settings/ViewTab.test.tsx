// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { AppSettings } from '../../../../shared/types'
import { ViewTab } from './ViewTab'

vi.mock('./ThemeSettings', () => ({
  ThemeSettings: () => <div />,
}))

const settings: AppSettings = {
  hotkey: 'CommandOrControl+Shift+D',
  priceCheckHotkey: 'CommandOrControl+Shift+A',
  overlayOpacity: 0.95,
  overlayScale: 1,
  mainPanelMode: 'overlay',
  openSide: 'both',
  closeOnClickOutside: false,
  useCurrentZoneAreaLevel: false,
  reloadOnSave: true,
  updateChannel: 'stable',
  tradeStatus: 'available',
  tradeCollapseListings: true,
  previewVolume: 0.25,
  priceCheckDefaultPercent: 90,
  adaptiveDefaultsMode: 'eager',
  tradeDefaultToBase: false,
  chatCommands: [],
  appMacros: [],
  stashScrollEnabled: false,
  poeVersion: 1,
  regexPresetsPoe1: [],
  regexPresetsPoe2: [],
  leaguesPoe1: [],
  leaguesPoe2: [],
  developerMode: false,
  themeId: 'default',
  customThemePalette: null,
  activeProfileId: '',
  lastProfileIdPoe1: '',
  lastProfileIdPoe2: '',
  startInTray: true,
  onboardingCompleted: false,
}

describe('ViewTab', () => {
  it('renders the main panel mode setting', () => {
    render(<ViewTab settings={settings} update={vi.fn()} updateMany={vi.fn()} />)

    expect(screen.getByText('Main panel mode')).toBeInTheDocument()
  })

  it('writes mainPanelMode when toggled', () => {
    const update = vi.fn()
    render(<ViewTab settings={settings} update={update} updateMany={vi.fn()} />)

    fireEvent.click(screen.getByText('Standalone window'))

    expect(update).toHaveBeenCalledWith('mainPanelMode', 'standalone')
  })
})
