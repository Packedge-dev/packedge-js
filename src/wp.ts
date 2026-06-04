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

    const dataList = 'Site URL, site title, admin email, WordPress/PHP/MySQL versions, locale, language, timezone, multisite status, memory limit, debug mode, active theme, active plugins, and server software.';

    // Standard full-width WP admin notice so it stacks cleanly with other
    // notices (no custom card margins/borders that overlap them) — but kept to a
    // single compact row that only wraps when "What's shared?" is expanded.
    const notice = document.createElement('div');
    notice.className = 'notice notice-info packedge-consent-notice';
    notice.style.cssText =
      'display:flex;align-items:center;flex-wrap:wrap;gap:6px 10px;padding:8px 12px';

    const icon = document.createElement('span');
    icon.className = 'dashicons dashicons-chart-bar';
    icon.style.cssText = 'font-size:18px;width:18px;height:18px;color:#2271b1;flex-shrink:0';

    const msg = document.createElement('span');
    msg.style.cssText = 'flex:1;min-width:200px';
    msg.innerHTML =
      `Help improve <strong>${name}</strong> by sharing anonymous diagnostics. ` +
      `<a href="#" class="packedge-data-toggle" style="text-decoration:none">What’s shared?</a>`;

    const actions = document.createElement('span');
    actions.style.cssText = 'display:flex;gap:6px;flex-shrink:0';

    const allowBtn = document.createElement('button');
    allowBtn.type = 'button';
    allowBtn.className = 'button button-primary button-small';
    allowBtn.textContent = 'Allow';

    const denyBtn = document.createElement('button');
    denyBtn.type = 'button';
    denyBtn.className = 'button button-small';
    denyBtn.textContent = 'Not now';

    actions.appendChild(allowBtn);
    actions.appendChild(denyBtn);

    // Disclosure row — hidden until toggled; full-width so the bar stays one line.
    const list = document.createElement('span');
    list.className = 'packedge-data-list';
    list.style.cssText = 'display:none;flex-basis:100%;margin:0 0 1px 26px;font-size:12px;color:#646970';
    list.innerHTML =
      `${dataList} <a href="https://packedge.dev/privacy/" target="_blank" rel="noopener noreferrer">Privacy Policy</a>`;

    msg.querySelector('.packedge-data-toggle')!.addEventListener('click', (e) => {
      e.preventDefault();
      list.style.display = list.style.display === 'none' ? 'block' : 'none';
    });

    notice.appendChild(icon);
    notice.appendChild(msg);
    notice.appendChild(actions);
    notice.appendChild(list);

    // Place it where WordPress keeps page notices: just after the
    // hr.wp-header-end marker (core relocates admin notices there), else after
    // the page <h1>, else at the top of .wrap. Inside .wrap it gets the full
    // content width and stacks with other notices instead of fighting the
    // floated screen-meta links above .wrap.
    const anchor = wrap.querySelector('.wp-header-end') || wrap.querySelector('h1');
    if (anchor && anchor.parentNode) {
      anchor.parentNode.insertBefore(notice, anchor.nextSibling);
    } else {
      wrap.insertBefore(notice, wrap.firstChild);
    }

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
