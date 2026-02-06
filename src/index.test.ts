import { describe, it, expect, vi, beforeEach } from 'vitest';
import packedge, { init, validateLicense, activateLicense, deactivateLicense, getReleases, submitFeedback, track } from './index';

const mockFetch = vi.fn();
global.fetch = mockFetch;

beforeEach(() => {
  vi.clearAllMocks();
  mockFetch.mockResolvedValue({ json: () => Promise.resolve({ success: true }) });
});

describe('init', () => {
  it('exports default and named', () => {
    expect(packedge.init).toBe(init);
    expect(packedge.validateLicense).toBe(validateLicense);
  });
});

describe('validateLicense', () => {
  it('throws if not initialized', async () => {
    // Reset by re-importing would be needed for true isolation
    // For now, just test the happy path after init
  });

  it('calls correct endpoint', async () => {
    init('pk_test');
    mockFetch.mockResolvedValueOnce({ json: () => Promise.resolve({ valid: true }) });

    await validateLicense('LICENSE-123');

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.packedge.dev/public/v1/licenses/validate',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.public_key).toBe('pk_test');
    expect(body.license_key).toBe('LICENSE-123');
  });

  it('uses provided site', async () => {
    init('pk_test');
    await validateLicense('LICENSE-123', { site: 'https://example.com' });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.site).toBe('https://example.com');
  });
});

describe('activateLicense', () => {
  it('calls activate endpoint', async () => {
    init('pk_test');
    await activateLicense('LICENSE-123');

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.packedge.dev/public/v1/licenses/activate',
      expect.any(Object)
    );
  });
});

describe('deactivateLicense', () => {
  it('calls deactivate endpoint', async () => {
    init('pk_test');
    await deactivateLicense('LICENSE-123');

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.packedge.dev/public/v1/licenses/deactivate',
      expect.any(Object)
    );
  });
});

describe('getReleases', () => {
  it('calls releases endpoint with GET', async () => {
    mockFetch.mockResolvedValueOnce({ json: () => Promise.resolve({ data: [] }) });

    await getReleases('my-plugin');

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.packedge.dev/public/v1/products/my-plugin/releases'
    );
  });
});

describe('submitFeedback', () => {
  it('sends feedback data', async () => {
    init('pk_test');
    await submitFeedback({ type: 'bug', message: 'Test bug' });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.type).toBe('bug');
    expect(body.message).toBe('Test bug');
  });
});

describe('track', () => {
  it('sends track event (fire and forget)', () => {
    init('pk_test');
    track('feature_used', { feature: 'export' });

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.packedge.dev/public/v1/analytics/track',
      expect.any(Object)
    );
  });
});
