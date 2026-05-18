import {getBlockTile, getTileUv} from './textureAtlas.js';

const FACES = [
  {
    name: 'east',
    neighbor: [1, 0, 0],
    normal: [1, 0, 0],
    corners: [
      [1, 0, 0],
      [1, 1, 0],
      [1, 1, 1],
      [1, 0, 1]
    ]
  },
  {
    name: 'west',
    neighbor: [-1, 0, 0],
    normal: [-1, 0, 0],
    corners: [
      [0, 1, 0],
      [0, 0, 0],
      [0, 0, 1],
      [0, 1, 1]
    ]
  },
  {
    name: 'south',
    neighbor: [0, 0, 1],
    normal: [0, 1, 0],
    corners: [
      [1, 1, 0],
      [0, 1, 0],
      [0, 1, 1],
      [1, 1, 1]
    ]
  },
  {
    name: 'north',
    neighbor: [0, 0, -1],
    normal: [0, -1, 0],
    corners: [
      [0, 0, 0],
      [1, 0, 0],
      [1, 0, 1],
      [0, 0, 1]
    ]
  },
  {
    name: 'top',
    neighbor: [0, 1, 0],
    normal: [0, 0, 1],
    corners: [
      [0, 0, 1],
      [1, 0, 1],
      [1, 1, 1],
      [0, 1, 1]
    ]
  },
  {
    name: 'bottom',
    neighbor: [0, -1, 0],
    normal: [0, 0, -1],
    corners: [
      [0, 1, 0],
      [1, 1, 0],
      [1, 0, 0],
      [0, 0, 0]
    ]
  }
];

const TRIANGLES = [0, 1, 2, 0, 2, 3];

export function buildChunkMesh(blocks, layerMax) {
  const clipped = blocks.filter((block) => block.y <= layerMax);
  const occupied = new Set(clipped.map(blockKey));
  const positions = [];
  const normals = [];
  const texCoords = [];
  let faceCount = 0;
  let visibleBlockCount = 0;

  for (const block of clipped) {
    let hasFace = false;

    for (const face of FACES) {
      const [dx, dy, dz] = face.neighbor;

      if (occupied.has(`${block.x + dx},${block.y + dy},${block.z + dz}`)) {
        continue;
      }

      hasFace = true;
      faceCount += 1;
      pushFace(positions, normals, texCoords, block, face);
    }

    if (hasFace) {
      visibleBlockCount += 1;
    }
  }

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    texCoords: new Float32Array(texCoords),
    vertexCount: positions.length / 3,
    blockCount: visibleBlockCount,
    faceCount
  };
}

function pushFace(positions, normals, texCoords, block, face) {
  const tileName = getBlockTile(block.name, face.name);
  const uv = getTileUv(tileName);

  for (const cornerIndex of TRIANGLES) {
    const [x, y, z] = face.corners[cornerIndex];
    const [u, v] = uv[cornerIndex];

    positions.push(block.x - 8 + x, block.z - 8 + y, block.y + z);
    normals.push(...face.normal);
    texCoords.push(u, v);
  }
}

function blockKey(block) {
  return `${block.x},${block.y},${block.z}`;
}
