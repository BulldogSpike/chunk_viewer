import {Layer, project32, phongMaterial} from '@deck.gl/core';
import {Geometry, Model} from '@luma.gl/engine';
import {createTextureAtlasData} from './textureAtlas.js';

const vs = `#version 300 es
#define SHADER_NAME chunk-mesh-layer-vs

in vec3 positions;
in vec3 normals;
in vec2 texCoords;

out vec2 vTexCoord;
out vec3 cameraPosition;
out vec3 normals_commonspace;
out vec4 position_commonspace;

void main(void) {
  geometry.worldPosition = positions;
  geometry.uv = texCoords;

  vTexCoord = texCoords;
  cameraPosition = project.cameraPosition;
  normals_commonspace = project_normal(normals);

  gl_Position = project_position_to_clipspace(positions, vec3(0.0), vec3(0.0), position_commonspace);
  geometry.position = position_commonspace;
  geometry.normal = normals_commonspace;

  DECKGL_FILTER_GL_POSITION(gl_Position, geometry);
}
`;

const fs = `#version 300 es
#define SHADER_NAME chunk-mesh-layer-fs

precision highp float;

uniform sampler2D atlas;

in vec2 vTexCoord;
in vec3 cameraPosition;
in vec3 normals_commonspace;
in vec4 position_commonspace;

out vec4 fragColor;

void main(void) {
  geometry.uv = vTexCoord;

  vec4 color = texture(atlas, vTexCoord);
  if (color.a < 0.08) {
    discard;
  }

  vec3 normal = normalize(normals_commonspace);
  vec3 lightColor = lighting_getLightColor(color.rgb, cameraPosition, position_commonspace.xyz, normal);
  fragColor = vec4(lightColor, color.a * layer.opacity);

  DECKGL_FILTER_COLOR(fragColor, geometry);
}
`;

const voxelTexture = {
  name: 'voxelTexture'
};

const defaultProps = {
  mesh: {type: 'object', value: null, compare: true},
  material: true,
  opacity: {type: 'number', value: 1, min: 0, max: 1}
};

export default class ChunkMeshLayer extends Layer {
  getShaders() {
    return super.getShaders({
      vs,
      fs,
      modules: [project32, phongMaterial, voxelTexture]
    });
  }

  initializeState() {
    const atlas = createTextureAtlasData();
    const texture = this.context.device.createTexture({
      id: `${this.props.id}-atlas`,
      data: atlas.data,
      width: atlas.width,
      height: atlas.height,
      format: 'rgba8unorm',
      mipLevels: 1,
      sampler: {
        minFilter: 'nearest',
        magFilter: 'nearest',
        mipmapFilter: 'none',
        addressModeU: 'clamp-to-edge',
        addressModeV: 'clamp-to-edge'
      }
    });

    this.setState({texture});
  }

  updateState({props, oldProps, changeFlags}) {
    super.updateState({props, oldProps, changeFlags});

    if (props.mesh !== oldProps.mesh || changeFlags.extensionsChanged) {
      this.state.model?.destroy();
      this.state.model = props.mesh?.vertexCount ? this.getModel(props.mesh) : null;
    }
  }

  finalizeState(context) {
    super.finalizeState(context);
    this.state.model?.destroy();
    this.state.texture?.delete();
  }

  draw() {
    const {model} = this.state;

    if (!model) {
      return;
    }

    const {renderPass} = this.context;
    model.draw(renderPass);
  }

  getModel(mesh) {
    const model = new Model(this.context.device, {
      ...this.getShaders(),
      id: this.props.id,
      geometry: new Geometry({
        topology: 'triangle-list',
        vertexCount: mesh.vertexCount,
        attributes: {
          positions: {size: 3, value: mesh.positions},
          normals: {size: 3, value: mesh.normals},
          texCoords: {size: 2, value: mesh.texCoords}
        }
      }),
      isInstanced: false,
      parameters: {
        depthTest: true
      }
    });

    model.shaderInputs.setProps({
      voxelTexture: {
        atlas: this.state.texture
      }
    });

    return model;
  }
}

ChunkMeshLayer.defaultProps = defaultProps;
ChunkMeshLayer.layerName = 'ChunkMeshLayer';
