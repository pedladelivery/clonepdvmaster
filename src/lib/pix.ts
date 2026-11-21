// Gera o "PIX Copia e Cola" (BR Code EMV) com valor embutido.
const f = (id: string, v: string) => id + String(v.length).padStart(2, "0") + v;

const clean = (s: string, max: number) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z0-9 ]/g, "").trim().slice(0, max) || "NA";

function crc16(str: string) {
  let crc = 0xffff;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
    crc &= 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

export function buildPixPayload(opts: { key: string; name: string; city: string; amount: number; txid?: string }) {
  const key = opts.key.trim();
  const merchant = f("00", "br.gov.bcb.pix") + f("01", key);
  const txid = (opts.txid || "***").replace(/[^A-Za-z0-9*]/g, "").slice(0, 25) || "***";
  let p =
    f("00", "01") +
    f("26", merchant) +
    f("52", "0000") +
    f("53", "986") +
    (opts.amount > 0 ? f("54", opts.amount.toFixed(2)) : "") +
    f("58", "BR") +
    f("59", clean(opts.name, 25)) +
    f("60", clean(opts.city, 15)) +
    f("62", f("05", txid)) +
    "6304";
  return p + crc16(p);
}
