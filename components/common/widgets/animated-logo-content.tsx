'use client'

import React, { useRef, useEffect, useMemo } from 'react'
import * as THREE from 'three'
import EarthIcon from './earth-icon'

export interface AnimatedLogoContentProps {
  size?: number // Canvas render size (default: 77)
}

const AnimatedLogoContent: React.FC<AnimatedLogoContentProps> = ({ size = 77 }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const { scene, camera, renderer, ring, waterRingMaterial, particles } = useMemo(() => {
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000)
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, canvas: document.createElement('canvas') })

    renderer.setSize(size, size) // Configurable render size
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)) // High DPI support
    camera.position.z = 2.5 // Moved the camera closer to make the ring appear larger

    const ring = new THREE.Group()
    scene.add(ring)

    // Particles
    const particleCount = 2000
    const particleGeometry = new THREE.BufferGeometry()
    const positions = new Float32Array(particleCount * 3)
    const colors = new Float32Array(particleCount * 3)

    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3
      const angle = (i / particleCount) * Math.PI * 2
      const radius = 0.8 + Math.cos(angle * 8) * 0.08 // Adjusted radius
      positions[i3] = Math.cos(angle) * radius
      positions[i3 + 1] = Math.sin(angle) * radius
      positions[i3 + 2] = (Math.random() - 0.5) * 0.1 // Reduced depth

      const hue = (i / particleCount) * 0.3 + 0.1
      const color = new THREE.Color().setHSL(hue, 0.8, 0.5 + Math.random() * 0.3)
      colors[i3] = color.r
      colors[i3 + 1] = color.g
      colors[i3 + 2] = color.b
    }

    particleGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    particleGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
    
    const particleMaterial = new THREE.PointsMaterial({
      size: 0.02, // Increased particle size
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
    })
    const particles = new THREE.Points(particleGeometry, particleMaterial)
    ring.add(particles)

    // Torus with custom shader
    const torusGeometry = new THREE.TorusGeometry(0.8, 0.1, 128, 128) // Increased thickness
    const waterRingMaterial = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        resolution: { value: new THREE.Vector2() },
      },
      vertexShader: `
        uniform float time;
        varying vec2 vUv;
        varying float vElevation;

        // Simplex 2D noise
        vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }

        float snoise(vec2 v) {
          const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                    -0.577350269189626, 0.024390243902439);
          vec2 i  = floor(v + dot(v, C.yy) );
          vec2 x0 = v -   i + dot(i, C.xx);
          vec2 i1;
          i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
          vec4 x12 = x0.xyxy + C.xxzz;
          x12.xy -= i1;
          i = mod(i, 289.0);
          vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 ))
          + i.x + vec3(0.0, i1.x, 1.0 ));
          vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy),
            dot(x12.zw,x12.zw)), 0.0);
          m = m*m ;
          m = m*m ;
          vec3 x = 2.0 * fract(p * C.www) - 1.0;
          vec3 h = abs(x) - 0.5;
          vec3 ox = floor(x + 0.5);
          vec3 a0 = x - ox;
          m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
          vec3 g;
          g.x  = a0.x  * x0.x  + h.x  * x0.y;
          g.yz = a0.yz * x12.xz + h.yz * x12.yw;
          return 130.0 * dot(m, g);
        }

        void main() {
          vUv = uv;
          vec3 pos = position;
          
          float noiseFreq = 1.5;
          float noiseAmp = 0.15;
          vec2 noisePos = vec2(pos.x * noiseFreq + time, pos.y * noiseFreq + time);
          pos.z += snoise(noisePos) * noiseAmp;
          
          vElevation = pos.z;

          gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
      `,
      fragmentShader: `
        uniform float time;
        uniform vec2 resolution;
        varying vec2 vUv;
        varying float vElevation;

        vec3 yellow = vec3(1.0, 0.8, 0.0);
        vec3 blue = vec3(0.0, 0.5, 1.0);
        vec3 green = vec3(0.0, 0.8, 0.2);
        vec3 brown = vec3(0.6, 0.3, 0.0);

        void main() {
          float t = sin(time * 0.5) * 0.5 + 0.5;
          float angle = atan(vUv.y - 0.5, vUv.x - 0.5);
          float segment = floor(mod(angle / (3.14159 * 2.0) * 6.0, 6.0));
          
          vec3 color1 = mix(yellow, blue, sin(time + segment) * 0.5 + 0.5);
          vec3 color2 = mix(green, brown, cos(time * 1.2 + segment * 0.5) * 0.5 + 0.5);
          
          vec3 baseColor = mix(color1, color2, t);
          
          float waterEffect = sin(vElevation * 10.0 + time * 2.0) * 0.5 + 0.5;
          vec3 waterColor = mix(baseColor, vec3(0.0, 0.7, 1.0), waterEffect * 0.3);
          
          gl_FragColor = vec4(waterColor, 1.0);
        }
      `,
    })
    const torus = new THREE.Mesh(torusGeometry, waterRingMaterial)
    ring.add(torus)

return { scene, camera, renderer, ring, waterRingMaterial, particles }
  }, [size])

  useEffect(() => {
    if (!canvasRef.current) return

    // Replace the canvas element
    canvasRef.current.replaceWith(renderer.domElement)

    const animate = (time: number) => {
      requestAnimationFrame(animate)

      ring.rotation.z = time * 0.001

      const positions = particles.geometry.attributes.position as THREE.BufferAttribute
      for (let i = 0; i < positions.count; i++) {
        const i3 = i * 3
        const x = positions.getX(i)
        const y = positions.getY(i)
        const z = positions.getZ(i)
        const angle = Math.atan2(y, x)
        const radius = Math.sqrt(x * x + y * y)
        positions.setXYZ(
          i,
          radius * Math.cos(angle + time * 0.0001 + Math.sin(time * 0.0002 + radius) * 0.1),
          radius * Math.sin(angle + time * 0.0001 + Math.sin(time * 0.0002 + radius) * 0.1),
          z + Math.sin(time * 0.001 + z * 2) * 0.02
        )
      }
      positions.needsUpdate = true

      waterRingMaterial.uniforms.time.value = time * 0.001

      renderer.render(scene, camera)
    }
    animate(0)

    return () => {}
  }, [scene, camera, renderer, ring, waterRingMaterial, particles])
  return <canvas ref={canvasRef} />
}

export default AnimatedLogoContent