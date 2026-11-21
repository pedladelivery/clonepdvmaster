export const NOTE_OBS_PREFIX = "Obs:";

export interface SplitNote {
  /** Linhas de complementos, uma por item, no formato "Grupo: 1x Item". */
  complementLines: string[];
  /** Observação livre digitada pelo usuário. */
  obs: string;
}

/**
 * Separa a nota do item em linhas de complementos e observação livre.
 * Formato atual: linhas separadas por \n, sendo a observação a linha "Obs: ...".
 * Formato legado (linha única): "+ 1x Morango | Obs: sem cebola".
 */
export function splitItemNote(note = ""): SplitNote {
  const normalized = (note || "").replace(/\s*\|\s*(?=Obs:)/g, "\n");
  const lines = normalized.split("\n").map((l) => l.trim()).filter(Boolean);
  const complementLines: string[] = [];
  let obs = "";
  for (const line of lines) {
    if (line.startsWith(NOTE_OBS_PREFIX)) {
      obs = line.slice(NOTE_OBS_PREFIX.length).trim();
    } else {
      complementLines.push(line);
    }
  }
  return { complementLines, obs };
}

/** Reconstrói a nota mantendo as linhas de complementos e a observação livre. */
export function buildItemNote(complementLines: string[], obs = ""): string {
  const parts = [...complementLines];
  if (obs.trim()) parts.push(`${NOTE_OBS_PREFIX} ${obs.trim()}`);
  return parts.join("\n");
}
