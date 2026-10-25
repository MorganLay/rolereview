/**
 * Rewrite a DOCX so two packs of the same content share one timestamp.
 * A submitted export uses `submittedAt`, so the file does not change on a later day.
 */

import { crc32, deflateRawSync, inflateRawSync } from "node:zlib";

const LOCAL = 0x04034b50;
const CENTRAL = 0x02014b50;
const EOCD = 0x06054b50;

type ZipEntry = {
  name: string;
  data: Buffer;
};

/** Replace ISO timestamps in `docProps/core.xml` and rebuild a deterministic zip. */
export function stampDocx(zip: Buffer, instant: Date): Buffer {
  const stamp = instant.toISOString();
  const entries = readZip(zip).map((entry) =>
    entry.name === "docProps/core.xml"
      ? {
          name: entry.name,
          data: Buffer.from(
            entry.data.toString("utf8").replace(
              /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/g,
              stamp,
            ),
            "utf8",
          ),
        }
      : entry,
  );
  return writeZip(entries, instant);
}

function readZip(zip: Buffer): ZipEntry[] {
  const eocd = findEocd(zip);
  const count = zip.readUInt16LE(eocd + 10);
  let cursor = zip.readUInt32LE(eocd + 16);
  const entries: ZipEntry[] = [];

  for (let index = 0; index < count; index += 1) {
    if (zip.readUInt32LE(cursor) !== CENTRAL) {
      throw new Error("Invalid document archive");
    }
    const method = zip.readUInt16LE(cursor + 10);
    const compressedSize = zip.readUInt32LE(cursor + 20);
    const nameLength = zip.readUInt16LE(cursor + 28);
    const extraLength = zip.readUInt16LE(cursor + 30);
    const commentLength = zip.readUInt16LE(cursor + 32);
    const localOffset = zip.readUInt32LE(cursor + 42);
    const name = zip.subarray(cursor + 46, cursor + 46 + nameLength).toString("utf8");
    cursor += 46 + nameLength + extraLength + commentLength;

    if (zip.readUInt32LE(localOffset) !== LOCAL) {
      throw new Error("Invalid document archive");
    }
    const localNameLength = zip.readUInt16LE(localOffset + 26);
    const localExtraLength = zip.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const compressed = zip.subarray(dataStart, dataStart + compressedSize);
    const data = inflateEntry(method, compressed);
    entries.push({ name, data });
  }

  return entries;
}

function writeZip(entries: ZipEntry[], instant: Date): Buffer {
  const { time, date } = dosDateTime(instant);
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const name = Buffer.from(entry.name, "utf8");
    const compressed = deflateRawSync(entry.data);
    const checksum = crc32(entry.data) >>> 0;
    const local = Buffer.alloc(30);
    local.writeUInt32LE(LOCAL, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(8, 8);
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(date, 12);
    local.writeUInt32LE(checksum, 16);
    local.writeUInt32LE(compressed.length, 20);
    local.writeUInt32LE(entry.data.length, 24);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    const file = Buffer.concat([local, name, compressed]);
    locals.push(file);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(CENTRAL, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(time, 12);
    central.writeUInt16LE(date, 14);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(entry.data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    centrals.push(Buffer.concat([central, name]));
    offset += file.length;
  }

  const centralDirectory = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(EOCD, 0);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralDirectory.length, 12);
  eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, centralDirectory, eocd]);
}

function inflateEntry(method: number, compressed: Buffer): Buffer {
  if (compressed.length === 0) return Buffer.alloc(0);
  if (method === 0) return Buffer.from(compressed);
  if (method === 8) return inflateRawSync(compressed);
  throw new Error("Invalid document archive");
}

function findEocd(zip: Buffer): number {
  const start = Math.max(0, zip.length - 22 - 65535);
  for (let index = zip.length - 22; index >= start; index -= 1) {
    if (zip.readUInt32LE(index) === EOCD) return index;
  }
  throw new Error("Invalid document archive");
}

/** UTC calendar fields packed into the DOS date and time a zip header stores. */
function dosDateTime(instant: Date): { time: number; date: number } {
  const year = Math.min(2107, Math.max(1980, instant.getUTCFullYear()));
  const time =
    (instant.getUTCHours() << 11) |
    (instant.getUTCMinutes() << 5) |
    Math.floor(instant.getUTCSeconds() / 2);
  const date =
    ((year - 1980) << 9) | ((instant.getUTCMonth() + 1) << 5) | instant.getUTCDate();
  return { time, date };
}
