/**
 * Superpowers Plugin for The G2 Chronicles
 * Activated via triple-click on the R1 Ring.
 */

export interface SuperpowerState {
  active: boolean;
  godMode: boolean;
  allItemsRevealed: boolean;
}

export const superpowers: SuperpowerState = {
  active: false,
  godMode: false,
  allItemsRevealed: false,
};

export type SuperpowerAction =
  | 'toggle_god_mode'
  | 'reveal_all'
  | 'full_heal'
  | 'full_inventory'
  | 'exit';

export interface SuperpowerOption {
  label: { it: string; en: string };
  action: SuperpowerAction;
}

export function getSuperpowerOptions(): SuperpowerOption[] {
  return [
    {
      label: {
        it: superpowers.godMode ? '[ON] Modalità Dio' : '[OFF] Modalità Dio',
        en: superpowers.godMode ? '[ON] God Mode' : '[OFF] God Mode',
      },
      action: 'toggle_god_mode',
    },
    {
      label: {
        it: superpowers.allItemsRevealed ? '[ON] Rivela Tutto' : '[OFF] Rivela Tutto',
        en: superpowers.allItemsRevealed ? '[ON] Reveal All' : '[OFF] Reveal All',
      },
      action: 'reveal_all',
    },
    {
      label: { it: 'Cura Completa (+100 HP)', en: 'Full Heal (+100 HP)' },
      action: 'full_heal',
    },
    {
      label: { it: 'Inventario Completo', en: 'Full Inventory' },
      action: 'full_inventory',
    },
    {
      label: { it: '< Torna', en: '< Back' },
      action: 'exit',
    },
  ];
}

export function applyGodMode(currentHp: number, damage: number): number {
  if (superpowers.godMode) return Math.max(1, currentHp);
  return currentHp - damage;
}

export function getRevealedInventory(existing: string[]): string[] {
  if (!superpowers.allItemsRevealed) return existing;
  const all = ['Torcia', 'Luce', 'Medaglione'];
  return Array.from(new Set([...existing, ...all]));
}
