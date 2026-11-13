import { bindingServices, widgetBindings } from "./bindings";
import { LayoutItem } from "./types";

/**
 * Which services a widget names, wherever in its configuration it names them.
 *
 * A projection of `widgetBindings`, which knows which way each one goes, so
 * the two cannot disagree about what a widget reaches. What is and is not
 * walked — a container's children, a repeat's template, a payload's values —
 * is described there.
 */
export function widgetServiceUuids(item: LayoutItem): string[] {
  return bindingServices(widgetBindings(item));
}
