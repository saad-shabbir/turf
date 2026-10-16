// Same extension as widgets.ios.tsx: Metro tries every platform for .ts before any .tsx,
// so a widgets.ts stub would shadow the iPhone widget.
import type {Snapshot} from './model';
export function updateWidget(_snapshot:Snapshot|null) {}
