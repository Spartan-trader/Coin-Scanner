import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, buildAdvanced, closeFocusSupported, type CameraCaps } from '../src/lib/camera';

const full: CameraCaps = {
  zoom: { min: 1, max: 8, step: 0.1 },
  focusDistance: { min: 0.05, max: 10, step: 0.01 },
  focusModes: ['manual', 'continuous', 'single-shot'],
  torch: true,
};
const bare: CameraCaps = { zoom: null, focusDistance: null, focusModes: [], torch: false };

describe('close-up camera settings', () => {
  it('close focus sets manual focus at the nearest distance', () => {
    const adv = buildAdvanced(full, { ...DEFAULT_SETTINGS, closeFocus: true });
    expect(adv).toMatchObject({ focusMode: 'manual', focusDistance: 0.05, torch: false });
  });
  it('uses the chosen focus distance and zoom, clamped to what the lens allows', () => {
    const adv = buildAdvanced(full, { ...DEFAULT_SETTINGS, closeFocus: true, focusDistance: 99, zoom: 20 });
    expect(adv).toMatchObject({ focusDistance: 10, zoom: 8 });
  });
  it('falls back to continuous autofocus when close focus is off', () => {
    expect(buildAdvanced(full, DEFAULT_SETTINGS)).toMatchObject({ focusMode: 'continuous' });
  });
  it('sends nothing to a camera with no controls', () => {
    expect(buildAdvanced(bare, { ...DEFAULT_SETTINGS, closeFocus: true, zoom: 3, torch: true })).toEqual({});
    expect(closeFocusSupported(bare)).toBe(false);
  });
  it('needs both a focus range and manual mode for close focus', () => {
    expect(closeFocusSupported({ ...full, focusModes: ['continuous'] })).toBe(false);
    expect(closeFocusSupported(full)).toBe(true);
  });
});
