import {
  BufferGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Mesh,
  ShaderMaterial,
} from "three";

/**
 * "The satellite's dance": every real NISAR scene of one 12-day cycle, drawn
 * on the planet in the order it was acquired. All scenes live in one mesh; a
 * single number (the clock) decides which are visible and which still glow.
 */

const GLOBE_RADIUS = 100;
const PASS_RADIUS = GLOBE_RADIUS * 1.0011;
/** Each footprint is split into SPLIT×SPLIT cells so it follows the curve of the planet. */
const SPLIT = 2;
const rad = Math.PI / 180;

export interface PassCycle {
  start: string;
  end: string;
  days: number;
  count: number;
  /** [minutes from start, lon1, lat1, lon2, lat2, lon3, lat3, lon4, lat4, ascending] */
  scenes: number[][];
}

/** The clock: 0 at the start of the cycle, 1 at its end. Shared with the shader. */
export const PASS_CLOCK = { value: 0 };

let pending: Promise<PassCycle | null> | null = null;

export function loadPassCycle(): Promise<PassCycle | null> {
  pending ??= fetch("/geo/nisar-cycle.json")
    .then((r) => (r.ok ? (r.json() as Promise<PassCycle>) : null))
    .catch(() => {
      pending = null;
      return null;
    });
  return pending;
}

function push(out: number[], lng: number, lat: number): void {
  const phi = (90 - lat) * rad;
  const theta = (90 - lng) * rad;
  const sin = Math.sin(phi);
  out.push(PASS_RADIUS * sin * Math.cos(theta), PASS_RADIUS * Math.cos(phi), PASS_RADIUS * sin * Math.sin(theta));
}

/** Longitude brought next to a reference one, so a scene across the date line stays in one piece. */
const near = (lng: number, ref: number): number => (lng - ref > 180 ? lng - 360 : lng - ref < -180 ? lng + 360 : lng);

export interface PassLayer {
  mesh: Mesh;
  dispose: () => void;
}

export function createPassLayer(cycle: PassCycle): PassLayer {
  const total = cycle.days * 24 * 60;
  const positions: number[] = [];
  const times: number[] = [];
  const kinds: number[] = [];

  for (const s of cycle.scenes) {
    const t = s[0] / total;
    const x0 = s[1];
    const c = [
      [x0, s[2]],
      [near(s[3], x0), s[4]],
      [near(s[5], x0), s[6]],
      [near(s[7], x0), s[8]],
    ];
    const at = (u: number, v: number): [number, number] => {
      // Bilinear between the corners (given in order around the footprint).
      const ax = c[0][0] + (c[1][0] - c[0][0]) * u;
      const ay = c[0][1] + (c[1][1] - c[0][1]) * u;
      const bx = c[3][0] + (c[2][0] - c[3][0]) * u;
      const by = c[3][1] + (c[2][1] - c[3][1]) * u;
      return [ax + (bx - ax) * v, ay + (by - ay) * v];
    };
    for (let j = 0; j < SPLIT; j += 1) {
      for (let i = 0; i < SPLIT; i += 1) {
        const [u0, u1, v0, v1] = [i / SPLIT, (i + 1) / SPLIT, j / SPLIT, (j + 1) / SPLIT];
        for (const [u, v] of [
          [u0, v0],
          [u0, v1],
          [u1, v0],
          [u1, v0],
          [u0, v1],
          [u1, v1],
        ]) {
          const [lng, lat] = at(u, v);
          push(positions, lng, lat);
          times.push(t);
          kinds.push(s[9]);
        }
      }
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("aTime", new Float32BufferAttribute(times, 1));
  geometry.setAttribute("aAsc", new Float32BufferAttribute(kinds, 1));

  const material = new ShaderMaterial({
    uniforms: { uNow: PASS_CLOCK },
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    vertexShader: `
      attribute float aTime;
      attribute float aAsc;
      varying float vTime;
      varying float vAsc;
      void main() {
        vTime = aTime;
        vAsc = aAsc;
        gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
      }
    `,
    fragmentShader: `
      uniform float uNow;
      varying float vTime;
      varying float vAsc;
      void main() {
        float age = uNow - vTime;
        if ( age < 0.0 ) discard;
        // Fresh scenes glow for about a third of a day, then settle.
        float glow = exp( -age * 36.0 );
        vec3 settled = mix( vec3( 0.36, 0.62, 1.0 ), vec3( 0.95, 0.72, 0.40 ), vAsc );
        vec3 colour = mix( settled, vec3( 1.0, 0.97, 0.9 ), glow );
        gl_FragColor = vec4( colour, 0.17 + 0.7 * glow );
      }
    `,
  });

  const mesh = new Mesh(geometry, material);
  mesh.renderOrder = 3;
  mesh.frustumCulled = false;
  mesh.raycast = () => {};

  return {
    mesh,
    dispose: () => {
      geometry.dispose();
      material.dispose();
    },
  };
}
