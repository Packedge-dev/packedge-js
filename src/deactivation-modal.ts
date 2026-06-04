const API_BASE = 'https://api.packedge.dev/public/v1';

/**
 * Diagnostics the PHP SDK localizes onto the page on plugins.php.
 *
 * The shape mirrors the lifecycle snapshot the PHP `register_deactivation_hook`
 * callback sends (`env_snapshot()`), so the backend's environment breakdowns
 * (`payload->'env'->>'php'`, …) and `jsonb_array_elements_text(payload->'plugins')`
 * see modal-fired uninstall events the same way they see hook-fired ones.
 *
 * Any extra top-level keys (admin_email, site_title, server_ip, …) are
 * preserved and stored on the event for raw-payload inspection, even though
 * they don't feed a dashboard chart directly.
 */
export interface Diagnostics {
  env?: {
    php?: string;
    wp?: string;
    os?: string;
    server?: string;
    mysql?: string;
    memory_limit?: string | number;
    locale?: string;
    multisite?: boolean;
    theme?: { name?: string; version?: string };
    [k: string]: unknown;
  };
  plugins?: string[];
  /** Free-form extras kept on the event for forensic value. */
  [k: string]: unknown;
}

export interface DeactivationModalConfig {
  slug: string;
  publicKey: string;
  site?: string;
  diagnostics?: Diagnostics;
}

interface Reason {
  emoji: string;
  label: string;
}

const REASONS: Reason[] = [
  { emoji: '\uD83E\uDD2F', label: 'Too complex' },
  { emoji: '\u26A0\uFE0F', label: 'Not working' },
  { emoji: '\u2728',       label: 'Found better' },
  { emoji: '\uD83D\uDEAB', label: 'Conflicts with' },
  { emoji: '\uD83D\uDD27', label: 'Feature missing' },
  { emoji: '\uD83D\uDCAC', label: 'Others' },
];

const CSS = [
  '.pdm-overlay{position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:100000;opacity:0;transition:opacity .2s}',
  '.pdm-overlay.active{opacity:1}',
  '.pdm-dialog{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%) scale(.96);background:#fff;border-radius:12px;width:520px;max-width:92vw;z-index:100001;box-shadow:0 24px 80px rgba(0,0,0,.18);transition:transform .2s,opacity .2s;opacity:0;overflow:hidden}',
  '.pdm-dialog.active{transform:translate(-50%,-50%) scale(1);opacity:1}',
  '.pdm-header{display:flex;align-items:center;justify-content:space-between;padding:20px 24px 16px}',
  '.pdm-title{margin:0;font-size:15px;font-weight:600;color:#1d2327}',
  '.pdm-close{background:none;border:none;cursor:pointer;padding:4px;color:#999;font-size:20px;line-height:1;border-radius:6px;transition:background .15s,color .15s}',
  '.pdm-close:hover{background:#f0f0f1;color:#1d2327}',
  '.pdm-divider{height:1px;background:linear-gradient(90deg,transparent,#e0e0e0,transparent);margin:0 24px}',
  '.pdm-body{padding:20px 24px}',
  '.pdm-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}',
  '.pdm-card{display:flex;flex-direction:column;align-items:center;gap:6px;padding:20px 12px 16px;border:2px solid #e8e8ec;border-radius:10px;background:#fff;cursor:pointer;transition:border-color .15s,background .15s,box-shadow .15s;-webkit-user-select:none;user-select:none}',
  '.pdm-card:hover{border-color:#c5c5ce;background:#fafafa}',
  '.pdm-card.selected{border-color:#4f46e5;background:#f5f3ff;box-shadow:0 0 0 1px #4f46e5}',
  '.pdm-card-emoji{font-size:28px;line-height:1}',
  '.pdm-card-label{font-size:13px;font-weight:500;color:#374151;text-align:center}',
  '.pdm-details{max-height:0;overflow:hidden;transition:max-height .25s ease,margin .25s ease,opacity .2s ease;opacity:0;margin-top:0}',
  '.pdm-details.open{max-height:120px;opacity:1;margin-top:16px}',
  '.pdm-textarea{width:100%;box-sizing:border-box;resize:none;padding:10px 12px;border:1.5px solid #e0e0e0;border-radius:8px;font-size:13px;font-family:inherit;color:#374151;outline:none;transition:border-color .15s}',
  '.pdm-textarea:focus{border-color:#4f46e5}',
  '.pdm-textarea::placeholder{color:#9ca3af}',
  '.pdm-data-section{padding:0 24px;border-top:1px solid #f3f4f6}',
  '.pdm-data-toggle{display:flex;align-items:center;gap:6px;padding:10px 0;cursor:pointer;font-size:12px;color:#9ca3af;background:none;border:none;width:100%;text-align:left;font-family:inherit;transition:color .15s}',
  '.pdm-data-toggle:hover{color:#6b7280}',
  '.pdm-data-toggle svg{width:12px;height:12px;transition:transform .2s}',
  '.pdm-data-toggle.open svg{transform:rotate(90deg)}',
  '.pdm-data-list{max-height:0;overflow:hidden;transition:max-height .3s ease,opacity .2s ease;opacity:0}',
  '.pdm-data-list.open{max-height:60px;opacity:1;padding-bottom:10px}',
  '.pdm-data-text{font-size:11px;color:#9ca3af;line-height:1.5;margin:0}',
  '.pdm-actions{display:flex;align-items:center;justify-content:flex-end;gap:12px;padding:12px 24px 20px}',
  '.pdm-btn-skip{background:none;border:none;cursor:pointer;font-size:13px;font-weight:500;color:#6b7280;padding:8px 16px;border-radius:8px;transition:background .15s,color .15s}',
  '.pdm-btn-skip:hover{background:#f3f4f6;color:#374151}',
  '.pdm-btn-submit{background:#4f46e5;color:#fff;border:none;cursor:pointer;font-size:13px;font-weight:500;padding:8px 20px;border-radius:8px;opacity:0;pointer-events:none;transform:scale(.95);transition:opacity .2s,transform .2s,background .15s}',
  '.pdm-btn-submit.visible{opacity:1;pointer-events:auto;transform:scale(1)}',
  '.pdm-btn-submit:hover{background:#4338ca}',
  '.pdm-btn-submit:disabled{opacity:.6;cursor:default}',
].join('');

const PLACEHOLDERS: Record<string, string> = {
  'Conflicts with': 'Which plugin or theme conflicts?',
  'Feature missing': 'What feature were you looking for?',
  'Others': 'Please share your reason...',
};

const DATA_DISCLOSURE = 'Site info, server info, email, active plugins, and theme will be shared.';

export class DeactivationModal {
  private slug: string;
  private publicKey: string;
  private site: string;
  private diagnostics: Diagnostics;
  private modalEl: HTMLElement | null = null;
  private deactivateUrl = '';
  private selectedReason: string | null = null;

  constructor(config: DeactivationModalConfig) {
    this.slug = config.slug;
    this.publicKey = config.publicKey;
    this.site = config.site ?? window.location.origin;
    this.diagnostics = config.diagnostics ?? {};

    // Idempotent per slug: if another init path already mounted a modal for this
    // plugin (e.g. useAnalytics() and the WP drop-in both run, or two plugins
    // each load the SDK), bail so the user never sees duplicate modals.
    const w = window as unknown as Record<string, unknown>;
    const mounted = (w.__pdmSlugs as Set<string>) || (w.__pdmSlugs = new Set<string>());
    if (mounted.has(this.slug)) return;

    const pluginLink = document.querySelector(
      `tr[data-slug="${this.slug}"] .deactivate a`
    );
    if (!pluginLink) return;

    mounted.add(this.slug);
    this.buildModal();
    this.interceptDeactivateLink();
  }

  private sendBeacon(event: string, properties: Record<string, unknown>): void {
    fetch(`${API_BASE}/event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        public_key: this.publicKey,
        event,
        site: this.site,
        properties,
      }),
      keepalive: true,
    }).catch(() => {});
  }

  private buildDataSection(): HTMLElement {
    const section = document.createElement('div');
    section.className = 'pdm-data-section';

    const toggle = document.createElement('button');
    toggle.className = 'pdm-data-toggle';
    toggle.setAttribute('type', 'button');
    toggle.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 5l7 7-7 7"/></svg> Data shared with this submission';
    section.appendChild(toggle);

    const listWrap = document.createElement('div');
    listWrap.className = 'pdm-data-list';

    const p = document.createElement('p');
    p.className = 'pdm-data-text';
    p.textContent = DATA_DISCLOSURE;
    listWrap.appendChild(p);
    section.appendChild(listWrap);

    toggle.addEventListener('click', () => {
      toggle.classList.toggle('open');
      listWrap.classList.toggle('open');
    });

    return section;
  }

  private buildModal(): void {
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    const wrapper = document.createElement('div');
    wrapper.id = 'packedge-dm';
    wrapper.style.display = 'none';

    const overlay = document.createElement('div');
    overlay.className = 'pdm-overlay';
    wrapper.appendChild(overlay);

    const dialog = document.createElement('div');
    dialog.className = 'pdm-dialog';

    // Header
    const header = document.createElement('div');
    header.className = 'pdm-header';
    const title = document.createElement('h3');
    title.className = 'pdm-title';
    title.textContent = "Could you please share why you're deactivating?";
    const closeBtn = document.createElement('button');
    closeBtn.className = 'pdm-close';
    closeBtn.innerHTML = '&#x2715;';
    closeBtn.setAttribute('type', 'button');
    header.appendChild(title);
    header.appendChild(closeBtn);
    dialog.appendChild(header);

    // Divider
    const divider = document.createElement('div');
    divider.className = 'pdm-divider';
    dialog.appendChild(divider);

    // Body
    const body = document.createElement('div');
    body.className = 'pdm-body';

    const grid = document.createElement('div');
    grid.className = 'pdm-grid';
    for (let i = 0; i < REASONS.length; i++) {
      const card = document.createElement('div');
      card.className = 'pdm-card';
      card.setAttribute('data-index', String(i));
      const emoji = document.createElement('span');
      emoji.className = 'pdm-card-emoji';
      emoji.textContent = REASONS[i].emoji;
      const label = document.createElement('span');
      label.className = 'pdm-card-label';
      label.textContent = REASONS[i].label;
      card.appendChild(emoji);
      card.appendChild(label);
      grid.appendChild(card);
    }
    body.appendChild(grid);

    const details = document.createElement('div');
    details.className = 'pdm-details';
    const textarea = document.createElement('textarea');
    textarea.className = 'pdm-textarea';
    textarea.rows = 3;
    textarea.placeholder = 'Any additional details (optional)...';
    details.appendChild(textarea);
    body.appendChild(details);

    dialog.appendChild(body);

    // Data shared section
    if (Object.keys(this.diagnostics).length > 0) {
      dialog.appendChild(this.buildDataSection());
    }

    // Actions
    const actions = document.createElement('div');
    actions.className = 'pdm-actions';
    const skipBtn = document.createElement('button');
    skipBtn.className = 'pdm-btn-skip';
    skipBtn.setAttribute('type', 'button');
    skipBtn.textContent = 'Skip & Deactivate';
    const submitBtn = document.createElement('button');
    submitBtn.className = 'pdm-btn-submit';
    submitBtn.setAttribute('type', 'button');
    submitBtn.textContent = 'Submit & Deactivate';
    actions.appendChild(skipBtn);
    actions.appendChild(submitBtn);
    dialog.appendChild(actions);

    wrapper.appendChild(dialog);
    document.body.appendChild(wrapper);
    this.modalEl = wrapper;

    // Card selection
    grid.addEventListener('click', (e) => {
      const c = (e.target as HTMLElement).closest('.pdm-card');
      if (!c) return;
      const prev = grid.querySelector('.pdm-card.selected');
      if (prev) prev.classList.remove('selected');
      c.classList.add('selected');
      this.selectedReason = REASONS[parseInt(c.getAttribute('data-index')!, 10)].label;

      details.classList.add('open');
      submitBtn.classList.add('visible');

      textarea.placeholder = PLACEHOLDERS[this.selectedReason] ?? 'Any additional details (optional)...';
      textarea.focus();
    });

    submitBtn.addEventListener('click', () => {
      if (!this.selectedReason) return;
      submitBtn.disabled = true;
      submitBtn.textContent = 'Submitting\u2026';
      this.sendAndDeactivate(this.selectedReason, textarea.value.trim() || null);
    });

    skipBtn.addEventListener('click', () => {
      skipBtn.disabled = true;
      this.sendAndDeactivate('skipped', null);
    });

    closeBtn.addEventListener('click', () => this.hideModal());
    overlay.addEventListener('click', () => this.hideModal());
  }

  private showModal(): void {
    if (!this.modalEl) return;
    this.modalEl.style.display = '';
    this.modalEl.offsetHeight; // reflow
    this.modalEl.querySelector('.pdm-overlay')!.classList.add('active');
    this.modalEl.querySelector('.pdm-dialog')!.classList.add('active');
  }

  private hideModal(): void {
    if (!this.modalEl) return;
    this.modalEl.querySelector('.pdm-overlay')!.classList.remove('active');
    this.modalEl.querySelector('.pdm-dialog')!.classList.remove('active');
    setTimeout(() => {
      if (!this.modalEl) return;
      this.modalEl.style.display = 'none';
      this.selectedReason = null;
      const prev = this.modalEl.querySelector('.pdm-card.selected');
      if (prev) prev.classList.remove('selected');
      this.modalEl.querySelector('.pdm-details')!.classList.remove('open');
      const submitBtn = this.modalEl.querySelector('.pdm-btn-submit') as HTMLButtonElement;
      submitBtn.classList.remove('visible');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Submit & Deactivate';
      (this.modalEl.querySelector('.pdm-btn-skip') as HTMLButtonElement).disabled = false;
      (this.modalEl.querySelector('.pdm-textarea') as HTMLTextAreaElement).value = '';
    }, 200);
  }

  private sendAndDeactivate(reason: string, feedback: string | null): void {
    // Spread diagnostics first so `reason` / `feedback` always win at the top
    // level, and `env` / `plugins` (already nested in `diagnostics`) reach the
    // backend in the exact shape its breakdown SQL expects:
    //   payload->'env'->>'php', jsonb_array_elements_text(payload->'plugins').
    const properties: Record<string, unknown> = {
      ...this.diagnostics,
      reason,
    };
    if (feedback) properties.feedback = feedback;
    this.sendBeacon('product.uninstalled', properties);
    this.hideModal();
    // Flag the deactivation URL so the PHP `register_deactivation_hook` callback
    // can skip its own bare `product.uninstalled` event and avoid double-counting
    // (the modal-fired event carries reason + feedback + env, the hook-fired one
    // has env only).
    const sep = this.deactivateUrl.includes('?') ? '&' : '?';
    window.location.href = `${this.deactivateUrl}${sep}packedge_dm=1`;
  }

  private interceptDeactivateLink(): void {
    document.addEventListener('click', (e) => {
      const link = (e.target as HTMLElement).closest(
        `tr[data-slug="${this.slug}"] .deactivate a`
      );
      if (!link) return;
      e.preventDefault();
      this.deactivateUrl = link.getAttribute('href')!;
      this.showModal();
    });
  }
}
