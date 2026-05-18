import React, {useCallback, useMemo, useState} from 'react';
import DeckGL from '@deck.gl/react';
import {COORDINATE_SYSTEM, LightingEffect, AmbientLight, DirectionalLight, OrbitView} from '@deck.gl/core';
import {SimpleMeshLayer} from '@deck.gl/mesh-layers';
import {CubeGeometry} from '@luma.gl/engine';
import {Info, Map, Upload} from 'lucide-react';
import ChunkMeshLayer from './ChunkMeshLayer.js';
import {buildChunkMesh} from './chunkMesh.js';
import {parseChunk, readRegionFile} from './mcaParser.js';

const pickingCube = new CubeGeometry();
const SAMPLE_REGION = '/samples/r.0.0.mca';

const lightingEffect = new LightingEffect({
  ambient: new AmbientLight({color: [255, 255, 255], intensity: 1.15}),
  sun: new DirectionalLight({
    color: [255, 255, 255],
    intensity: 1.25,
    direction: [-3, -4, -5]
  }),
  fill: new DirectionalLight({
    color: [170, 200, 255],
    intensity: 0.4,
    direction: [3, 3, 2]
  })
});

const INITIAL_VIEW_STATE = {
  target: [0, 0, 0],
  rotationX: 58,
  rotationOrbit: -36,
  zoom: 4.2,
  minZoom: -2,
  maxZoom: 10
};

export default function App() {
  const [region, setRegion] = useState(null);
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [chunk, setChunk] = useState(null);
  const [layerMax, setLayerMax] = useState(0);
  const [status, setStatus] = useState('Файл не загружен');
  const [error, setError] = useState('');
  const [viewState, setViewState] = useState(INITIAL_VIEW_STATE);

  const applyParsedChunk = useCallback((nextRegion, entry, parsed) => {
    const yMid = parsed.minY + (parsed.maxY - parsed.minY) / 2;

    setChunk(parsed);
    setLayerMax(parsed.maxY);
    setSelectedIndex(entry.index);
    setViewState((current) => ({
      ...current,
      target: [0, 0, yMid],
      zoom: Math.max(2.8, current.zoom)
    }));
    setStatus(`${nextRegion.fileName}`);

    if (parsed.blocks.length) {
      setError('');
    } else {
      setError(
        `Чанк ${entry.x}, ${entry.z} пока не содержит блоков` +
          `${parsed.status ? ` (status: ${parsed.status})` : ''}. Выберите другой чанк в этом region.`
      );
    }
  }, []);

  const loadChunk = useCallback(
    (nextRegion, entry) => {
      setStatus('Чтение чанка');
      setError('');

      try {
        const parsed = parseChunk(nextRegion, entry);
        applyParsedChunk(nextRegion, entry, parsed);
      } catch (chunkError) {
        setChunk(null);
        setError(chunkError.message);
        setStatus('Ошибка чтения');
      }
    },
    [applyParsedChunk]
  );

  const loadRegionBuffer = useCallback(
    (buffer, fileName) => {
      const nextRegion = readRegionFile(buffer, fileName);
      setRegion(nextRegion);

      if (!nextRegion.chunks.length) {
        setStatus(fileName);
        setError('В region-файле не найдено ни одного чанка');
        return;
      }

      const firstRenderableChunk = findFirstRenderableChunk(nextRegion);

      if (firstRenderableChunk) {
        applyParsedChunk(nextRegion, firstRenderableChunk.entry, firstRenderableChunk.parsed);
      } else {
        loadChunk(nextRegion, nextRegion.chunks[0]);
      }
    },
    [applyParsedChunk, loadChunk]
  );

  const handleFileChange = useCallback(
    async (event) => {
      const file = event.target.files?.[0];

      if (!file) {
        return;
      }

      setStatus('Чтение region');
      setError('');
      setChunk(null);
      setRegion(null);

      try {
        const buffer = await file.arrayBuffer();
        loadRegionBuffer(buffer, file.name);
      } catch (fileError) {
        setStatus('Ошибка файла');
        setError(fileError.message);
      }
    },
    [loadRegionBuffer]
  );

  const handleSampleLoad = useCallback(async () => {
    setStatus('Чтение sample');
    setError('');
    setChunk(null);
    setRegion(null);

    try {
      const response = await fetch(SAMPLE_REGION);

      if (!response.ok) {
        throw new Error(`Не удалось загрузить sample: HTTP ${response.status}`);
      }

      const buffer = await response.arrayBuffer();
      loadRegionBuffer(buffer, 'r.0.0.mca');
    } catch (sampleError) {
      setStatus('Ошибка sample');
      setError(sampleError.message);
    }
  }, [loadRegionBuffer]);

  const handleChunkSelect = useCallback(
    (event) => {
      if (!region) {
        return;
      }

      const index = Number(event.target.value);
      const entry = region.chunks.find((item) => item.index === index);

      if (entry) {
        loadChunk(region, entry);
      }
    },
    [loadChunk, region]
  );

  const chunkMesh = useMemo(() => {
    if (!chunk) {
      return null;
    }

    return buildChunkMesh(chunk.blocks, layerMax);
  }, [chunk, layerMax]);

  const layers = useMemo(() => {
    if (!chunk) {
      return [];
    }

    return [
      new ChunkMeshLayer({
        id: 'minecraft-chunk-mesh-layer',
        mesh: chunkMesh,
        coordinateSystem: COORDINATE_SYSTEM.CARTESIAN,
        material: {
          ambient: 0.55,
          diffuse: 0.65,
          shininess: 16,
          specularColor: [20, 20, 20]
        },
        opacity: 1,
        parameters: {
          depthTest: true
        }
      }),
      new SimpleMeshLayer({
        id: 'minecraft-block-picking-layer',
        data: chunkMesh?.visibleBlocks ?? [],
        mesh: pickingCube,
        coordinateSystem: COORDINATE_SYSTEM.CARTESIAN,
        getPosition: (block) => [block.x - 7.5, block.z - 7.5, block.y + 0.5],
        getScale: [0.5, 0.5, 0.5],
        getColor: [0, 0, 0, 0],
        pickable: true,
        opacity: 1,
        parameters: {
          depthTest: true
        },
        updateTriggers: {
          getPosition: [chunk.index],
          getScale: [chunk.index],
          getColor: [chunk.index]
        }
      })
    ];
  }, [chunk, chunkMesh]);

  return (
    <main className="app-shell">
      <DeckGL
        views={new OrbitView({orbitAxis: 'Z', fovy: 42})}
        viewState={viewState}
        controller={{scrollZoom: true, dragRotate: true, doubleClickZoom: true}}
        onViewStateChange={({viewState: nextViewState}) => setViewState(nextViewState)}
        layers={layers}
        effects={[lightingEffect]}
        getTooltip={(info) => (info.object ? getBlockTooltip(info) : null)}
      />

      <section className="top-bar" aria-label="controls">
        <label className="file-button">
          <Upload size={16} />
          <span>.mca</span>
          <input type="file" accept=".mca" onChange={handleFileChange} />
        </label>

        <button className="sample-button" type="button" onClick={handleSampleLoad} title="Load bundled sample">
          <Map size={16} />
          <span>sample</span>
        </button>

        <select value={selectedIndex ?? ''} onChange={handleChunkSelect} disabled={!region?.chunks.length}>
          {region?.chunks.length ? (
            region.chunks.map((entry) => (
              <option key={entry.index} value={entry.index}>
                {entry.x}, {entry.z}
              </option>
            ))
          ) : (
            <option value="">chunk</option>
          )}
        </select>

        <div className="status-line">{status}</div>
      </section>

      {chunk && (
        <div className="layer-control">
          <div className="layer-slider-slot">
            <input
              type="range"
              min={chunk.minY}
              max={chunk.maxY}
              value={layerMax}
              onChange={(event) => setLayerMax(Number(event.target.value))}
              aria-label="visible layer"
            />
          </div>
          <div className="layer-value">Y {layerMax}</div>
        </div>
      )}

      <aside className="stats-panel">
        <div>
          <span>Chunks Loaded</span>
          <strong>{chunk ? 1 : 0}</strong>
        </div>
        <div>
          <span>Blocks Rendered</span>
          <strong>{chunkMesh?.blockCount ?? 0}</strong>
        </div>
        <div>
          <span>Faces Rendered</span>
          <strong>{chunkMesh?.faceCount ?? 0}</strong>
        </div>
      </aside>

      {!chunk && (
        <div className="empty-state">
          <div className="empty-mark">16</div>
          <div>Load region .mca</div>
        </div>
      )}

      {error && <div className="error-banner">{error}</div>}
    </main>
  );
}

function getBlockTooltip({object, x, y}) {
  const blockName = escapeHtml(object.name.replace('minecraft:', '').replaceAll('_', ' '));

  return {
    className: 'deck-tooltip block-tooltip',
    html: `
      <div class="block-tooltip__name">${blockName}</div>
      <div class="block-tooltip__coords">
        <span>x ${object.x}</span>
        <span>y ${object.y}</span>
        <span>z ${object.z}</span>
      </div>
    `,
    style: {
      transform: `translate(${x + 16}px, ${Math.max(12, y - 44)}px)`
    }
  };
}

function findFirstRenderableChunk(region) {
  let fallback = null;

  for (const entry of region.chunks) {
    try {
      const parsed = parseChunk(region, entry);

      if (!fallback) {
        fallback = {entry, parsed};
      }

      if (parsed.blocks.length > 0) {
        return {entry, parsed};
      }
    } catch {
      // Keep scanning: one corrupt/proto chunk should not prevent opening the region.
    }
  }

  return fallback;
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      case "'":
        return '&#039;';
      default:
        return char;
    }
  });
}
