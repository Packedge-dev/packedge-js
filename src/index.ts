const API_BASE = 'https://api.packedge.dev/public/v1';

let publicKey: string | null = null;

function getSite(): string {
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return '';
}

async function request<T = unknown>(endpoint: string, body: Record<string, unknown>): Promise<T> {
  if (!publicKey) {
    throw new Error('PackEdge SDK not initialized. Call packedge.init(publicKey) first.');
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ public_key: publicKey, ...body }),
  });

  return res.json();
}

export interface License {
  key: string;
  status: 'active' | 'expired' | 'suspended' | 'revoked';
  expiresAt: string | null;
  customerId: string;
}

export interface ValidateLicenseResponse {
  valid: boolean;
  license?: License;
  activations?: { used: number; limit: number };
  error?: string;
}

export interface ActivateResponse {
  success: boolean;
  activationId?: string;
  error?: string;
}

export interface DeactivateResponse {
  success: boolean;
  error?: string;
}

export interface Release {
  version: string;
  changelog: string;
  releasedAt: string;
  downloadUrl?: string;
}

export interface FeedbackResponse {
  success: boolean;
  id?: string;
  error?: string;
}

export interface TrackResponse {
  success: boolean;
}

export function init(key: string): void {
  publicKey = key;
}

export async function validateLicense(
  licenseKey: string,
  options?: { site?: string }
): Promise<ValidateLicenseResponse> {
  return request<ValidateLicenseResponse>('/licenses/validate', {
    license_key: licenseKey,
    site: options?.site ?? getSite(),
  });
}

export async function activateLicense(
  licenseKey: string,
  options?: { site?: string }
): Promise<ActivateResponse> {
  return request<ActivateResponse>('/licenses/activate', {
    license_key: licenseKey,
    site: options?.site ?? getSite(),
  });
}

export async function deactivateLicense(
  licenseKey: string,
  options?: { site?: string }
): Promise<DeactivateResponse> {
  return request<DeactivateResponse>('/licenses/deactivate', {
    license_key: licenseKey,
    site: options?.site ?? getSite(),
  });
}

export async function getReleases(productSlug: string): Promise<Release[]> {
  const res = await fetch(`${API_BASE}/products/${productSlug}/releases`);
  const data = await res.json();
  return data.data ?? data;
}

export async function submitFeedback(data: {
  type: 'bug' | 'feature' | 'general';
  message: string;
  email?: string;
  metadata?: Record<string, unknown>;
}): Promise<FeedbackResponse> {
  return request<FeedbackResponse>('/feedback', data);
}

export function track(event: string, properties?: Record<string, unknown>): void {
  request<TrackResponse>('/analytics/track', { event, properties }).catch(() => {
    // Fire and forget - don't block on analytics
  });
}

const packedge = {
  init,
  validateLicense,
  activateLicense,
  deactivateLicense,
  getReleases,
  submitFeedback,
  track,
};

export default packedge;
