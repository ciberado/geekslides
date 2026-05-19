/**
 * GeekSlides v2 — Input module barrel export.
 */

export { CommandSystem } from './CommandSystem.ts';
export type { Command } from './CommandSystem.ts';
export { KeyBindings } from './KeyBindings.ts';
export { TouchInput } from './TouchInput.ts';
export { UserKeyBindings, normalizeKeyDescriptor, formatKeyForDisplay } from './UserKeyBindings.ts';
export type { KeyBindingEntry, KeyBindingsConfig } from './UserKeyBindings.ts';
export { KeybindingNotification } from './KeybindingNotification.ts';
export { ShortcutsPanel } from './ShortcutsPanel.ts';
