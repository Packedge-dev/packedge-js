import { PackEdge, type PackEdgeOptions } from './packedge';

export { PackEdge, type PackEdgeOptions } from './packedge';
export type {
  License,
  ValidateLicenseResponse,
  ActivateResponse,
  DeactivateResponse,
  Release,
  FeedbackResponse,
  TrackResponse,
} from './packedge';

export { Events, type EventsConfig } from './events';
export { DeactivationModal, type DeactivationModalConfig, type Diagnostics } from './deactivation-modal';
export { PackEdgeWP, type WPConfig } from './wp';
export { default as packedgeWP } from './wp';

export default function packedge(publicKey: string, options?: PackEdgeOptions): PackEdge {
  return new PackEdge(publicKey, options);
}
