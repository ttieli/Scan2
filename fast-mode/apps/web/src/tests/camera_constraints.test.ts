import { describe, expect, it, vi } from 'vitest';
import {
  cameraConstraintAttempts,
  openPreferredCamera,
} from '@/lib/camera_constraints';

describe('iOS Safari camera selection', () => {
  it('requests exact then ideal front or rear facing modes', () => {
    expect(cameraConstraintAttempts('user')[0]!.video).toMatchObject({ facingMode: { exact: 'user' } });
    expect(cameraConstraintAttempts('user')[1]!.video).toMatchObject({ facingMode: { ideal: 'user' } });
    expect(cameraConstraintAttempts('environment')[0]!.video).toMatchObject({ facingMode: { exact: 'environment' } });
  });

  it('stops the previous mobile camera before exact-to-ideal fallback', async () => {
    const stop = vi.fn();
    const previous = { getTracks: () => [{ stop }] } as unknown as MediaStream;
    const expected = { getTracks: () => [], getVideoTracks: () => [] } as unknown as MediaStream;
    const exactError = Object.assign(new Error('no exact camera'), { name: 'OverconstrainedError' });
    const getUserMedia = vi.fn()
      .mockRejectedValueOnce(exactError)
      .mockResolvedValueOnce(expected);
    const devices = { getUserMedia } as unknown as MediaDevices;
    await expect(openPreferredCamera(devices, 'user', previous)).resolves.toBe(expected);
    expect(stop).toHaveBeenCalledOnce();
    expect(getUserMedia).toHaveBeenCalledTimes(2);
    expect(getUserMedia.mock.calls[0]![0].video).toMatchObject({ facingMode: { exact: 'user' } });
    expect(getUserMedia.mock.calls[1]![0].video).toMatchObject({ facingMode: { ideal: 'user' } });
  });

  it('does not retry permission denial', async () => {
    const denied = Object.assign(new Error('denied'), { name: 'NotAllowedError' });
    const getUserMedia = vi.fn().mockRejectedValue(denied);
    await expect(openPreferredCamera({ getUserMedia } as unknown as MediaDevices, 'environment')).rejects.toBe(denied);
    expect(getUserMedia).toHaveBeenCalledOnce();
  });
});
