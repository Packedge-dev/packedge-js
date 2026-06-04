import { createEvents, type EventsConfig } from './events';

export type {
  EventsConfig,
  Events,
} from './events';

const API_BASE = 'https://api.packedge.dev/public/v1';

export interface PackEdgeOptions {
  slug?: string;
  site?: string;
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

export class PackEdge {
  protected publicKey: string;
  protected slug: string | null;
  protected site: string | null;

  constructor(publicKey: string, options?: PackEdgeOptions) {
    this.publicKey = publicKey;
    this.slug = options?.slug ?? null;
    this.site = options?.site ?? null;
  }

  useAnalytics(config?: Omit<EventsConfig, 'publicKey' | 'slug' | 'site'>): this {
    createEvents({
      publicKey: this.publicKey,
      slug: this.slug ?? undefined,
      site: this.site ?? undefined,
      ...config,
    });
    return this;
  }

  async validateLicense(
    licenseKey: string,
    options?: { site?: string }
  ): Promise<ValidateLicenseResponse> {
    return this.request<ValidateLicenseResponse>('/licenses/validate', {
      license_key: licenseKey,
      site: options?.site ?? this.getSite(),
    });
  }

  async activateLicense(
    licenseKey: string,
    options?: { site?: string }
  ): Promise<ActivateResponse> {
    return this.request<ActivateResponse>('/licenses/activate', {
      license_key: licenseKey,
      site: options?.site ?? this.getSite(),
    });
  }

  async deactivateLicense(
    licenseKey: string,
    options?: { site?: string }
  ): Promise<DeactivateResponse> {
    return this.request<DeactivateResponse>('/licenses/deactivate', {
      license_key: licenseKey,
      site: options?.site ?? this.getSite(),
    });
  }

  async getReleases(productSlug: string): Promise<Release[]> {
    const res = await fetch(`${API_BASE}/products/${productSlug}/releases`);
    const data = await res.json();
    return data.data ?? data;
  }

  async submitFeedback(data: {
    sentiment?: 'happy' | 'neutral' | 'unhappy';
    rating?: 1 | 2;
    message?: string;
    email?: string;
    context?: { type?: string; value?: string };
    metadata?: Record<string, unknown>;
  }): Promise<FeedbackResponse> {
    return this.request<FeedbackResponse>('/feedback', {
      slug: this.slug,
      site: this.getSite(),
      ...data,
    });
  }

  track(event: string, properties?: Record<string, unknown>): void {
    this.request<TrackResponse>('/event', {
      event,
      slug: this.slug,
      site: this.getSite(),
      properties,
    }).catch(() => {});
  }

  protected getSite(): string {
    if (this.site) return this.site;
    if (typeof window !== 'undefined') {
      return window.location.origin;
    }
    return '';
  }

  private async request<T = unknown>(endpoint: string, body: Record<string, unknown>): Promise<T> {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ public_key: this.publicKey, ...body }),
    });

    return res.json();
  }
}
