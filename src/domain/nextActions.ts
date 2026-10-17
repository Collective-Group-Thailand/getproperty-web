import type { IconGlyph } from "@/ui/icons";

/**
 * Next-action helpers (F1 1.3 §3): the API decides which state transitions the actor may perform now
 * and lists them on the resource (`nextActions: string[]`, the names of its `/actions/{name}` routes —
 * requested in docs/contract-requests.md). These helpers only *interpret* that list: they never infer
 * an action from a status, a role or a date.
 */
export interface ActionPresentation {
  labelKey: string;
  icon: IconGlyph;
  /** Irreversible actions go through a typed confirmation that restates the target (00-master-plan.md §8). */
  irreversible: boolean;
  tone: "primary" | "secondary" | "destructive";
}

export type ActionCatalogue<Action extends string> = Readonly<Record<Action, ActionPresentation>>;

export interface WithNextActions {
  nextActions?: readonly string[] | null;
}

/** Whether the API allows `action` on this resource now. Absent list = nothing allowed. */
export function canPerform(resource: WithNextActions | null | undefined, action: string): boolean {
  return Boolean(resource?.nextActions?.includes(action));
}

/**
 * The actions to render, in the API's order, limited to those this screen knows how to present; an
 * action the UI does not know yet is skipped rather than guessed.
 */
export function availableActions<Action extends string>(
  resource: WithNextActions | null | undefined,
  catalogue: ActionCatalogue<Action>,
): { action: Action; presentation: ActionPresentation }[] {
  return (resource?.nextActions ?? [])
    .filter((name): name is Action => Object.prototype.hasOwnProperty.call(catalogue, name))
    .map((action) => ({ action, presentation: catalogue[action] }));
}

/** The primary action (first non-destructive one the API lists), if any. */
export function primaryAction<Action extends string>(
  resource: WithNextActions | null | undefined,
  catalogue: ActionCatalogue<Action>,
): Action | undefined {
  return availableActions(resource, catalogue).find(({ presentation }) => presentation.tone !== "destructive")?.action;
}
