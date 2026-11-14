import ThreeSlippyMapGlobe from "three-slippy-map-globe";
import { MeshBasicMaterial, Vector3, type Camera, type Mesh, type Object3D, type Scene, type SphereGeometry } from "three";
import { OVERLAYS, type OverlayKind } from "@/lib/imagery";

/**
 * A second map-tile layer drawn just above the globe's own tile engine, used
 * for the radar / water overlays (the library draws one tile source only).
 * Tiles are transparent where the satellite did not pass, so what lies below
 * shows through.
 */

const GLOBE_RADIUS = 100;
const OVERLAY_RADIUS = GLOBE_RADIUS * 1.0003;

export type Engine = InstanceType<typeof ThreeSlippyMapGlobe>;

export function findBaseEngine(scene: Scene): Engine | null {
  let found: Engine | null = null;
  scene.traverse((object: Object3D) => {
    if (!found && "tileUrl" in object && "thresholds" in object) found = object as Engine;
  });
  return found;
}

/**
 * Values the overlay shader reads. They are plain objects shared by every tile
 * of an engine, so changing `.value` updates the whole layer without rebuilding
 * anything.
 */
export interface OverlayUniforms {
  /** Screen x (in drawing-buffer pixels) where the curtain splits the picture. */
  splitX: { value: number };
  /** 0: draw everywhere. -1: only left of the split. 1: only right of it. */
  side: { value: number };
  /** Colour class to keep vivid (-1 for all): 0 blue, 1 green, 2 orange-yellow, 3 red. */
  klass: { value: number };
  /** Lens circle in drawing-buffer pixels: centre x, centre y (from the bottom), radius. */
  lens: { value: Vector3 };
  /** 0: no lens. 1: draw only inside the circle. */
  lensMode: { value: number };
}

export function createOverlayUniforms(klass: { value: number }): OverlayUniforms {
  return { splitX: { value: 0 }, side: { value: 0 }, klass, lens: { value: new Vector3(0, 0, 0) }, lensMode: { value: 0 } };
}

// Hue bands of the NISAR false-colour layer (see components/LayersPanel).
const FRAGMENT_MASK = `
  vec4 sampledDiffuseColor = texture2D( map, vMapUv );
  if ( ( uSide < -0.5 && gl_FragCoord.x > uSplitX ) || ( uSide > 0.5 && gl_FragCoord.x < uSplitX ) ) discard;
  if ( uLensMode > 0.5 && distance( gl_FragCoord.xy, uLens.xy ) > uLens.z ) discard;
  vec3 tint = sampledDiffuseColor.rgb;
  float peak = max( tint.r, max( tint.g, tint.b ) );
  float alphaMask = step( 0.002, peak );
  if ( uClass > -0.5 ) {
    vec3 c = pow( tint, vec3( 0.4545 ) );
    float mx = max( c.r, max( c.g, c.b ) );
    float d = mx - min( c.r, min( c.g, c.b ) );
    float h = 0.0;
    if ( d > 0.00001 ) {
      if ( mx == c.r ) h = mod( ( c.g - c.b ) / d, 6.0 );
      else if ( mx == c.g ) h = ( c.b - c.r ) / d + 2.0;
      else h = ( c.r - c.g ) / d + 4.0;
    }
    h *= 60.0;
    if ( h < 0.0 ) h += 360.0;
    float k = 2.0;
    if ( h >= 345.0 || h < 15.0 ) k = 3.0;
    else if ( h < 70.0 ) k = 2.0;
    else if ( h < 170.0 ) k = 1.0;
    else k = 0.0;
    float on = 1.0 - abs( sign( k - uClass ) );
    alphaMask *= mix( 0.1, 1.0, on );
    tint *= mix( 0.6, 1.2, on );
  }
  diffuseColor.rgb *= tint;
  diffuseColor.a *= alphaMask;
`;

export function createOverlayEngine(parent: Object3D, uniforms: OverlayUniforms, renderOrder = 2): Engine {
  const engine = new ThreeSlippyMapGlobe(OVERLAY_RADIUS, { minLevel: 0, maxLevel: 13 });
  engine.visible = false;

  // Tiles arrive one by one: make each transparent, unlit and drawn over the ground.
  const add = engine.add.bind(engine);
  engine.add = (...objects: Object3D[]) => {
    for (const object of objects) {
      const tile = object as Mesh;
      const old = tile.material as MeshBasicMaterial | undefined;
      if (old && "map" in old) {
        const material = new MeshBasicMaterial({
          map: old.map,
          transparent: true,
          depthWrite: false,
          polygonOffset: true,
          polygonOffsetFactor: -2,
          polygonOffsetUnits: -2,
        });
        // GIBS marks no-data with black pixels and an unreliable alpha channel
        // (parts of the land come out transparent): trust the colour instead.
        material.onBeforeCompile = (shader) => {
          shader.uniforms.uSplitX = uniforms.splitX;
          shader.uniforms.uSide = uniforms.side;
          shader.uniforms.uClass = uniforms.klass;
          shader.uniforms.uLens = uniforms.lens;
          shader.uniforms.uLensMode = uniforms.lensMode;
          shader.fragmentShader = shader.fragmentShader
            .replace("#include <common>", "#include <common>\nuniform float uSplitX;\nuniform float uSide;\nuniform float uClass;\nuniform vec3 uLens;\nuniform float uLensMode;")
            .replace("#include <map_fragment>", FRAGMENT_MASK);
        };
        material.customProgramCacheKey = () => "ge-overlay-v3";
        tile.material = material;
        old.dispose();
        tile.renderOrder = renderOrder;
      }
    }
    return add(...objects);
  };

  parent.add(engine);
  return engine;
}

export function applyOverlay(engine: Engine, kind: OverlayKind, date: string): void {
  if (kind === "none") {
    engine.visible = false;
    engine.clearTiles();
    return;
  }
  const info = OVERLAYS[kind];
  engine.maxLevel = info.maxLevel;
  engine.clearTiles();
  engine.tileUrl = info.url(date);
  engine.visible = true;
}

/** Take an object (and everything added to it later) out of pointer raycasting. */
export function ignoreRaycast(root: Object3D): void {
  const none = () => {};
  root.traverse((object) => {
    object.raycast = none;
  });
  const add = root.add.bind(root);
  root.add = (...objects: Object3D[]) => {
    for (const object of objects) {
      object.traverse((child) => {
        child.raycast = none;
      });
    }
    return add(...objects);
  };
}

/* -------------------------------------------------------------------------- */
/* Keeping the tile layers cheap                                              */
/* -------------------------------------------------------------------------- */

/** Zoom level of a tile mesh, read back from the angular width of its geometry. */
function tileLevel(mesh: Mesh): number | null {
  if (!(mesh.material as MeshBasicMaterial | undefined)?.map) return null; // not a tile
  const params = (mesh.geometry as SphereGeometry | undefined)?.parameters;
  if (!params?.phiLength) return null;
  return Math.round(Math.log2((Math.PI * 2) / params.phiLength));
}

const thinState = new WeakMap<Engine, { level: number; count: number; stable: number }>();

/**
 * The tile engine keeps every zoom level it has passed through on screen, one
 * under the other: close to the ground each pixel is painted ten times over.
 * Once the current level has stopped loading, hide the levels buried beneath
 * it (the coarse global ones and the direct parent stay, as a safety net).
 * Any change of level shows everything again first, so nothing ever pops out.
 * Call it on a slow timer.
 */
export function thinTiles(engine: Engine): void {
  if (!engine.visible) return;
  const level = engine.level;
  if (level === undefined) return;
  const count = engine.children.length;
  let state = thinState.get(engine);
  if (!state) {
    state = { level: -1, count: -1, stable: 0 };
    thinState.set(engine, state);
  }

  if (state.level !== level) {
    for (const child of engine.children) {
      if (!child.visible && tileLevel(child as Mesh) !== null) child.visible = true;
    }
    state.level = level;
    state.count = count;
    state.stable = 0;
    return;
  }
  if (state.count !== count) {
    state.count = count;
    state.stable = 0;
    return;
  }
  state.stable += 1;
  if (state.stable !== 3) return; // settled for three ticks: thin once

  for (const child of engine.children) {
    const l = tileLevel(child as Mesh);
    if (l === null) continue;
    const keep = l <= 2 || l >= level - 1;
    if (child.visible !== keep) child.visible = keep;
  }
}

/**
 * During a camera flight the engine would fetch (and upload to the GPU) the
 * tiles of every level it passes. Cap the level while flying; the returned
 * function lifts the cap and loads the level the camera ended on.
 */
export function capLevels(engines: Array<Engine | null>, camera: Camera, floor = 5): () => void {
  const saved: Array<[Engine, number, number]> = [];
  for (const engine of engines) {
    if (!engine) continue;
    const cap = Math.max(engine.level ?? 0, floor);
    if (engine.maxLevel <= cap) continue;
    saved.push([engine, engine.maxLevel, cap]);
    engine.maxLevel = cap;
  }
  return () => {
    for (const [engine, max, cap] of saved) {
      if (engine.maxLevel === cap) engine.maxLevel = max;
      if (engine.visible) engine.updatePov(camera);
    }
  };
}
