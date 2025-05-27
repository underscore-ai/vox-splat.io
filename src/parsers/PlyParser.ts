// src/parsers/PlyParser.ts
import { SplatData, SplatPoint } from '../types/SplatTypes';

interface PlyHeader {
  format: 'ascii' | 'binary_little_endian' | 'binary_big_endian';
  vertexCount: number;
  properties: Array<{
    name: string;
    type: string;
  }>;
  headerLength: number;
}

export async function parsePlyFile(
  buffer: ArrayBuffer, 
  fileName: string, 
  fileSize: number
): Promise<SplatData> {
  const CHUNK_SIZE = 1024 * 1024; // 1MB chunks
  const uint8Array = new Uint8Array(buffer);
  
  // Only read header portion first
  const headerText = new TextDecoder().decode(uint8Array.slice(0, 8192));
  
  if (!headerText.startsWith('ply')) {
    throw new Error('Invalid PLY file: Missing PLY header');
  }

  const header = parsePlyHeader(headerText);
  const points: SplatPoint[] = [];

  // Process file in chunks to reduce memory usage
  if (header.format === 'ascii') {
    const decoder = new TextDecoder();
    let processedBytes = 0;
    let remainingText = '';

    while (processedBytes < buffer.byteLength) {
      const end = Math.min(processedBytes + CHUNK_SIZE, buffer.byteLength);
      const chunk = uint8Array.slice(processedBytes, end);
      const text = remainingText + decoder.decode(chunk, { stream: true });
      const lines = text.split('\n');
      
      // Keep last partial line for next chunk
      remainingText = lines.pop() || '';
      
      // Skip header in first chunk
      if (processedBytes === 0) {
        const headerEndIndex = lines.findIndex(line => line.trim() === 'end_header');
        lines.splice(0, headerEndIndex + 1);
      }

      points.push(...parseAsciiChunk(lines, header));
      processedBytes = end;
    }
  } else {
    points.push(...parseBinaryChunked(uint8Array, header, CHUNK_SIZE));
  }

  if (points.length === 0) {
    throw new Error('No valid points found in PLY file');
  }

  // Calculate bounds incrementally
  const bounds = calculateBoundsIncremental(points);

  // Clean up temporary arrays
  if (global.gc) {
    global.gc();
  }

  return {
    points,
    bounds,
    metadata: {
      format: 'ply',
      vertexCount: points.length,
      hasNormals: header.properties.some(p => p.name === 'nx'),
      hasColors: header.properties.some(p => p.name === 'red'),
      fileSize,
      fileName
    }
  };
}

function parsePlyHeader(text: string): PlyHeader {
  const lines = text.split('\n');
  let format: 'ascii' | 'binary_little_endian' | 'binary_big_endian' = 'ascii';
  let vertexCount = 0;
  const properties: Array<{ name: string; type: string }> = [];
  let headerLength = 0;
  let inVertexElement = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    headerLength += line.length + 1; // +1 for newline

    if (line.startsWith('format')) {
      const formatMatch = line.match(/format\s+(ascii|binary_little_endian|binary_big_endian)/);
      if (formatMatch) {
        format = formatMatch[1] as typeof format;
      }
    } else if (line.startsWith('element vertex')) {
      const countMatch = line.match(/element\s+vertex\s+(\d+)/);
      if (countMatch) {
        vertexCount = parseInt(countMatch[1]);
        inVertexElement = true;
      }
    } else if (line.startsWith('element') && !line.startsWith('element vertex')) {
      inVertexElement = false;
    } else if (line.startsWith('property') && inVertexElement) {
      const propMatch = line.match(/property\s+(\w+)\s+(\w+)/);
      if (propMatch) {
        properties.push({
          type: propMatch[1],
          name: propMatch[2]
        });
      }
    } else if (line === 'end_header') {
      break;
    }
  }

  return { format, vertexCount, properties, headerLength };
}

function parseAsciiChunk(lines: string[], header: PlyHeader): SplatPoint[] {
  const points: SplatPoint[] = [];
  const posProps = ['x', 'y', 'z'];
  const colorProps = ['red', 'green', 'blue'];
  const normalProps = ['nx', 'ny', 'nz'];

  const posIndices = posProps.map(prop => 
    header.properties.findIndex(p => p.name === prop)
  );
  const colorIndices = colorProps.map(prop => 
    header.properties.findIndex(p => p.name === prop)
  );
  const normalIndices = normalProps.map(prop => 
    header.properties.findIndex(p => p.name === prop)
  );

  for (const line of lines) {
    if (!line.trim()) continue;

    const values = line.split(/\s+/).map(v => parseFloat(v));
    if (values.length < 3) continue;

    const point: SplatPoint = {
      position: [
        posIndices[0] >= 0 ? values[posIndices[0]] : 0,
        posIndices[1] >= 0 ? values[posIndices[1]] : 0,
        posIndices[2] >= 0 ? values[posIndices[2]] : 0
      ],
      color: [
        colorIndices[0] >= 0 ? Math.min(255, Math.max(0, values[colorIndices[0]])) : 128,
        colorIndices[1] >= 0 ? Math.min(255, Math.max(0, values[colorIndices[1]])) : 128,
        colorIndices[2] >= 0 ? Math.min(255, Math.max(0, values[colorIndices[2]])) : 128
      ]
    };

    if (normalIndices.every(idx => idx >= 0)) {
      point.normal = [
        values[normalIndices[0]],
        values[normalIndices[1]],
        values[normalIndices[2]]
      ];
    }

    points.push(point);
  }

  return points;
}

function parseBinaryChunked(uint8Array: Uint8Array, header: PlyHeader, chunkSize: number): SplatPoint[] {
  const points: SplatPoint[] = [];
  const littleEndian = header.format === 'binary_little_endian';
  const bytesPerVertex = calculateBytesPerVertex(header.properties);
  let offset = header.headerLength;

  const posProps = ['x', 'y', 'z'];
  const colorProps = ['red', 'green', 'blue'];
  const normalProps = ['nx', 'ny', 'nz'];

  const posOffsets = posProps.map(prop => calculatePropertyOffset(header.properties, prop));
  const colorOffsets = colorProps.map(prop => calculatePropertyOffset(header.properties, prop));
  const normalOffsets = normalProps.map(prop => calculatePropertyOffset(header.properties, prop));

  // Process vertices in chunks
  const verticesPerChunk = Math.floor(chunkSize / bytesPerVertex);
  
  for (let i = 0; i < header.vertexCount; i += verticesPerChunk) {
    const chunkEnd = Math.min(i + verticesPerChunk, header.vertexCount);
    const chunkDataView = new DataView(
      uint8Array.buffer,
      offset + i * bytesPerVertex,
      (chunkEnd - i) * bytesPerVertex
    );

    for (let j = 0; j < chunkEnd - i; j++) {
      const vertexOffset = j * bytesPerVertex;

      const point: SplatPoint = {
        position: [
          posOffsets[0] >= 0 ? chunkDataView.getFloat32(vertexOffset + posOffsets[0], littleEndian) : 0,
          posOffsets[1] >= 0 ? chunkDataView.getFloat32(vertexOffset + posOffsets[1], littleEndian) : 0,
          posOffsets[2] >= 0 ? chunkDataView.getFloat32(vertexOffset + posOffsets[2], littleEndian) : 0
        ],
        color: [
          colorOffsets[0] >= 0 ? chunkDataView.getUint8(vertexOffset + colorOffsets[0]) : 128,
          colorOffsets[1] >= 0 ? chunkDataView.getUint8(vertexOffset + colorOffsets[1]) : 128,
          colorOffsets[2] >= 0 ? chunkDataView.getUint8(vertexOffset + colorOffsets[2]) : 128
        ]
      };

      if (normalOffsets.every(off => off >= 0)) {
        point.normal = [
          chunkDataView.getFloat32(vertexOffset + normalOffsets[0], littleEndian),
          chunkDataView.getFloat32(vertexOffset + normalOffsets[1], littleEndian),
          chunkDataView.getFloat32(vertexOffset + normalOffsets[2], littleEndian)
        ];
      }

      points.push(point);
    }
  }

  return points;
}

function calculateBytesPerVertex(properties: Array<{ name: string; type: string }>): number {
  return properties.reduce((total, prop) => {
    switch (prop.type) {
      case 'float': case 'float32': return total + 4;
      case 'double': case 'float64': return total + 8;
      case 'uchar': case 'uint8': return total + 1;
      case 'char': case 'int8': return total + 1;
      case 'ushort': case 'uint16': return total + 2;
      case 'short': case 'int16': return total + 2;
      case 'uint': case 'uint32': return total + 4;
      case 'int': case 'int32': return total + 4;
      default: return total + 4; // assume float
    }
  }, 0);
}

function calculatePropertyOffset(
  properties: Array<{ name: string; type: string }>, 
  targetName: string
): number {
  let offset = 0;
  for (const prop of properties) {
    if (prop.name === targetName) {
      return offset;
    }
    switch (prop.type) {
      case 'float': case 'float32': offset += 4; break;
      case 'double': case 'float64': offset += 8; break;
      case 'uchar': case 'uint8': offset += 1; break;
      case 'char': case 'int8': offset += 1; break;
      case 'ushort': case 'uint16': offset += 2; break;
      case 'short': case 'int16': offset += 2; break;
      case 'uint': case 'uint32': offset += 4; break;
      case 'int': case 'int32': offset += 4; break;
      default: offset += 4; // assume float
    }
  }
  return -1; // property not found
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