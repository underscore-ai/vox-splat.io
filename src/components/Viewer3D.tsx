// src/components/Viewer3D.tsx
import React, { useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid, PerspectiveCamera } from '@react-three/drei';
import { SplatData } from '../types/SplatTypes';
import * as THREE from 'three';

interface ViewportObject {
  id: string;
  data: SplatData;
  isVisible: boolean;
  pointSize?: number;
}

interface Viewer3DProps {
  objects: ViewportObject[];
}

function PointCloud({ data, pointSize = 0.005 }: { data: SplatData; pointSize: number }) {
  const geometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    
    // Basic position and color setup
    const positions = new Float32Array(data.points.length * 3);
    const colors = new Float32Array(data.points.length * 3);

    data.points.forEach((point, index) => {
      const i = index * 3;
      positions[i] = point.position[0];
      positions[i + 1] = point.position[1];
      positions[i + 2] = point.position[2];
      
      colors[i] = point.color[0] / 255;
      colors[i + 1] = point.color[1] / 255;
      colors[i + 2] = point.color[2] / 255;
    });

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    
    return geometry;
  }, [data]);

  return (
    <points geometry={geometry}>
      <pointsMaterial
        size={pointSize}
        sizeAttenuation={true}
        vertexColors={true}
        transparent={true}
        opacity={0.8}
      />
    </points>
  );
}

const Viewer3D: React.FC<Viewer3DProps> = ({ objects }) => {
  return (
    <div className="viewer-container">
      <Canvas
        camera={{ position: [2, 2, 5] }}
        onCreated={({ gl }) => {
          gl.setClearColor('#1a1a1a');
          gl.setPixelRatio(window.devicePixelRatio);
        }}
      >
        <PerspectiveCamera makeDefault position={[2, 2, 5]} />
        <OrbitControls
          makeDefault
          enableDamping={false}
          rotateSpeed={0.5}
          panSpeed={0.8}
          zoomSpeed={0.8}
        />
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} intensity={0.8} />
        <Grid
          infiniteGrid
          fadeDistance={50}
          fadeStrength={1}
          cellSize={1}
          cellThickness={0.5}
          cellColor="#666"
          sectionSize={5}
          sectionThickness={1}
          sectionColor="#aaa"
          followCamera={false}
          position={[0, -0.01, 0]}
        />
        {objects.map((object) => 
          object.isVisible && (
            <PointCloud
              key={object.id}
              data={object.data}
              pointSize={object.pointSize || 0.005}
            />
          )
        )}
      </Canvas>
    </div>
  );
};

export default Viewer3D;