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
  const uint8Array = new Uint8Array(buffer);
  const text = new TextDecoder().decode(uint8Array.slice(0, Math.min(buffer.byteLength, 8192)));
  
  if (!text.startsWith('ply')) {
    throw new Error('Invalid PLY file: Missing PLY header');
  }

  const header = parsePlyHeader(text);
  const points: SplatPoint[] = [];

  if (header.format === 'ascii') {
    points.push(...parseAsciiPly(text, header));
  } else {
    points.push(...parseBinaryPly(uint8Array, header));
  }

  if (points.length === 0) {
    throw new Error('No valid points found in PLY file');
  }

  // Calculate bounds
  const bounds = calculateBounds(points);

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

function parseAsciiPly(text: string, header: PlyHeader): SplatPoint[] {
  const lines = text.split('\n');
  const dataStartIndex = lines.findIndex(line => line.trim() === 'end_header') + 1;
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

  for (let i = dataStartIndex; i < Math.min(dataStartIndex + header.vertexCount, lines.length); i++) {
    const line = lines[i].trim();
    if (!line) continue;

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

function parseBinaryPly(uint8Array: Uint8Array, header: PlyHeader): SplatPoint[] {
  const points: SplatPoint[] = [];
  const dataView = new DataView(uint8Array.buffer);
  const littleEndian = header.format === 'binary_little_endian';
  
  let offset = header.headerLength;
  const bytesPerVertex = calculateBytesPerVertex(header.properties);

  const posProps = ['x', 'y', 'z'];
  const colorProps = ['red', 'green', 'blue'];
  const normalProps = ['nx', 'ny', 'nz'];

  const posOffsets = posProps.map(prop => calculatePropertyOffset(header.properties, prop));
  const colorOffsets = colorProps.map(prop => calculatePropertyOffset(header.properties, prop));
  const normalOffsets = normalProps.map(prop => calculatePropertyOffset(header.properties, prop));

  for (let i = 0; i < header.vertexCount; i++) {
    const point: SplatPoint = {
      position: [
        posOffsets[0] >= 0 ? dataView.getFloat32(offset + posOffsets[0], littleEndian) : 0,
        posOffsets[1] >= 0 ? dataView.getFloat32(offset + posOffsets[1], littleEndian) : 0,
        posOffsets[2] >= 0 ? dataView.getFloat32(offset + posOffsets[2], littleEndian) : 0
      ],
      color: [
        colorOffsets[0] >= 0 ? dataView.getUint8(offset + colorOffsets[0]) : 128,
        colorOffsets[1] >= 0 ? dataView.getUint8(offset + colorOffsets[1]) : 128,
        colorOffsets[2] >= 0 ? dataView.getUint8(offset + colorOffsets[2]) : 128
      ]
    };

    if (normalOffsets.every(off => off >= 0)) {
      point.normal = [
        dataView.getFloat32(offset + normalOffsets[0], littleEndian),
        dataView.getFloat32(offset + normalOffsets[1], littleEndian),
        dataView.getFloat32(offset + normalOffsets[2], littleEndian)
      ];
    }

    points.push(point);
    offset += bytesPerVertex;
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