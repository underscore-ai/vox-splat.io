// src/parsers/SplatParser.ts
import { SplatData, SplatPoint } from '../types/SplatTypes';

export async function parseSplatFile(
  buffer: ArrayBuffer,
  fileName: string,
  fileSize: number
): Promise<SplatData> {
  // SPLAT format specification:
  // Each splat is 32 bytes (8 floats):
  // - Position: x, y, z (3 floats)
  // - Scale: sx, sy, sz (3 floats) 
  // - Color: r, g, b, a (4 bytes packed as 1 float)
  // - Rotation: quaternion packed as 1 float

  const dataView = new DataView(buffer);
  const splatSize = 32; // bytes per splat
  const splatCount = Math.floor(buffer.byteLength / splatSize);

  if (splatCount === 0) {
    throw new Error('Invalid SPLAT file: No splats found');
  }

  const points: SplatPoint[] = [];

  for (let i = 0; i < splatCount; i++) {
    const offset = i * splatSize;

    try {
      // Read position (3 floats)
      const x = dataView.getFloat32(offset, true);
      const y = dataView.getFloat32(offset + 4, true);
      const z = dataView.getFloat32(offset + 8, true);

      // Read scale (3 floats)
      const sx = dataView.getFloat32(offset + 12, true);
      const sy = dataView.getFloat32(offset + 16, true);
      const sz = dataView.getFloat32(offset + 20, true);

      // Read packed color (1 float containing 4 bytes)
      const colorPacked = dataView.getUint32(offset + 24, true);
      const r = (colorPacked >>> 0) & 0xFF;
      const g = (colorPacked >>> 8) & 0xFF;
      const b = (colorPacked >>> 16) & 0xFF;
      const a = (colorPacked >>> 24) & 0xFF;

      // Read packed rotation quaternion (1 float)
      const rotationPacked = dataView.getUint32(offset + 28, true);
      const qx = ((rotationPacked >>> 0) & 0xFF) / 128.0 - 1.0;
      const qy = ((rotationPacked >>> 8) & 0xFF) / 128.0 - 1.0;
      const qz = ((rotationPacked >>> 16) & 0xFF) / 128.0 - 1.0;
      const qw = ((rotationPacked >>> 24) & 0xFF) / 128.0 - 1.0;

      // Validate the data
      if (!isFinite(x) || !isFinite(y) || !isFinite(z)) {
        continue; // Skip invalid positions
      }

      const point: SplatPoint = {
        position: [x, y, z],
        color: [r, g, b],
        scale: [Math.abs(sx), Math.abs(sy), Math.abs(sz)],
        rotation: [qx, qy, qz, qw],
        opacity: a / 255.0
      };

      points.push(point);
    } catch (error) {
      // Skip corrupted splats
      console.warn(`Skipping corrupted splat at index ${i}:`, error);
      continue;
    }
  }

  if (points.length === 0) {
    throw new Error('No valid splats found in file');
  }

  // Calculate bounds
  const bounds = calculateBounds(points);

  return {
    points,
    bounds,
    metadata: {
      format: 'splat',
      vertexCount: points.length,
      hasNormals: false,
      hasColors: true,
      fileSize,
      fileName
    }
  };
}

function calculateBounds(points: SplatPoint[]) {
  const min: [number, number, number] = [Infinity, Infinity, Infinity];
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];

  for (const point of points) {
    for (let i = 0; i < 3; i++) {
      min[i] = Math.min(min[i], point.position[i]);
      max[i] = Math.max(max[i], point.position[i]);
    }
  }

  return { min, max };
}