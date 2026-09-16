import { describe, expect, it } from 'vitest';
import { DEFAULT_FRAME_RATE_FPS } from '@/lib/playback_settings';

describe('enhanced sender playback defaults', () => {
  it('defaults live QR playback to 10 frames per second', () => {
    expect(DEFAULT_FRAME_RATE_FPS).toBe(10);
  });
});
