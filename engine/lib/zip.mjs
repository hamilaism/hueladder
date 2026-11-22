// Une archive zip sans compression, sans dépendance : de quoi télécharger le paquet de
// livraison depuis le studio ouvert en file://. Format : APPNOTE 6.3.3, entrées « stored ».

const CRC = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = b => { let c = 0xffffffff; for (const x of b) c = CRC[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };

/** `files` : [[chemin, texte]] → Uint8Array. */
export function zip(files) {
  const enc = new TextEncoder(), local = [], central = [];
  let offset = 0;
  for (const [path, text] of files) {
    const name = enc.encode(path), data = enc.encode(text), crc = crc32(data);
    // en-tête commun : version 2.0, drapeau UTF-8 (bit 11), stored, date fixe 1980-01-01
    const common = [[20, 2], [0x0800, 2], [0, 2], [0, 2], [0x21, 2], [crc, 4], [data.length, 4], [data.length, 4], [name.length, 2], [0, 2]];
    local.push(bytes([[0x04034b50, 4], ...common]), name, data);
    central.push(bytes([[0x02014b50, 4], [20, 2], ...common, [0, 2], [0, 2], [0, 2], [0, 4], [offset, 4]]), name);
    offset += 30 + name.length + data.length;
  }
  const size = central.reduce((s, b) => s + b.length, 0);
  const end = bytes([[0x06054b50, 4], [0, 2], [0, 2], [files.length, 2], [files.length, 2], [size, 4], [offset, 4], [0, 2]]);
  const parts = [...local, ...central, end], out = new Uint8Array(parts.reduce((s, b) => s + b.length, 0));
  let p = 0; for (const b of parts) { out.set(b, p); p += b.length; }
  return out;
}

function bytes(fields) {
  const out = new Uint8Array(fields.reduce((s, [, n]) => s + n, 0));
  let p = 0; for (const [v, n] of fields) for (let i = 0; i < n; i++) out[p++] = (v >>> (8 * i)) & 0xff;
  return out;
}
