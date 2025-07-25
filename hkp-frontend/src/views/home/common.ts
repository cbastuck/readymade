import { PlaygroundState } from "hkp-frontend/src/types";

export type WidgetDescriptor = {
  name: string;
  board: PlaygroundState;
  params: any;
};

export function storeAdditionalWidgetsToLocalStorage(
  additionalWidgets: Array<WidgetDescriptor>
) {
  localStorage.setItem(
    "hkp-home-additional-widgets",
    JSON.stringify(additionalWidgets)
  );
}

export function restoreAdditionalWidgetsFromLocalStorage() {
  const item = localStorage.getItem("hkp-home-additional-widgets");
  return item ? JSON.parse(item) : [];
}

export function importAdditionalWidgetToLocalStorage(widget: WidgetDescriptor) {
  const widgets = restoreAdditionalWidgetsFromLocalStorage();
  storeAdditionalWidgetsToLocalStorage([...widgets, widget]);
}
