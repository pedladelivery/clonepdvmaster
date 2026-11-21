const CONNECTOR_WORDS = new Set([
  "da",
  "de",
  "di",
  "do",
  "du",
  "das",
  "dos",
  "d",
  "e",
]);

export const getNameInitials = (name: string) => {
  const parts = name
    .trim()
    .split(/\s+/)
    .map((part) => part.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ""))
    .filter(Boolean)
    .filter((part) => !CONNECTOR_WORDS.has(part.toLocaleLowerCase("pt-BR")));

  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0].slice(0, 2).toLocaleUpperCase("pt-BR");

  return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toLocaleUpperCase("pt-BR");
};