// src/types/SplatTypes.ts

export interface SplatPoint {
  position: [number, number, number];
  color: [number, number, number];
  normal?: [number, number, number];
  scale?: [number, number, number];
  rotation?: [number, number, number, number]; // quaternion
  opacity?: number;
}

export interface SplatData {
  points: SplatPoint[];
  bounds: {
    min: [number, number, number];
    max: [number, number, number];
  };
  metadata: {
    format: 'ply' | 'splat';
    vertexCount: number;
    hasNormals: boolean;
    hasColors: boolean;
    fileSize: number;
    fileName: string;
  };
}

export interface FileUploadProps {
  onFileLoad: (data: SplatData) => void;
  onLoadingChange: (loading: boolean) => void;
  onError: (error: string) => void;
}

export interface Viewer3DProps {
  splatData: SplatData;
}