import ThreeSlippyMapGlobe from "three-slippy-map-globe";
import { MeshBasicMaterial, type Mesh, type Object3D, type Scene } from "three";
import { OVERLAYS, type OverlayKind } from "@/lib/imagery";

/**
 * A second map-tile layer drawn just above the globe's own tile engine, used
 * for the radar / water overlays (the library draws one tile source only).
 * Tiles are transparent where the satellite did not pass, so what lies below
 * shows through.
 */

const GLOBE_RADIUS = 100;
const OVERLAY_RADIUS = GLOBE_RADIUS * 1.0003;

type Engine = InstanceType<typeof ThreeSlippyMapGlobe>;

export function findBaseEngine(scene: Scene): Engine | null {
  let found: Engine | null = null;
  scene.traverse((object: Object3D) => {
    if (!found && "tileUrl" in object && "thresholds" in object) found = object as Engine;
  });
  return found;
}

export function createOverlayEngine(parent: Object3D): Engine {
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
          shader.fragmentShader = shader.fragmentShader.replace(
            "#include <map_fragment>",
            `vec4 sampledDiffuseColor = texture2D( map, vMapUv );
             diffuseColor.rgb *= sampledDiffuseColor.rgb;
             diffuseColor.a *= step( 0.002, max( sampledDiffuseColor.r, max( sampledDiffuseColor.g, sampledDiffuseColor.b ) ) );`,
          );
        };
        material.customProgramCacheKey = () => "ge-overlay-mask";
        tile.material = material;
        old.dispose();
        tile.renderOrder = 2;
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
