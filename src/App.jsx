import React, {useCallback, useMemo, useState} from 'react';
import DeckGL from '@deck.gl/react';
import {COORDINATE_SYSTEM, LightingEffect, AmbientLight, DirectionalLight, OrbitView} from '@deck.gl/core';
import {SimpleMeshLayer} from '@deck.gl/mesh-layers';
import {CubeGeometry} from '@luma.gl/engine';
import {Info, Map, Upload} from 'lucide-react';
import {parseChunk, readRegionFile} from './mcaParser.js';

const cube = new CubeGeometry();
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

  const loadChunk = useCallback((nextRegion, entry) => {
    setStatus('Чтение чанка');
    setError('');

    try {
      const parsed = parseChunk(nextRegion, entry);
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
    } catch (chunkError) {
      setChunk(null);
      setError(chunkError.message);
      setStatus('Ошибка чтения');
    }
  }, []);

  const loadRegionBuffer = useCallback(
    (buffer, fileName) => {
      const nextRegion = readRegionFile(buffer, fileName);
      setRegion(nextRegion);

      if (!nextRegion.chunks.length) {
        setStatus(fileName);
        setError('В region-файле не найдено ни одного чанка');
        return;
      }

      loadChunk(nextRegion, nextRegion.chunks[0]);
    },
    [loadChunk]
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

  const renderedBlocks = useMemo(() => {
    if (!chunk) {
      return [];
    }

    return buildRenderableSurface(chunk.blocks, layerMax);
  }, [chunk, layerMax]);

  const layers = useMemo(() => {
    if (!chunk) {
      return [];
    }

    return [
      new SimpleMeshLayer({
        id: 'minecraft-voxel-layer',
        data: renderedBlocks,
        mesh: cube,
        coordinateSystem: COORDINATE_SYSTEM.CARTESIAN,
        getPosition: (block) => [block.x - 7.5, block.z - 7.5, block.y],
        getColor: (block) => block.color,
        getScale: [1, 1, 1],
        material: {
          ambient: 0.55,
          diffuse: 0.65,
          shininess: 16,
          specularColor: [20, 20, 20]
        },
        pickable: true,
        opacity: 1,
        parameters: {
          depthTest: true
        },
        updateTriggers: {
          getPosition: [chunk.index],
          getColor: [chunk.index]
        }
      })
    ];
  }, [chunk, renderedBlocks]);

  return (
    <main className="app-shell">
      <DeckGL
        views={new OrbitView({orbitAxis: 'Z', fovy: 42})}
        viewState={viewState}
        controller={{scrollZoom: true, dragRotate: true, doubleClickZoom: true}}
        onViewStateChange={({viewState: nextViewState}) => setViewState(nextViewState)}
        layers={layers}
        effects={[lightingEffect]}
        getTooltip={({object}) =>
          object ? `${object.name.replace('minecraft:', '')}  x:${object.x} y:${object.y} z:${object.z}` : null
        }
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
          <strong>{renderedBlocks.length}</strong>
        </div>
      </aside>

      <button className="info-button" type="button" title={chunk?.status ?? 'Chunk viewer'}>
        <Info size={18} />
      </button>

      <MiniMap chunks={region?.chunks ?? []} selectedIndex={selectedIndex} />

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

function buildRenderableSurface(blocks, layerMax) {
  const clipped = blocks.filter((block) => block.y <= layerMax);
  const occupied = new Set(clipped.map(blockKey));
  const visible = [];

  for (const block of clipped) {
    const hasOpenFace =
      !occupied.has(`${block.x + 1},${block.y},${block.z}`) ||
      !occupied.has(`${block.x - 1},${block.y},${block.z}`) ||
      !occupied.has(`${block.x},${block.y + 1},${block.z}`) ||
      !occupied.has(`${block.x},${block.y - 1},${block.z}`) ||
      !occupied.has(`${block.x},${block.y},${block.z + 1}`) ||
      !occupied.has(`${block.x},${block.y},${block.z - 1}`);

    if (hasOpenFace) {
      visible.push(block);
    }
  }

  return visible;
}

function blockKey(block) {
  return `${block.x},${block.y},${block.z}`;
}

function MiniMap({chunks, selectedIndex}) {
  const selected = chunks.find((chunk) => chunk.index === selectedIndex);
  const loadedIndexes = useMemo(() => new Set(chunks.map((chunk) => chunk.index)), [chunks]);

  return (
    <div className="mini-map" aria-label="region minimap">
      <div className="mini-grid">
        {Array.from({length: 1024}, (_, index) => {
          const exists = loadedIndexes.has(index);
          const isSelected = selected?.index === index;
          return <span key={index} className={`${exists ? 'loaded' : ''} ${isSelected ? 'selected' : ''}`} />;
        })}
      </div>
    </div>
  );
}
