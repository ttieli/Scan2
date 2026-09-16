export type CameraFacing = 'user' | 'environment';

export function cameraConstraintAttempts(facing: CameraFacing): MediaStreamConstraints[] {
  const dimensions = { width: { ideal: 1280 }, height: { ideal: 1280 } };
  return [
    { video: { ...dimensions, facingMode: { exact: facing } }, audio: false },
    { video: { ...dimensions, facingMode: { ideal: facing } }, audio: false },
  ];
}

export async function openPreferredCamera(
  mediaDevices: Pick<MediaDevices, 'getUserMedia'>,
  facing: CameraFacing,
  previousStream: MediaStream | null = null,
): Promise<MediaStream> {
  previousStream?.getTracks().forEach((track) => track.stop());
  const attempts = cameraConstraintAttempts(facing);
  try {
    return await mediaDevices.getUserMedia(attempts[0]!);
  } catch (error) {
    const name = error && typeof error === 'object' && 'name' in error ? String(error.name) : '';
    if (name !== 'OverconstrainedError' && name !== 'NotFoundError') throw error;
    return mediaDevices.getUserMedia(attempts[1]!);
  }
}
