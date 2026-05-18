import {inflate, ungzip} from 'pako';
import {getBlockColor, isRenderableBlock} from './blockColors.js';

const SECTOR_BYTES = 4096;
const LOCATION_COUNT = 1024;

const OLD_ID_NAMES = {
  1: 'minecraft:stone',
  2: 'minecraft:grass_block',
  3: 'minecraft:dirt',
  4: 'minecraft:cobblestone',
  5: 'minecraft:oak_planks',
  7: 'minecraft:bedrock',
  8: 'minecraft:water',
  9: 'minecraft:water',
  10: 'minecraft:lava',
  11: 'minecraft:lava',
  12: 'minecraft:sand',
  13: 'minecraft:gravel',
  14: 'minecraft:gold_ore',
  15: 'minecraft:iron_ore',
  16: 'minecraft:coal_ore',
  17: 'minecraft:oak_log',
  18: 'minecraft:oak_leaves',
  24: 'minecraft:sandstone',
  31: 'minecraft:grass',
  37: 'minecraft:dandelion',
  38: 'minecraft:poppy',
  41: 'minecraft:gold_block',
  42: 'minecraft:iron_block',
  45: 'minecraft:bricks',
  48: 'minecraft:mossy_cobblestone',
  49: 'minecraft:obsidian',
  56: 'minecraft:diamond_ore',
  57: 'minecraft:diamond_block',
  73: 'minecraft:redstone_ore',
  74: 'minecraft:redstone_ore',
  78: 'minecraft:snow',
  79: 'minecraft:ice',
  80: 'minecraft:snow_block',
  82: 'minecraft:clay',
  89: 'minecraft:glowstone',
  98: 'minecraft:stone_bricks',
  103: 'minecraft:melon',
  110: 'minecraft:mycelium',
  129: 'minecraft:emerald_ore',
  133: 'minecraft:emerald_block',
  152: 'minecraft:redstone_block',
  159: 'minecraft:terracotta',
  161: 'minecraft:acacia_leaves',
  162: 'minecraft:acacia_log',
  172: 'minecraft:terracotta',
  173: 'minecraft:coal_block',
  174: 'minecraft:packed_ice'
};

export function readRegionFile(buffer, fileName = 'region.mca') {
  if (buffer.byteLength < SECTOR_BYTES * 2) {
    throw new Error('Файл слишком мал для region .mca');
  }

  const view = new DataView(buffer);
  const match = fileName.match(/r\.(-?\d+)\.(-?\d+)\.mca$/i);
  const regionX = match ? Number(match[1]) : 0;
  const regionZ = match ? Number(match[2]) : 0;
  const chunks = [];

  for (let index = 0; index < LOCATION_COUNT; index += 1) {
    const byteOffset = index * 4;
    const sectorOffset =
      (view.getUint8(byteOffset) << 16) |
      (view.getUint8(byteOffset + 1) << 8) |
      view.getUint8(byteOffset + 2);
    const sectorCount = view.getUint8(byteOffset + 3);

    if (!sectorOffset || !sectorCount) {
      continue;
    }

    const localX = index % 32;
    const localZ = Math.floor(index / 32);
    const timestamp = view.getUint32(SECTOR_BYTES + byteOffset, false);

    chunks.push({
      index,
      localX,
      localZ,
      x: regionX * 32 + localX,
      z: regionZ * 32 + localZ,
      sectorOffset,
      sectorCount,
      timestamp
    });
  }

  return {
    fileName,
    buffer,
    regionX,
    regionZ,
    chunks
  };
}

export function parseChunk(region, chunkEntry) {
  const byteOffset = chunkEntry.sectorOffset * SECTOR_BYTES;
  const maxLength = chunkEntry.sectorCount * SECTOR_BYTES;
  const view = new DataView(region.buffer, byteOffset, maxLength);
  const declaredLength = view.getUint32(0, false);

  if (declaredLength <= 1 || declaredLength + 4 > maxLength) {
    throw new Error(`Некорректная длина данных чанка ${chunkEntry.x}, ${chunkEntry.z}`);
  }

  const compressionType = view.getUint8(4);
  const compressed = new Uint8Array(region.buffer, byteOffset + 5, declaredLength - 1);
  const nbtBytes = decompressChunkPayload(compressionType, compressed);
  const rootTag = new NbtReader(nbtBytes.buffer, nbtBytes.byteOffset, nbtBytes.byteLength).readRoot();
  const chunkRoot = rootTag.value.Level ?? rootTag.value;
  const sections = chunkRoot.sections ?? chunkRoot.Sections ?? [];
  const blocks = [];

  for (const section of sections) {
    blocks.push(...readSectionBlocks(section));
  }

  const {minY, maxY} = getBlockYBounds(blocks);

  return {
    ...chunkEntry,
    dataVersion: rootTag.value.DataVersion ?? chunkRoot.DataVersion ?? null,
    status: chunkRoot.Status ?? chunkRoot.status ?? null,
    blocks,
    minY,
    maxY
  };
}

function getBlockYBounds(blocks) {
  if (!blocks.length) {
    return {minY: 0, maxY: 0};
  }

  let minY = blocks[0].y;
  let maxY = blocks[0].y;

  for (const block of blocks) {
    if (block.y < minY) {
      minY = block.y;
    }

    if (block.y > maxY) {
      maxY = block.y;
    }
  }

  return {minY, maxY};
}

function decompressChunkPayload(compressionType, compressed) {
  if (compressionType === 1) {
    return ungzip(compressed);
  }

  if (compressionType === 2) {
    return inflate(compressed);
  }

  if (compressionType === 3) {
    return compressed;
  }

  if (compressionType === 4) {
    throw new Error('LZ4-сжатые чанки пока не поддерживаются браузерным парсером');
  }

  throw new Error(`Неизвестный тип сжатия чанка: ${compressionType}`);
}

function readSectionBlocks(section) {
  if (section.block_states?.palette || section.Palette) {
    return readPaletteSection(section);
  }

  if (section.Blocks) {
    return readLegacySection(section);
  }

  return [];
}

function readPaletteSection(section) {
  const yBase = Number(section.Y ?? section.y ?? 0) * 16;
  const blockStates = section.block_states ?? {};
  const palette = blockStates.palette ?? section.Palette ?? [];
  const packedData = blockStates.data ?? section.BlockStates ?? null;
  const paletteNames = palette.map((entry) => entry.Name ?? entry.name ?? 'minecraft:air');
  const bitsPerBlock = Math.max(4, Math.ceil(Math.log2(Math.max(paletteNames.length, 1))));
  const indexes = unpackBlockStateIndexes(packedData, bitsPerBlock);
  const blocks = [];

  for (let index = 0; index < 4096; index += 1) {
    const paletteIndex = indexes[index] ?? 0;
    const name = paletteNames[paletteIndex] ?? paletteNames[0] ?? 'minecraft:air';

    if (!isRenderableBlock(name)) {
      continue;
    }

    const x = index & 15;
    const z = (index >> 4) & 15;
    const y = yBase + ((index >> 8) & 15);

    blocks.push({
      x,
      y,
      z,
      name,
      color: getBlockColor(name)
    });
  }

  return blocks;
}

function readLegacySection(section) {
  const yBase = Number(section.Y ?? 0) * 16;
  const blocksArray = section.Blocks;
  const addArray = section.Add ?? null;
  const blocks = [];

  for (let index = 0; index < Math.min(4096, blocksArray.length); index += 1) {
    const low = blocksArray[index] & 0xff;
    const high = addArray ? getNibble(addArray, index) << 8 : 0;
    const blockId = high | low;

    if (blockId === 0) {
      continue;
    }

    const name = OLD_ID_NAMES[blockId] ?? 'minecraft:stone';
    const x = index & 15;
    const z = (index >> 4) & 15;
    const y = yBase + ((index >> 8) & 15);

    blocks.push({
      x,
      y,
      z,
      name,
      color: getBlockColor(name)
    });
  }

  return blocks;
}

function getNibble(bytes, index) {
  const value = bytes[Math.floor(index / 2)] & 0xff;
  return index % 2 === 0 ? value & 0x0f : value >> 4;
}

function unpackBlockStateIndexes(longArray, bitsPerBlock, count = 4096) {
  if (!longArray || longArray.length === 0) {
    return new Array(count).fill(0);
  }

  const valuesPerLong = Math.floor(64 / bitsPerBlock);
  const expectedCompactLength = Math.ceil(count / valuesPerLong);
  const mask = (1n << BigInt(bitsPerBlock)) - 1n;
  const values = new Array(count);

  if (longArray.length === expectedCompactLength) {
    for (let index = 0; index < count; index += 1) {
      const longIndex = Math.floor(index / valuesPerLong);
      const bitOffset = (index % valuesPerLong) * bitsPerBlock;
      const raw = BigInt.asUintN(64, longArray[longIndex] ?? 0n);
      values[index] = Number((raw >> BigInt(bitOffset)) & mask);
    }

    return values;
  }

  for (let index = 0; index < count; index += 1) {
    const bitIndex = index * bitsPerBlock;
    const longIndex = Math.floor(bitIndex / 64);
    const bitOffset = bitIndex % 64;
    let raw = BigInt.asUintN(64, longArray[longIndex] ?? 0n) >> BigInt(bitOffset);

    if (bitOffset + bitsPerBlock > 64) {
      raw |= BigInt.asUintN(64, longArray[longIndex + 1] ?? 0n) << BigInt(64 - bitOffset);
    }

    values[index] = Number(raw & mask);
  }

  return values;
}

class NbtReader {
  constructor(buffer, byteOffset = 0, byteLength = buffer.byteLength) {
    this.view = new DataView(buffer, byteOffset, byteLength);
    this.offset = 0;
  }

  readRoot() {
    const type = this.readUint8();

    if (type !== 10) {
      throw new Error('Корневой NBT-тег должен быть Compound');
    }

    const name = this.readString();
    const value = this.readPayload(type);
    return {name, value};
  }

  readPayload(type) {
    switch (type) {
      case 0:
        return null;
      case 1:
        return this.readInt8();
      case 2:
        return this.readInt16();
      case 3:
        return this.readInt32();
      case 4:
        return this.readBigInt64();
      case 5:
        return this.readFloat32();
      case 6:
        return this.readFloat64();
      case 7:
        return this.readByteArray();
      case 8:
        return this.readString();
      case 9:
        return this.readList();
      case 10:
        return this.readCompound();
      case 11:
        return this.readIntArray();
      case 12:
        return this.readLongArray();
      default:
        throw new Error(`Неизвестный NBT-тег: ${type}`);
    }
  }

  readCompound() {
    const compound = {};

    while (true) {
      const type = this.readUint8();

      if (type === 0) {
        return compound;
      }

      const name = this.readString();
      compound[name] = this.readPayload(type);
    }
  }

  readList() {
    const type = this.readUint8();
    const length = this.readInt32();
    const list = [];

    for (let index = 0; index < length; index += 1) {
      list.push(this.readPayload(type));
    }

    return list;
  }

  readByteArray() {
    const length = this.readInt32();
    const start = this.offset;
    this.offset += length;
    return new Int8Array(this.view.buffer, this.view.byteOffset + start, length);
  }

  readIntArray() {
    const length = this.readInt32();
    const values = new Int32Array(length);

    for (let index = 0; index < length; index += 1) {
      values[index] = this.readInt32();
    }

    return values;
  }

  readLongArray() {
    const length = this.readInt32();
    const values = new Array(length);

    for (let index = 0; index < length; index += 1) {
      values[index] = this.readBigInt64();
    }

    return values;
  }

  readString() {
    const length = this.readUint16();
    const start = this.offset;
    this.offset += length;
    return new TextDecoder().decode(new Uint8Array(this.view.buffer, this.view.byteOffset + start, length));
  }

  readUint8() {
    const value = this.view.getUint8(this.offset);
    this.offset += 1;
    return value;
  }

  readInt8() {
    const value = this.view.getInt8(this.offset);
    this.offset += 1;
    return value;
  }

  readUint16() {
    const value = this.view.getUint16(this.offset, false);
    this.offset += 2;
    return value;
  }

  readInt16() {
    const value = this.view.getInt16(this.offset, false);
    this.offset += 2;
    return value;
  }

  readInt32() {
    const value = this.view.getInt32(this.offset, false);
    this.offset += 4;
    return value;
  }

  readBigInt64() {
    const value = this.view.getBigInt64(this.offset, false);
    this.offset += 8;
    return value;
  }

  readFloat32() {
    const value = this.view.getFloat32(this.offset, false);
    this.offset += 4;
    return value;
  }

  readFloat64() {
    const value = this.view.getFloat64(this.offset, false);
    this.offset += 8;
    return value;
  }
}
