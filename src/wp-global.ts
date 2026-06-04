/**
 * PackEdge WordPress drop-in bootstrap (IIFE).
 *
 * Build this to a single browser file, ship it as a plugin's
 * `assets/js/packedge.js`, and the PHP SDK does the rest: `Client::enqueue_scripts()`
 * localizes one `window.packedge_<public_key>` config object per plugin, and this
 * script auto-initializes each — no per-plugin JavaScript required. Safe to load
 * from several plugins at once (each key initializes exactly once).
 *
 * Config flags (set by the PHP SDK):
 *   - deactivation: show the deactivation feedback modal on plugins.php
 *   - analytics:    enable the consent notice + auto-tracking
 */
import packedgeWP, { type WPConfig } from './wp';
import { DeactivationModal } from './deactivation-modal';

interface BootConfig extends WPConfig {
  publicKey?: string;
  deactivation?: boolean;
  analytics?: boolean;
}

(function () {
  const w = window as unknown as Record<string, unknown>;
  const inited: Set<string> =
    (w.__packedgeWPInited as Set<string>) || (w.__packedgeWPInited = new Set<string>());

  const init = () => {
    for (const name of Object.keys(w)) {
      if (name.indexOf('packedge_') !== 0) continue;
      const cfg = w[name] as BootConfig | undefined;
      if (!cfg || typeof cfg !== 'object' || !cfg.publicKey) continue;
      if (inited.has(cfg.publicKey)) continue;
      inited.add(cfg.publicKey);

      try {
        // Deactivation feedback modal — diagnostics are only localized on plugins.php.
        if (cfg.deactivation && cfg.diagnostics) {
          new DeactivationModal({
            slug: cfg.slug,
            publicKey: cfg.publicKey,
            site: cfg.site,
            diagnostics: cfg.diagnostics,
          });
        }
        // Full analytics: consent notice + auto-tracking.
        if (cfg.analytics) {
          packedgeWP(cfg.publicKey, cfg).useAnalytics();
        }
      } catch {
        // Best-effort — never break the wp-admin.
      }
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
