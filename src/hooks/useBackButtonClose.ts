import { useEffect, useRef } from "react";

type BackHandler = () => void;

// Stack of open layers; only the topmost closes on a device/browser back press.
const layerStack: BackHandler[] = [];

let globalListenerReady = false;
function ensureGlobalListener() {
  if (globalListenerReady || typeof window === "undefined") return;
  globalListenerReady = true;
  window.addEventListener("popstate", () => {
    const top = layerStack.pop();
    if (top) top();
  });
}

/**
 * Makes the device/browser back button close a modal instead of leaving the app.
 * Pushes a history entry while the modal is open; a back press pops it and closes
 * the topmost open layer. When the modal closes by other means, the pushed entry
 * is removed so history stays clean.
 */
export function useBackButtonClose(isOpen: boolean, onClose: () => void) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return;
    ensureGlobalListener();

    const handler: BackHandler = () => onCloseRef.current();
    window.history.pushState({ pdvModal: true }, "");
    layerStack.push(handler);

    return () => {
      const index = layerStack.indexOf(handler);
      if (index !== -1) {
        layerStack.splice(index, 1);
        // Layer closed without the back button: remove the pushed entry.
        window.history.back();
      }
    };
  }, [isOpen]);
}
