// src/components/Viewer3D.tsx
import React, { useMemo, useRef, useEffect, useState, useCallback } from 'react';
import { Canvas, useThree, ThreeEvent, useFrame } from '@react-three/fiber';
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
  highlightedObjectId?: string;
  showGrid: boolean;
  activeTool: string | null;
  brushSize?: number;
}

interface SelectionBox {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

function SelectionOverlay({ 
  activeTool, 
  brushSize = 20,
  onPointsSelected 
}: { 
  activeTool: string | null;
  brushSize?: number;
  onPointsSelected?: (points: THREE.Vector3[]) => void;
}) {
  const { camera, scene, gl, size } = useThree();
  const [isSelecting, setIsSelecting] = useState(false);
  const [selection, setSelection] = useState<SelectionBox | null>(null);
  const [brushPath, setBrushPath] = useState<number[]>([]);
  const [lassoPath, setLassoPath] = useState<number[]>([]);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const selectionPlaneRef = useRef<THREE.Mesh>(null);
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const mouse = useMemo(() => new THREE.Vector2(), []);
  const selectionThrottleRef = useRef<NodeJS.Timeout | null>(null);

  // Spatial indexing using bounding boxes
  const spatialIndex = useMemo(() => {
    const index = new Map<THREE.Points, THREE.Box3>();
    scene.traverse((object) => {
      if (object instanceof THREE.Points) {
        const box = new THREE.Box3().setFromObject(object);
        index.set(object, box);
      }
    });
    return index;
  }, [scene]);

  const throttledPointSelection = useCallback((points: THREE.Vector3[]) => {
    if (selectionThrottleRef.current) {
      clearTimeout(selectionThrottleRef.current);
    }
    selectionThrottleRef.current = setTimeout(() => {
      onPointsSelected?.(points);
    }, 100); // Throttle selection updates
  }, [onPointsSelected]);

  const updateMousePosition = useCallback((event: ThreeEvent<PointerEvent>) => {
    const rect = gl.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }, [gl.domElement, mouse]);

  const handlePointerDown = useCallback((event: ThreeEvent<PointerEvent>) => {
    if (!activeTool) return;

    event.stopPropagation();
    updateMousePosition(event);
    setIsSelecting(true);

    if (activeTool === 'box-select') {
      setSelection({ startX: event.clientX, startY: event.clientY, endX: event.clientX, endY: event.clientY });
    } else if (activeTool === 'brush-select') {
      setBrushPath([event.clientX, event.clientY]);
      raycaster.setFromCamera(mouse, camera);
      
      // Find intersections with all point clouds
      let closestPoint: THREE.Vector3 | null = null;
      let minDistance = Infinity;
      
      spatialIndex.forEach((box, points) => {
        if (raycaster.ray.intersectsBox(box)) {
          const positions = points.geometry.attributes.position;
          for (let i = 0; i < positions.count; i++) {
            const point = new THREE.Vector3();
            point.fromBufferAttribute(positions, i);
            const distance = raycaster.ray.distanceToPoint(point);
            if (distance < minDistance && distance < brushSize / 100) {
              minDistance = distance;
              closestPoint = point.clone();
            }
          }
        }
      });

      if (closestPoint) {
        throttledPointSelection([closestPoint]);
      }
    } else if (activeTool === 'lasso-select') {
      setLassoPath([event.clientX, event.clientY]);
    }
  }, [activeTool, camera, mouse, spatialIndex, raycaster, throttledPointSelection, updateMousePosition, brushSize]);

  const handlePointerMove = useCallback((event: ThreeEvent<PointerEvent>) => {
    updateMousePosition(event);

    if (!isSelecting || !activeTool) return;

    event.stopPropagation();

    if (activeTool === 'box-select' && selection) {
      setSelection({ ...selection, endX: event.clientX, endY: event.clientY });
    } else if (activeTool === 'brush-select') {
      setBrushPath(prev => [...prev, event.clientX, event.clientY]);
      raycaster.setFromCamera(mouse, camera);
      
      // Find intersections with all point clouds
      let closestPoint: THREE.Vector3 | null = null;
      let minDistance = Infinity;
      
      spatialIndex.forEach((box, points) => {
        if (raycaster.ray.intersectsBox(box)) {
          const positions = points.geometry.attributes.position;
          for (let i = 0; i < positions.count; i++) {
            const point = new THREE.Vector3();
            point.fromBufferAttribute(positions, i);
            const distance = raycaster.ray.distanceToPoint(point);
            if (distance < minDistance && distance < brushSize / 100) {
              minDistance = distance;
              closestPoint = point.clone();
            }
          }
        }
      });

      if (closestPoint) {
        throttledPointSelection([closestPoint]);
      }
    } else if (activeTool === 'lasso-select') {
      setLassoPath(prev => [...prev, event.clientX, event.clientY]);
    }
  }, [activeTool, camera, isSelecting, mouse, spatialIndex, raycaster, selection, throttledPointSelection, updateMousePosition, brushSize]);

  const handlePointerUp = useCallback((event: ThreeEvent<PointerEvent>) => {
    if (!isSelecting || !activeTool) return;

    event.stopPropagation();
    setIsSelecting(false);

    if (activeTool === 'box-select' && selection) {
      const startNDC = new THREE.Vector2(
        (selection.startX / size.width) * 2 - 1,
        -(selection.startY / size.height) * 2 + 1
      );
      const endNDC = new THREE.Vector2(
        (selection.endX / size.width) * 2 - 1,
        -(selection.endY / size.height) * 2 + 1
      );

      const selectedPoints: THREE.Vector3[] = [];
      const frustum = new THREE.Frustum();
      const projScreenMatrix = new THREE.Matrix4();
      projScreenMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      frustum.setFromProjectionMatrix(projScreenMatrix);

      spatialIndex.forEach((box, points) => {
        if (frustum.intersectsBox(box)) {
          const positions = points.geometry.attributes.position;
          for (let i = 0; i < positions.count; i++) {
            const point = new THREE.Vector3();
            point.fromBufferAttribute(positions, i);
            const screenPos = point.clone().project(camera);
            if (screenPos.x >= Math.min(startNDC.x, endNDC.x) &&
                screenPos.x <= Math.max(startNDC.x, endNDC.x) &&
                screenPos.y >= Math.min(startNDC.y, endNDC.y) &&
                screenPos.y <= Math.max(startNDC.y, endNDC.y)) {
              selectedPoints.push(point.clone());
            }
          }
        }
      });
      onPointsSelected?.(selectedPoints);
    }

    // Clear selection states
    setSelection(null);
    setBrushPath([]);
    setLassoPath([]);
  }, [activeTool, camera, isSelecting, spatialIndex, onPointsSelected, selection, size.height, size.width]);

  // Create and manage the overlay canvas
  useEffect(() => {
    const container = gl.domElement.parentElement;
    if (!container) return;

    if (!canvasRef.current) {
      const canvas = document.createElement('canvas');
      canvas.style.position = 'absolute';
      canvas.style.top = '0';
      canvas.style.left = '0';
      canvas.style.pointerEvents = 'none';
      canvas.style.zIndex = '1';
      canvas.width = size.width;
      canvas.height = size.height;
      container.appendChild(canvas);
      canvasRef.current = canvas;
    }

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (canvasRef.current) {
          canvasRef.current.width = entry.contentRect.width;
          canvasRef.current.height = entry.contentRect.height;
        }
      }
    });

    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      canvasRef.current?.remove();
    };
  }, [gl, size]);

  // Draw selection overlays
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#60a5fa';
    ctx.fillStyle = 'rgba(96, 165, 250, 0.1)';
    ctx.lineWidth = 2;

    if (activeTool === 'box-select' && selection) {
      const width = selection.endX - selection.startX;
      const height = selection.endY - selection.startY;
      ctx.setLineDash([5, 5]);
      ctx.strokeRect(selection.startX, selection.startY, width, height);
      ctx.fillRect(selection.startX, selection.startY, width, height);
    } else if (activeTool === 'brush-select' && brushPath.length >= 4) {
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(brushPath[brushPath.length - 2], brushPath[brushPath.length - 1], brushSize, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fill();
    } else if (activeTool === 'lasso-select' && lassoPath.length >= 4) {
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(lassoPath[0], lassoPath[1]);
      for (let i = 2; i < lassoPath.length; i += 2) {
        ctx.lineTo(lassoPath[i], lassoPath[i + 1]);
      }
      if (!isSelecting) {
        ctx.closePath();
      }
      ctx.stroke();
      ctx.fill();
    }

    // Draw brush cursor if brush tool is active
    if (activeTool === 'brush-select' && !isSelecting) {
      ctx.beginPath();
      ctx.arc(mouse.x * size.width, mouse.y * size.height, brushSize, 0, Math.PI * 2);
      ctx.stroke();
    }
  }, [selection, brushPath, lassoPath, isSelecting, activeTool, brushSize, mouse.x, mouse.y, size]);

  return (
    <mesh
      ref={selectionPlaneRef}
      visible={false}
      position={[0, 0, 0]}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <planeGeometry args={[100, 100]} />
      <meshBasicMaterial transparent opacity={0} />
    </mesh>
  );
}

function PointCloud({ 
  data, 
  pointSize = 0.005, 
  id, 
  isHighlighted,
  selectedPoints = new Set()
}: { 
  data: SplatData; 
  pointSize: number; 
  id: string;
  isHighlighted: boolean;
  selectedPoints?: Set<number>;
}) {
  const pointsRef = useRef<THREE.Points>(null);
  const materialRef = useRef<THREE.PointsMaterial>(null);
  const colorsRef = useRef<Float32Array | null>(null);
  const originalColorsRef = useRef<Float32Array | null>(null);
  const { camera } = useThree();

  const geometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    
    // Chunk size for better performance
    const CHUNK_SIZE = 100000; // Adjust based on performance needs
    const totalPoints = data.points.length;
    const positions = new Float32Array(totalPoints * 3);
    const colors = new Float32Array(totalPoints * 3);
    const sizes = new Float32Array(totalPoints);

    // Process points in chunks
    for (let i = 0; i < totalPoints; i += CHUNK_SIZE) {
      const chunkEnd = Math.min(i + CHUNK_SIZE, totalPoints);
      for (let j = i; j < chunkEnd; j++) {
        const point = data.points[j];
        const idx = j * 3;
        
        positions[idx] = point.position[0];
        positions[idx + 1] = point.position[1];
        positions[idx + 2] = point.position[2];
        
        colors[idx] = point.color[0] / 255;
        colors[idx + 1] = point.color[1] / 255;
        colors[idx + 2] = point.color[2] / 255;
        
        // Dynamic point size based on distance from camera
        const distance = new THREE.Vector3(
          point.position[0],
          point.position[1],
          point.position[2]
        ).distanceTo(camera.position);
        sizes[j] = Math.max(pointSize * (50 / distance), pointSize * 0.5);
      }
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    
    // Add bounding box for frustum culling
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    
    colorsRef.current = colors;
    originalColorsRef.current = colors.slice();
    
    return geometry;
  }, [data, camera.position, pointSize]);

  // Update visibility based on frustum culling
  useFrame(({ camera }) => {
    if (pointsRef.current && materialRef.current) {
      const frustum = new THREE.Frustum();
      frustum.setFromProjectionMatrix(
        new THREE.Matrix4().multiplyMatrices(
          camera.projectionMatrix,
          camera.matrixWorldInverse
        )
      );

      // Only render if within view frustum
      if (geometry.boundingSphere) {
        pointsRef.current.visible = frustum.intersectsSphere(geometry.boundingSphere);
      }

      // Update point sizes based on distance
      const sizes = geometry.attributes.size as THREE.BufferAttribute;
      const positions = geometry.attributes.position;
      
      for (let i = 0; i < positions.count; i++) {
        const point = new THREE.Vector3();
        point.fromBufferAttribute(positions, i);
        const distance = point.distanceTo(camera.position);
        sizes.array[i] = Math.max(pointSize * (50 / distance), pointSize * 0.5);
      }
      sizes.needsUpdate = true;
    }
  });

  // Update colors for selected points
  useEffect(() => {
    if (colorsRef.current && originalColorsRef.current && geometry.attributes.color) {
      const colors = colorsRef.current;
      const originalColors = originalColorsRef.current;

      // Reset colors
      colors.set(originalColors);

      // Highlight selected points
      selectedPoints.forEach((index) => {
        const i = index * 3;
        colors[i] = 1.0;      // Full red
        colors[i + 1] = 1.0;  // Full green
        colors[i + 2] = 0.0;  // No blue = yellow
      });

      (geometry.attributes.color as THREE.BufferAttribute).needsUpdate = true;
    }
  }, [selectedPoints, geometry.attributes.color]);

  return (
    <points ref={pointsRef} geometry={geometry}>
      <pointsMaterial
        ref={materialRef}
        vertexColors={true}
        transparent={true}
        opacity={0.8}
        sizeAttenuation={true}
        size={pointSize}
        // Enable depth testing for better performance
        depthTest={true}
        depthWrite={true}
      />
    </points>
  );
}

const Viewer3D: React.FC<Viewer3DProps> = ({ 
  objects, 
  highlightedObjectId, 
  showGrid,
  activeTool,
  brushSize = 20
}) => {
  const [selectedPoints, setSelectedPoints] = useState<Set<number>>(new Set());
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current) {
        const canvas = canvasRef.current;
        const container = canvas.parentElement;
        if (container) {
          canvas.style.width = `${container.clientWidth}px`;
          canvas.style.height = `${container.clientHeight}px`;
          canvas.width = container.clientWidth * window.devicePixelRatio;
          canvas.height = container.clientHeight * window.devicePixelRatio;
        }
      }
    };

    window.addEventListener('resize', handleResize);
    handleResize(); // Initial size setup

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Temporarily disabled selection functionality
  const handlePointsSelected = (points: THREE.Vector3[]) => {
    // Selection functionality temporarily disabled
  };

  return (
    <div className={`viewer-container`} data-tool={activeTool}>
      <Canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%' }}
        camera={{ position: [2, 2, 5], fov: 75 }}
        onCreated={({ gl, camera }) => {
          gl.setClearColor('#1a1a1a');
          gl.setPixelRatio(window.devicePixelRatio);
          gl.setSize(window.innerWidth, window.innerHeight);
          if (camera instanceof THREE.PerspectiveCamera) {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
          }
        }}
      >
        <PerspectiveCamera makeDefault position={[2, 2, 5]} />
        <OrbitControls
          makeDefault
          enableDamping={false}
          rotateSpeed={0.5}
          panSpeed={0.8}
          zoomSpeed={0.8}
          enabled={true} // Always enable controls since selection is disabled
        />
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} intensity={0.8} />
        {showGrid && (
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
        )}
        {objects.map((object) => 
          object.isVisible && (
            <PointCloud
              key={object.id}
              id={object.id}
              data={object.data}
              pointSize={object.pointSize || 0.005}
              isHighlighted={object.id === highlightedObjectId}
              selectedPoints={new Set()} // Empty set since selection is disabled
            />
          )
        )}
      </Canvas>
    </div>
  );
};

export default Viewer3D;