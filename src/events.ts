const API_BASE = 'https://api.packedge.dev/public/v1';

export interface EventsConfig {
  publicKey?: string;
  slug?: string;
  site?: string;
  consent?: boolean;
  autoTrack?: boolean;
  trackClicks?: boolean;
  trackForms?: boolean;
  trackScroll?: boolean;
}

export class Events {
  private publicKey: string;
  private slug: string;
  private site: string;
  private consent: boolean;
  private config: Required<Omit<EventsConfig, 'publicKey' | 'slug' | 'site' | 'consent'>>;
  private initialized = false;
  private scrollTracked = new Set<number>();

  constructor(config: EventsConfig = {}) {
    this.publicKey = config.publicKey ?? '';
    this.slug = config.slug ?? '';
    this.site = config.site ?? (typeof window !== 'undefined' ? window.location.origin : '');
    this.consent = config.consent ?? true;

    this.config = {
      autoTrack: config.autoTrack ?? true,
      trackClicks: config.trackClicks ?? true,
      trackForms: config.trackForms ?? true,
      trackScroll: config.trackScroll ?? true,
    };

    if (this.consent && this.config.autoTrack) {
      this.initAutoTracking();
    }
  }

  track(event: string, properties?: Record<string, unknown>): void {
    if (!this.consent || !this.publicKey) return;

    const payload = JSON.stringify({
      public_key: this.publicKey,
      event,
      slug: this.slug,
      site: this.site,
      properties,
    });

    fetch(`${API_BASE}/event`, {
      method: 'POST',
      body: payload,
      keepalive: true,
    }).catch(() => {});
  }

  setConsent(consent: boolean): void {
    this.consent = consent;
    if (consent && this.config.autoTrack && !this.initialized) {
      this.initAutoTracking();
    }
  }

  getConsent(): boolean {
    return this.consent;
  }

  private initAutoTracking(): void {
    if (this.initialized || typeof window === 'undefined') return;
    this.initialized = true;

    if (this.config.trackClicks) this.setupClickTracking();
    if (this.config.trackForms) this.setupFormTracking();
    if (this.config.trackScroll) this.setupScrollTracking();
  }

  private setupClickTracking(): void {
    document.addEventListener('click', (e) => {
      const el = (e.target as HTMLElement).closest('[data-track]');
      if (el) {
        const trackName = el.getAttribute('data-track');
        const trackData = el.getAttribute('data-track-props');
        let props: Record<string, unknown> = {
          element: trackName,
          text: el.textContent?.trim().slice(0, 50),
        };

        if (trackData) {
          try {
            props = { ...props, ...JSON.parse(trackData) };
          } catch {
            // Invalid JSON, ignore
          }
        }

        this.track('click', props);
      }
    });
  }

  private setupFormTracking(): void {
    document.addEventListener('submit', (e) => {
      const form = e.target as HTMLFormElement;
      if (form.getAttribute('data-track-ignore')) return;

      this.track('form_submit', {
        id: form.id || null,
        name: form.name || null,
        action: form.action || null,
      });
    });
  }

  private setupScrollTracking(): void {
    let maxScroll = 0;
    const thresholds = [25, 50, 75, 100];

    const handleScroll = () => {
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (docHeight <= 0) return;

      const scrollPercent = Math.round((window.scrollY / docHeight) * 100);
      if (scrollPercent > maxScroll) {
        maxScroll = scrollPercent;
        for (const t of thresholds) {
          if (scrollPercent >= t && !this.scrollTracked.has(t)) {
            this.scrollTracked.add(t);
            this.track('scroll_depth', { depth: t });
          }
        }
      }
    };

    let ticking = false;
    window.addEventListener('scroll', () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          handleScroll();
          ticking = false;
        });
        ticking = true;
      }
    });
  }
}

let eventsInstance: Events | null = null;

export function createEvents(config?: EventsConfig): Events {
  if (!eventsInstance) {
    eventsInstance = new Events(config);
  }
  return eventsInstance;
}

export function getEvents(): Events | null {
  return eventsInstance;
}
