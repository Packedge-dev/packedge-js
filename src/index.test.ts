import { describe, it, expect, vi, beforeEach } from 'vitest';
import packedge, { PackEdge } from './index';

const mockFetch = vi.fn();
global.fetch = mockFetch;

beforeEach(() => {
  vi.clearAllMocks();
  mockFetch.mockResolvedValue({ json: () => Promise.resolve({ success: true }) });
});

describe('packedge factory', () => {
  it('returns a PackEdge instance', () => {
    const pe = packedge('pk_test');
    expect(pe).toBeInstanceOf(PackEdge);
  });

  it('returns a new instance each call', () => {
    const a = packedge('pk_test');
    const b = packedge('pk_test');
    expect(a).not.toBe(b);
  });
});

describe('useAnalytics', () => {
  it('returns this for chaining', () => {
    const pe = packedge('pk_test', { slug: 'my-plugin' });
    const result = pe.useAnalytics();
    expect(result).toBe(pe);
  });
});

describe('validateLicense', () => {
  it('calls correct endpoint', async () => {
    const pe = packedge('pk_test');
    mockFetch.mockResolvedValueOnce({ json: () => Promise.resolve({ valid: true }) });

    await pe.validateLicense('LICENSE-123');

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
    const pe = packedge('pk_test');
    await pe.validateLicense('LICENSE-123', { site: 'https://example.com' });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.site).toBe('https://example.com');
  });
});

describe('activateLicense', () => {
  it('calls activate endpoint', async () => {
    const pe = packedge('pk_test');
    await pe.activateLicense('LICENSE-123');

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.packedge.dev/public/v1/licenses/activate',
      expect.any(Object)
    );
  });
});

describe('deactivateLicense', () => {
  it('calls deactivate endpoint', async () => {
    const pe = packedge('pk_test');
    await pe.deactivateLicense('LICENSE-123');

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.packedge.dev/public/v1/licenses/deactivate',
      expect.any(Object)
    );
  });
});

describe('getReleases', () => {
  it('calls releases endpoint with GET', async () => {
    mockFetch.mockResolvedValueOnce({ json: () => Promise.resolve({ data: [] }) });

    const pe = packedge('pk_test');
    await pe.getReleases('my-plugin');

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.packedge.dev/public/v1/products/my-plugin/releases'
    );
  });
});

describe('submitFeedback', () => {
  it('sends feedback data', async () => {
    const pe = packedge('pk_test', { slug: 'my-plugin' });
    await pe.submitFeedback({ sentiment: 'happy', message: 'Great plugin!' });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.sentiment).toBe('happy');
    expect(body.message).toBe('Great plugin!');
  });

  it('sends rating feedback', async () => {
    const pe = packedge('pk_test', { slug: 'my-plugin' });
    await pe.submitFeedback({ rating: 2, context: { type: 'feature', value: 'export' } });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.rating).toBe(2);
    expect(body.context.type).toBe('feature');
  });
});

describe('track', () => {
  it('sends track event (fire and forget)', () => {
    const pe = packedge('pk_test', { slug: 'my-plugin' });
    pe.track('feature_used', { feature: 'export' });

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.packedge.dev/public/v1/event',
      expect.any(Object)
    );
  });
});
