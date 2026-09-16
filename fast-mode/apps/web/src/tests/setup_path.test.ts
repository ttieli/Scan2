import { describe, expect, it } from 'vitest';
import { viteFsPath } from './setup';

describe('Vitest WASM path resolution', () => {
  it('preserves the leading slash of macOS Vite /@fs/ URLs', () => {
    expect(viteFsPath('http://localhost:3000/@fs/Users/example/codec.wasm'))
      .toBe('/Users/example/codec.wasm');
  });
});
