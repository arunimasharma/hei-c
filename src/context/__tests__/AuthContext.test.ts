import { describe, it, expect } from 'vitest';

describe('AuthContext interface', () => {
  it('should export AuthProvider and useAuth', async () => {
    const mod = await import('../AuthContext');
    expect(mod.AuthProvider).toBeDefined();
    expect(mod.useAuth).toBeDefined();
  });
});
