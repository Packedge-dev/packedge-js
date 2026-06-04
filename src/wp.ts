import { PackEdge } from './packedge';
import { DeactivationModal, type Diagnostics } from './deactivation-modal';

export interface WPConfig {
  slug: string;
  pluginName?: string;
  site?: string;
  consent?: boolean;
  consentAsked?: boolean;
  restUrl?: string;
  nonce?: string;
  diagnostics?: Diagnostics;
}

/**
 * WordPress adapter for PackEdge.
 *
 * Extends the core SDK with WP-specific UI:
 * - Consent notice (admin banner asking to share diagnostics)
 * - Deactivation feedback modal (on plugins.php)
 */
export class PackEdgeWP extends PackEdge {
  private wpConfig: WPConfig;

  constructor(publicKey: string, config: WPConfig) {
    super(publicKey, { slug: config.slug, site: config.site });
    this.wpConfig = config;
  }

  useAnalytics(): this {
    super.useAnalytics({ consent: this.wpConfig.consent });

    // Show consent notice if user hasn't been asked yet
    if (!this.wpConfig.consentAsked) {
      this.showConsentNotice();
    }

    // Deactivation modal on plugins.php (diagnostics only present on that page)
    if (this.wpConfig.diagnostics && this.wpConfig.slug) {
      new DeactivationModal({
        slug: this.wpConfig.slug,
        publicKey: this.publicKey,
        site: this.wpConfig.site,
        diagnostics: this.wpConfig.diagnostics,
      });
    }

    return this;
  }

  private showConsentNotice(): void {
    const wrap = document.querySelector('#wpbody-content .wrap');
    if (!wrap) return;

    const { pluginName, restUrl, nonce } = this.wpConfig;

    const name = pluginName || this.wpConfig.slug;

    const notice = document.createElement('div');
    notice.className = 'notice notice-info packedge-consent-notice';
    notice.style.cssText = 'display:flex;align-items:center;gap:12px;padding:8px 12px';

    const icon = document.createElement('span');
    icon.className = 'dashicons dashicons-chart-bar';
    icon.style.cssText = 'font-size:20px;width:20px;height:20px;color:#2271b1;flex-shrink:0';
    notice.appendChild(icon);

    const msg = document.createElement('div');
    msg.style.cssText = 'margin:0;flex:1';

    const dataList = 'Site URL, site title, admin email, WordPress/PHP/MySQL versions, locale, language, timezone, multisite status, memory limit, debug mode, active theme, active plugins, and server software.';

    msg.innerHTML =
      `<p style="margin:0">Help us make <strong>${name}</strong> better! Opt in to share non-sensitive <a href="#" class="packedge-data-toggle">diagnostic data</a> — it takes one click and keeps your site info private. <a href="https://packedge.dev/privacy/" target="_blank" rel="noopener noreferrer">Privacy Policy</a></p>` +
      `<p class="packedge-data-list" style="margin:4px 0 0;font-size:12px;color:#646970;display:none">${dataList}</p>`;

    msg.querySelector('.packedge-data-toggle')!.addEventListener('click', (e) => {
      e.preventDefault();
      const list = msg.querySelector('.packedge-data-list') as HTMLElement;
      list.style.display = list.style.display === 'none' ? '' : 'none';
    });

    const actions = document.createElement('div');
    actions.style.cssText = 'display:flex;gap:8px;flex-shrink:0;margin-left:16px';

    const allowBtn = document.createElement('button');
    allowBtn.className = 'button button-primary';
    allowBtn.textContent = 'Allow';
    allowBtn.type = 'button';

    const denyBtn = document.createElement('button');
    denyBtn.className = 'button';
    denyBtn.textContent = 'No thanks';
    denyBtn.type = 'button';

    actions.appendChild(allowBtn);
    actions.appendChild(denyBtn);
    notice.appendChild(msg);
    notice.appendChild(actions);
    wrap.parentNode!.insertBefore(notice, wrap);

    const saveConsent = (consent: boolean) => {
      notice.remove();
      if (restUrl) {
        fetch(restUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-WP-Nonce': nonce || '' },
          body: JSON.stringify({ consent }),
        }).catch(() => {});
      }
    };

    allowBtn.addEventListener('click', () => {
      saveConsent(true);
      this.track('product.optin');
    });
    denyBtn.addEventListener('click', () => saveConsent(false));
  }
}

/**
 * Factory function for WordPress context.
 *
 * Auto-discovers config from window.packedge_{publicKey} when no config is passed.
 *
 * Usage:
 *   packedgeWP('public_key').useAnalytics();
 */
export default function packedgeWP(publicKey: string, config?: WPConfig): PackEdgeWP {
  if (!config) {
    const varName = 'packedge_' + publicKey.replace(/[^a-zA-Z0-9]/g, '_');
    config = (window as unknown as Record<string, unknown>)[varName] as WPConfig;
  }
  return new PackEdgeWP(publicKey, config);
}
