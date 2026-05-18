const TILE_SIZE = 16;
const COLUMNS = 8;

const TILE_NAMES = [
  'missing',
  'stone',
  'deepslate',
  'dirt',
  'grass_top',
  'grass_side',
  'sand',
  'gravel',
  'water',
  'lava',
  'leaves',
  'log_side',
  'log_top',
  'planks',
  'bedrock',
  'snow',
  'ice',
  'coal_ore',
  'iron_ore',
  'copper_ore',
  'gold_ore',
  'redstone_ore',
  'lapis_ore',
  'diamond_ore',
  'emerald_ore',
  'clay',
  'mud',
  'netherrack',
  'basalt',
  'blackstone',
  'terracotta',
  'plant'
];

const TILE_INDEX = new Map(TILE_NAMES.map((name, index) => [name, index]));

export function createTextureAtlasData() {
  const rows = Math.ceil(TILE_NAMES.length / COLUMNS);
  const width = COLUMNS * TILE_SIZE;
  const height = rows * TILE_SIZE;
  const data = new Uint8Array(width * height * 4);

  TILE_NAMES.forEach((name, index) => {
    drawTile(data, width, index, name);
  });

  return {data, width, height, tileSize: TILE_SIZE, columns: COLUMNS, rows, tileCount: TILE_NAMES.length};
}

export function getTileUv(tileName) {
  const index = TILE_INDEX.get(tileName) ?? 0;
  const col = index % COLUMNS;
  const row = Math.floor(index / COLUMNS);
  const width = COLUMNS * TILE_SIZE;
  const height = Math.ceil(TILE_NAMES.length / COLUMNS) * TILE_SIZE;
  const insetU = 0.5 / width;
  const insetV = 0.5 / height;
  const u0 = (col * TILE_SIZE) / width + insetU;
  const v0 = (row * TILE_SIZE) / height + insetV;
  const u1 = ((col + 1) * TILE_SIZE) / width - insetU;
  const v1 = ((row + 1) * TILE_SIZE) / height - insetV;

  return [
    [u0, v1],
    [u1, v1],
    [u1, v0],
    [u0, v0]
  ];
}

export function getBlockTile(blockName, face) {
  const name = blockName.replace(/^minecraft:/, '');

  if (name === 'grass_block') {
    if (face === 'top') {
      return 'grass_top';
    }

    if (face === 'bottom') {
      return 'dirt';
    }

    return 'grass_side';
  }

  if (name.includes('deepslate')) {
    return name.endsWith('_ore') ? oreTile(name) : 'deepslate';
  }

  if (name.endsWith('_ore')) {
    return oreTile(name);
  }

  if (name.includes('dirt') || name === 'podzol' || name === 'farmland') {
    return 'dirt';
  }

  if (name.includes('sand')) {
    return 'sand';
  }

  if (name.includes('gravel')) {
    return 'gravel';
  }

  if (name.includes('water')) {
    return 'water';
  }

  if (name.includes('lava')) {
    return 'lava';
  }

  if (name.endsWith('leaves')) {
    return 'leaves';
  }

  if (/_log$|_stem$|_wood$|_hyphae$/.test(name)) {
    return face === 'top' || face === 'bottom' ? 'log_top' : 'log_side';
  }

  if (name.endsWith('_planks')) {
    return 'planks';
  }

  if (name === 'bedrock') {
    return 'bedrock';
  }

  if (name.includes('snow')) {
    return 'snow';
  }

  if (name.includes('ice')) {
    return 'ice';
  }

  if (name.includes('clay')) {
    return 'clay';
  }

  if (name.includes('mud')) {
    return 'mud';
  }

  if (name.includes('netherrack')) {
    return 'netherrack';
  }

  if (name.includes('basalt')) {
    return 'basalt';
  }

  if (name.includes('blackstone')) {
    return 'blackstone';
  }

  if (name.includes('terracotta') || name.includes('concrete')) {
    return 'terracotta';
  }

  if (/grass|fern|sapling|flower|tulip|poppy|dandelion|bamboo|vine|azalea|moss/.test(name)) {
    return 'plant';
  }

  return 'stone';
}

function oreTile(name) {
  if (name.includes('coal')) {
    return 'coal_ore';
  }
  if (name.includes('iron')) {
    return 'iron_ore';
  }
  if (name.includes('copper')) {
    return 'copper_ore';
  }
  if (name.includes('gold')) {
    return 'gold_ore';
  }
  if (name.includes('redstone')) {
    return 'redstone_ore';
  }
  if (name.includes('lapis')) {
    return 'lapis_ore';
  }
  if (name.includes('diamond')) {
    return 'diamond_ore';
  }
  if (name.includes('emerald')) {
    return 'emerald_ore';
  }

  return 'stone';
}

function drawTile(data, atlasWidth, tileIndex, name) {
  const col = tileIndex % COLUMNS;
  const row = Math.floor(tileIndex / COLUMNS);

  for (let y = 0; y < TILE_SIZE; y += 1) {
    for (let x = 0; x < TILE_SIZE; x += 1) {
      const [r, g, b, a] = sampleTile(name, x, y, tileIndex);
      const atlasX = col * TILE_SIZE + x;
      const atlasY = row * TILE_SIZE + y;
      const offset = (atlasY * atlasWidth + atlasX) * 4;
      data[offset] = r;
      data[offset + 1] = g;
      data[offset + 2] = b;
      data[offset + 3] = a;
    }
  }
}

function sampleTile(name, x, y, seed) {
  switch (name) {
    case 'missing':
      return (x + y) % 2 ? [205, 39, 205, 255] : [28, 28, 28, 255];
    case 'stone':
      return noisy([108, 108, 104, 255], x, y, seed, 20);
    case 'deepslate':
      return noisy([58, 58, 64, 255], x, y, seed, 16);
    case 'dirt':
      return noisy([113, 74, 43, 255], x, y, seed, 24);
    case 'grass_top':
      return noisy([91, 145, 54, 255], x, y, seed, 28);
    case 'grass_side': {
      const base = y < 5 ? [88, 142, 49, 255] : [118, 78, 45, 255];
      return noisy(base, x, y, seed, 22);
    }
    case 'sand':
      return noisy([210, 197, 139, 255], x, y, seed, 14);
    case 'gravel':
      return noisy([125, 122, 118, 255], x, y, seed, 34);
    case 'water':
      return wave([36, 99, 210, 168], x, y, seed);
    case 'lava':
      return lava(x, y, seed);
    case 'leaves':
      return leaves(x, y, seed);
    case 'log_side':
      return bark(x, y, seed);
    case 'log_top':
      return rings(x, y, seed);
    case 'planks':
      return planks(x, y, seed);
    case 'bedrock':
      return noisy([50, 50, 52, 255], x, y, seed, 48);
    case 'snow':
      return noisy([235, 246, 250, 245], x, y, seed, 8);
    case 'ice':
      return noisy([120, 174, 236, 150], x, y, seed, 20);
    case 'coal_ore':
      return ore([100, 100, 96, 255], [38, 38, 38, 255], x, y, seed);
    case 'iron_ore':
      return ore([104, 104, 100, 255], [211, 157, 113, 255], x, y, seed);
    case 'copper_ore':
      return ore([96, 106, 102, 255], [203, 121, 77, 255], x, y, seed);
    case 'gold_ore':
      return ore([104, 104, 98, 255], [238, 197, 71, 255], x, y, seed);
    case 'redstone_ore':
      return ore([96, 96, 94, 255], [202, 45, 40, 255], x, y, seed);
    case 'lapis_ore':
      return ore([92, 96, 104, 255], [43, 83, 181, 255], x, y, seed);
    case 'diamond_ore':
      return ore([104, 112, 112, 255], [92, 210, 214, 255], x, y, seed);
    case 'emerald_ore':
      return ore([104, 112, 104, 255], [48, 204, 92, 255], x, y, seed);
    case 'clay':
      return noisy([125, 136, 146, 255], x, y, seed, 18);
    case 'mud':
      return noisy([68, 56, 48, 255], x, y, seed, 18);
    case 'netherrack':
      return noisy([113, 51, 52, 255], x, y, seed, 30);
    case 'basalt':
      return noisy([74, 73, 78, 255], x, y, seed, 16);
    case 'blackstone':
      return noisy([43, 39, 45, 255], x, y, seed, 16);
    case 'terracotta':
      return noisy([142, 89, 64, 255], x, y, seed, 16);
    case 'plant':
      return plant(x, y, seed);
    default:
      return noisy([116, 116, 112, 255], x, y, seed, 20);
  }
}

function noisy(base, x, y, seed, amount) {
  const n = hash(x, y, seed) - 0.5;
  return [
    clamp(base[0] + n * amount),
    clamp(base[1] + n * amount),
    clamp(base[2] + n * amount),
    base[3]
  ];
}

function wave(base, x, y, seed) {
  const stripe = Math.sin((x + y + seed) * 0.9) * 12;
  const n = (hash(x, y, seed) - 0.5) * 12;
  return [clamp(base[0] + stripe + n), clamp(base[1] + stripe + n), clamp(base[2] + stripe + n), base[3]];
}

function lava(x, y, seed) {
  const hot = hash(Math.floor(x / 2), Math.floor(y / 2), seed) > 0.58;
  const base = hot ? [255, 211, 64, 255] : [232, 72, 9, 255];
  return noisy(base, x, y, seed, 24);
}

function leaves(x, y, seed) {
  if (hash(x, y, seed) < 0.12) {
    return [22, 56, 24, 70];
  }

  return noisy([68, 136, 55, 225], x, y, seed, 42);
}

function bark(x, y, seed) {
  const stripe = x % 5 === 0 || x % 7 === 0 ? -32 : 0;
  return noisy([93 + stripe, 63 + stripe * 0.5, 36, 255], x, y, seed, 18);
}

function rings(x, y, seed) {
  const dx = x - 7.5;
  const dy = y - 7.5;
  const ring = Math.floor(Math.sqrt(dx * dx + dy * dy) * 2) % 2 === 0 ? 22 : -6;
  return noisy([151 + ring, 111 + ring, 62 + ring * 0.5, 255], x, y, seed, 10);
}

function planks(x, y, seed) {
  const line = y === 4 || y === 9 || x % 8 === 0 ? -28 : 0;
  return noisy([154 + line, 114 + line, 67 + line * 0.5, 255], x, y, seed, 12);
}

function ore(stone, mineral, x, y, seed) {
  const vein = hash(Math.floor(x / 2), Math.floor(y / 2), seed) > 0.72;
  return noisy(vein ? mineral : stone, x, y, seed, vein ? 18 : 12);
}

function plant(x, y, seed) {
  const blade = Math.abs(x - 7.5) < 1.8 || Math.abs(x - y) < 1.3 || Math.abs(x + y - 15) < 1.3;
  if (!blade && hash(x, y, seed) < 0.72) {
    return [28, 70, 31, 45];
  }

  return noisy([76, 150, 47, 210], x, y, seed, 36);
}

function hash(x, y, seed) {
  const value = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453123;
  return value - Math.floor(value);
}

function clamp(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
}
