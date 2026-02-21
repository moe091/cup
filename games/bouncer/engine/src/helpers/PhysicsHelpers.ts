import planck from 'planck';
import earcut from 'earcut';
import { toWorld } from '@cup/bouncer-shared';

/**
 * Calculate the centroid (center point) of a polygon
 */
export function calculateCentroid(vertices: Array<{ x: number; y: number }>): { x: number; y: number } {
  let sumX = 0;
  let sumY = 0;

  vertices.forEach((v) => {
    sumX += v.x;
    sumY += v.y;
  });

  return {
    x: sumX / vertices.length,
    y: sumY / vertices.length,
  };
}

/**
 * Convert vertices to be relative to a centroid point
 */
export function verticesToLocalCoords(
  vertices: Array<{ x: number; y: number }>,
  centroid: { x: number; y: number },
): Array<{ x: number; y: number }> {
  return vertices.map((v) => ({
    x: v.x - centroid.x,
    y: v.y - centroid.y,
  }));
}

/**
 * Triangulate a polygon into triangles using earcut
 * Returns an array of triangle vertex indices (groups of 3)
 */
export function triangulatePolygon(vertices: Array<{ x: number; y: number }>): number[] {
  // Earcut expects a flat array: [x1, y1, x2, y2, ...]
  const flatCoords: number[] = [];
  vertices.forEach((v) => {
    flatCoords.push(v.x, v.y);
  });

  // Earcut returns indices into the vertex array, in groups of 3 (triangles)
  const triangleIndices = earcut(flatCoords);

  return triangleIndices;
}

/**
 * Create a static polygon body in the physics world
 * Automatically triangulates and creates fixtures for each triangle
 */
export function createPolygonBody(
  world: planck.World,
  vertices: Array<{ x: number; y: number }>,
  name: string,
  friction: number = 0.8,
  restitution: number = 0,
): planck.Body {
  // 1. Calculate centroid in pixel coordinates
  const centroid = calculateCentroid(vertices);

  // 2. Convert centroid to world coordinates
  const worldCentroid = new planck.Vec2(toWorld(centroid.x), toWorld(centroid.y));

  // 3. Create body at centroid
  const body = world.createBody({
    type: 'static',
    position: worldCentroid,
  });
  body.setUserData(name);

  // 4. Make vertices relative to centroid
  const localVertices = verticesToLocalCoords(vertices, centroid);

  // 5. Triangulate the polygon
  const triangleIndices = triangulatePolygon(localVertices);

  // 6. Create a fixture for each triangle
  for (let i = 0; i < triangleIndices.length; i += 3) {
    const i1 = triangleIndices[i];
    const i2 = triangleIndices[i + 1];
    const i3 = triangleIndices[i + 2];

    const v1 = localVertices[i1];
    const v2 = localVertices[i2];
    const v3 = localVertices[i3];

    // Convert to world units and create planck Vec2s
    const planckVerts = [
      new planck.Vec2(toWorld(v1.x), toWorld(v1.y)),
      new planck.Vec2(toWorld(v2.x), toWorld(v2.y)),
      new planck.Vec2(toWorld(v3.x), toWorld(v3.y)),
    ];

    // Create polygon fixture (triangle)
    const triangleShape = new planck.Polygon(planckVerts);
    body.createFixture(triangleShape, { friction, restitution });
  }

  return body;
}
