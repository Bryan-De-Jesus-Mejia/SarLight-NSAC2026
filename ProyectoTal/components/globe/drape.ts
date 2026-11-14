import {
  BufferGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Mesh,
  MeshBasicMaterial,
  SRGBColorSpace,
  TextureLoader,
  type Texture,
} from "three";

/**
 * A radar image laid on the planet at its real position: a small curved patch
 * whose corners are the corners of the analysed area. The case panel decides
 * which image it shows (after, difference, flagged pixels or a time-lapse frame).
 */

const GLOBE_RADIUS = 100;
/** Just above the map tiles and their overlays, below the border lines. */
const PATCH_RADIUS = GLOBE_RADIUS * 1.00055;
const SEGMENTS = 24;
const rad = Math.PI / 180;

export interface Drape {
  mesh: Mesh;
  show: (image: { url: string; opacity: number } | null) => void;
  dispose: () => void;
}

const loader = new TextureLoader();

function xyz(lng: number, lat: number, out: number[]): void {
  const phi = (90 - lat) * rad;
  const theta = (90 - lng) * rad;
  const sin = Math.sin(phi);
  out.push(
    PATCH_RADIUS * sin * Math.cos(theta),
    PATCH_RADIUS * Math.cos(phi),
    PATCH_RADIUS * sin * Math.sin(theta),
  );
}

/** @param corners [lon, lat] of the image corners: top-left, top-right, bottom-right, bottom-left. */
export function createDrape(corners: Array<[number, number]>): Drape {
  const [tl, tr, br, bl] = corners;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let j = 0; j <= SEGMENTS; j += 1) {
    const v = j / SEGMENTS;
    for (let i = 0; i <= SEGMENTS; i += 1) {
      const u = i / SEGMENTS;
      // Bilinear between the four corners: exact enough for areas a few tens of km wide.
      const topLng = tl[0] + (tr[0] - tl[0]) * u;
      const topLat = tl[1] + (tr[1] - tl[1]) * u;
      const botLng = bl[0] + (br[0] - bl[0]) * u;
      const botLat = bl[1] + (br[1] - bl[1]) * u;
      xyz(topLng + (botLng - topLng) * v, topLat + (botLat - topLat) * v, positions);
      uvs.push(u, 1 - v);
    }
  }
  const row = SEGMENTS + 1;
  for (let j = 0; j < SEGMENTS; j += 1) {
    for (let i = 0; i < SEGMENTS; i += 1) {
      const a = j * row + i;
      indices.push(a, a + row, a + 1, a + 1, a + row, a + row + 1);
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);

  const material = new MeshBasicMaterial({
    transparent: true,
    opacity: 0,
    side: DoubleSide,
    depthWrite: false,
    toneMapped: false,
  });
  const mesh = new Mesh(geometry, material);
  mesh.visible = false;
  mesh.renderOrder = 4;
  // Picking is done with maths elsewhere: the patch must never swallow a click.
  mesh.raycast = () => {};

  const textures = new Map<string, Texture>();
  let wanted: string | null = null;

  const show: Drape["show"] = (image) => {
    wanted = image?.url ?? null;
    if (!image) {
      mesh.visible = false;
      return;
    }
    const { url, opacity } = image;
    const apply = (texture: Texture) => {
      if (wanted !== url) return; // a newer image was asked for meanwhile
      material.map = texture;
      material.opacity = opacity;
      material.needsUpdate = true;
      mesh.visible = true;
    };
    const cached = textures.get(url);
    if (cached) {
      apply(cached);
      return;
    }
    loader.load(url, (texture) => {
      texture.colorSpace = SRGBColorSpace;
      texture.anisotropy = 8;
      textures.set(url, texture);
      apply(texture);
    });
  };

  return {
    mesh,
    show,
    dispose: () => {
      wanted = null;
      geometry.dispose();
      material.dispose();
      for (const texture of textures.values()) texture.dispose();
      textures.clear();
    },
  };
}
