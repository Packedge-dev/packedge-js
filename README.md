# PackEdge JS SDK

License validation, auto-updates, feedback, and analytics.

**Docs:** [docs.packedge.dev](https://docs.packedge.dev)

## Install

```bash
pnpm add packedge
```

## Usage

```javascript
import packedge from 'packedge';

packedge.init('pk_your_public_key');

await packedge.validateLicense('LICENSE-KEY');
await packedge.activateLicense('LICENSE-KEY');
await packedge.deactivateLicense('LICENSE-KEY');
await packedge.getReleases('my-plugin');
await packedge.submitFeedback({ type: 'bug', message: '...' });
packedge.track('feature_used', { feature: 'export' });
```

## License

MIT
