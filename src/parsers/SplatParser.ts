// src/parsers/SplatParser.ts
import { SplatData, SplatPoint } from '../types/SplatTypes';

export async function parseSplatFile(
  buffer: ArrayBuffer,
  fileName: string,
  fileSize: number
): Promise<SplatData> {
  const CHUNK_SIZE = 1024 * 1024; // 1MB chunks
  const SPLAT_SIZE = 32; // bytes per splat
  const dataView = new DataView(buffer);
  const splatCount = Math.floor(buffer.byteLength / SPLAT_SIZE);

  if (splatCount === 0) {
    throw new Error('Invalid SPLAT file: No splats found');
  }

  const points: SplatPoint[] = [];
  const splatsPerChunk = Math.floor(CHUNK_SIZE / SPLAT_SIZE);

  // Process splats in chunks
  for (let i = 0; i < splatCount; i += splatsPerChunk) {
    const chunkEnd = Math.min(i + splatsPerChunk, splatCount);
    const chunkOffset = i * SPLAT_SIZE;
    
    try {
      for (let j = 0; j < chunkEnd - i; j++) {
        const offset = chunkOffset + j * SPLAT_SIZE;

        // Read position (3 floats)
        const x = dataView.getFloat32(offset, true);
        const y = dataView.getFloat32(offset + 4, true);
        const z = dataView.getFloat32(offset + 8, true);

        // Skip invalid positions
        if (!isFinite(x) || !isFinite(y) || !isFinite(z)) {
          continue;
        }

        // Read scale (3 floats)
        const sx = dataView.getFloat32(offset + 12, true);
        const sy = dataView.getFloat32(offset + 16, true);
        const sz = dataView.getFloat32(offset + 20, true);

        // Skip invalid scales
        if (!isFinite(sx) || !isFinite(sy) || !isFinite(sz) ||
            sx <= 0 || sy <= 0 || sz <= 0) {
          continue;
        }

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

        // Skip invalid rotations
        if (!isFinite(qx) || !isFinite(qy) || !isFinite(qz) || !isFinite(qw)) {
          continue;
        }

        const point: SplatPoint = {
          position: [x, y, z],
          color: [r, g, b],
          scale: [Math.abs(sx), Math.abs(sy), Math.abs(sz)],
          rotation: [qx, qy, qz, qw],
          opacity: a / 255.0
        };

        points.push(point);
      }
    } catch (error) {
      console.warn(`Error processing chunk at offset ${chunkOffset}:`, error);
      continue;
    }

    // Allow GC to clean up between chunks
    if (i % (splatsPerChunk * 10) === 0) {
      await new Promise(resolve => setTimeout(resolve, 0));
      if (global.gc) {
        global.gc();
      }
    }
  }

  if (points.length === 0) {
    throw new Error('No valid splats found in file');
  }

  // Calculate bounds incrementally
  const bounds = calculateBoundsIncremental(points);

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

function calculateBoundsIncremental(points: SplatPoint[]) {
  const min: [number, number, number] = [Infinity, Infinity, Infinity];
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];

  // Process points in chunks to avoid blocking the main thread
  const CHUNK_SIZE = 10000;
  for (let i = 0; i < points.length; i += CHUNK_SIZE) {
    const end = Math.min(i + CHUNK_SIZE, points.length);
    for (let j = i; j < end; j++) {
      const point = points[j];
      for (let k = 0; k < 3; k++) {
        min[k] = Math.min(min[k], point.position[k]);
        max[k] = Math.max(max[k], point.position[k]);
      }
    }
  }

  return { min, max };
}