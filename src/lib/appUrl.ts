/** URL pública do aplicativo (usada em links enviados por e-mail). */
const PUBLISHED_APP_URL = "https://toquepdv.lovable.app";

/**
 * Retorna a base correta para links de e-mail.
 * Em ambientes de edição/preview do Lovable, usa a URL publicada do app
 * para que o link de recuperação abra o aplicativo e não o editor.
 */
export function getAppBaseUrl(): string {
  if (typeof window === "undefined") return PUBLISHED_APP_URL;

  const host = window.location.hostname;
  const isEditorOrPreview =
    host.endsWith("lovable.dev") ||
    host.endsWith("lovableproject.com") ||
    host.includes("-preview--") ||
    host.startsWith("id-preview");

  return isEditorOrPreview ? PUBLISHED_APP_URL : window.location.origin;
}
