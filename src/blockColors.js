const EXACT_COLORS = new Map([
  ['minecraft:air', [0, 0, 0, 0]],
  ['minecraft:cave_air', [0, 0, 0, 0]],
  ['minecraft:void_air', [0, 0, 0, 0]],
  ['minecraft:grass_block', [88, 138, 54, 255]],
  ['minecraft:dirt', [112, 75, 45, 255]],
  ['minecraft:coarse_dirt', [119, 85, 55, 255]],
  ['minecraft:podzol', [93, 63, 38, 255]],
  ['minecraft:stone', [104, 104, 104, 255]],
  ['minecraft:deepslate', [53, 53, 58, 255]],
  ['minecraft:cobbled_deepslate', [65, 65, 70, 255]],
  ['minecraft:cobblestone', [91, 91, 91, 255]],
  ['minecraft:bedrock', [44, 44, 47, 255]],
  ['minecraft:sand', [210, 196, 139, 255]],
  ['minecraft:red_sand', [176, 93, 38, 255]],
  ['minecraft:gravel', [121, 118, 114, 255]],
  ['minecraft:water', [42, 91, 201, 132]],
  ['minecraft:lava', [255, 100, 10, 255]],
  ['minecraft:oak_log', [93, 69, 42, 255]],
  ['minecraft:birch_log', [178, 164, 118, 255]],
  ['minecraft:spruce_log', [67, 46, 28, 255]],
  ['minecraft:jungle_log', [97, 69, 38, 255]],
  ['minecraft:acacia_log', [146, 78, 43, 255]],
  ['minecraft:dark_oak_log', [50, 34, 22, 255]],
  ['minecraft:oak_leaves', [69, 130, 42, 205]],
  ['minecraft:birch_leaves', [100, 151, 51, 205]],
  ['minecraft:spruce_leaves', [45, 95, 64, 205]],
  ['minecraft:jungle_leaves', [48, 124, 38, 205]],
  ['minecraft:acacia_leaves', [83, 129, 44, 205]],
  ['minecraft:dark_oak_leaves', [52, 111, 38, 205]],
  ['minecraft:snow', [238, 247, 252, 235]],
  ['minecraft:snow_block', [230, 242, 248, 255]],
  ['minecraft:ice', [137, 178, 255, 150]],
  ['minecraft:packed_ice', [108, 153, 220, 210]],
  ['minecraft:blue_ice', [82, 156, 240, 210]],
  ['minecraft:coal_ore', [70, 70, 70, 255]],
  ['minecraft:iron_ore', [145, 117, 94, 255]],
  ['minecraft:copper_ore', [142, 112, 88, 255]],
  ['minecraft:gold_ore', [201, 171, 68, 255]],
  ['minecraft:redstone_ore', [144, 49, 43, 255]],
  ['minecraft:lapis_ore', [57, 82, 152, 255]],
  ['minecraft:diamond_ore', [88, 174, 178, 255]],
  ['minecraft:emerald_ore', [70, 170, 93, 255]],
  ['minecraft:nether_quartz_ore', [160, 116, 102, 255]],
  ['minecraft:netherrack', [111, 54, 53, 255]],
  ['minecraft:basalt', [71, 70, 75, 255]],
  ['minecraft:blackstone', [41, 36, 41, 255]],
  ['minecraft:end_stone', [219, 222, 164, 255]]
]);

const GROUP_COLORS = [
  [/leaves$/, [64, 128, 48, 205]],
  [/_log$|_stem$|_wood$|_hyphae$/, [91, 62, 38, 255]],
  [/_planks$/, [152, 115, 70, 255]],
  [/_ore$/, [112, 112, 112, 255]],
  [/deepslate_.*_ore$/, [72, 72, 78, 255]],
  [/grass|fern|sapling|vine|bamboo|azalea|moss/, [72, 136, 48, 220]],
  [/flower|tulip|dandelion|poppy/, [185, 72, 76, 230]],
  [/glass/, [168, 216, 235, 95]],
  [/terracotta/, [137, 83, 61, 255]],
  [/concrete/, [128, 128, 128, 255]],
  [/wool/, [181, 181, 181, 255]],
  [/sandstone/, [198, 184, 124, 255]],
  [/brick/, [131, 67, 54, 255]],
  [/clay/, [126, 136, 145, 255]],
  [/mud/, [68, 56, 49, 255]]
];

export function isRenderableBlock(name) {
  return name && !name.endsWith(':air') && name !== 'minecraft:cave_air' && name !== 'minecraft:void_air';
}

export function getBlockColor(name) {
  if (EXACT_COLORS.has(name)) {
    return EXACT_COLORS.get(name);
  }

  const localName = name.replace(/^minecraft:/, '');
  const match = GROUP_COLORS.find(([pattern]) => pattern.test(localName));
  if (match) {
    return match[1];
  }

  return [112, 112, 108, 255];
}
