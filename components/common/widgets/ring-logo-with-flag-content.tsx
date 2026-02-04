'use client'

import React, { useRef, useEffect, useMemo } from 'react';
import * as THREE from 'three';

const RingLogoWithFlag = () => {
  const canvasRef = useRef(null);

  const { scene, camera, renderer, ring, waterRingMaterial, particles, flagMaterial } = useMemo(() => {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);

    // Create renderer without canvas initially - canvas will be created in useEffect
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true
    });
    camera.position.z = 2.5;

    const ring = new THREE.Group();
    scene.add(ring);

    // Ukrainian Flag with wind effect - positioned INSIDE the ring
    const flagGeometry = new THREE.PlaneGeometry(1.2, 0.8, 32, 32);
    const flagMaterial = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
      },
      vertexShader: `
        uniform float time;
        varying vec2 vUv;
        varying vec3 vPosition;

        void main() {
          vUv = uv;
          vec3 pos = position;

          // Wind ripple effect - waves moving across the flag
          float waveAmplitude = 0.08;
          float waveFrequency = 3.0;
          float waveSpeed = 2.0;

          // Multiple wave layers for realistic cloth movement
          float wave1 = sin(pos.x * waveFrequency + time * waveSpeed) * waveAmplitude;
          float wave2 = sin(pos.x * waveFrequency * 1.5 + time * waveSpeed * 1.3 + 1.0) * waveAmplitude * 0.5;
          float wave3 = cos(pos.y * waveFrequency * 0.8 + time * waveSpeed * 0.7) * waveAmplitude * 0.3;

          pos.z += wave1 + wave2 + wave3;

          // Add some horizontal rippling
          pos.x += sin(pos.y * 4.0 + time * 1.5) * 0.02;

          vPosition = pos;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
      `,
      fragmentShader: `
        uniform float time;
        varying vec2 vUv;
        varying vec3 vPosition;

        // Ukrainian flag colors
        vec3 blue = vec3(0.0, 0.35, 0.75);
        vec3 yellow = vec3(1.0, 0.85, 0.0);

        void main() {
          // Split flag into two horizontal bands
          vec3 flagColor = vUv.y > 0.5 ? blue : yellow;

          // Add subtle shading based on wave displacement for 3D cloth effect
          float shading = 1.0 + vPosition.z * 2.0;
          flagColor *= shading;

          // Add subtle color variation for fabric texture
          float noise = sin(vUv.x * 50.0 + time) * sin(vUv.y * 50.0 + time * 1.3) * 0.03;
          flagColor += noise;

          // Slight edge darkening for depth
          float edgeDarken = smoothstep(0.0, 0.05, vUv.x) * smoothstep(1.0, 0.95, vUv.x) *
                             smoothstep(0.0, 0.05, vUv.y) * smoothstep(1.0, 0.95, vUv.y);
          flagColor *= 0.8 + edgeDarken * 0.2;

          gl_FragColor = vec4(flagColor, 1.0);
        }
      `,
      side: THREE.DoubleSide,
    });

    const flag = new THREE.Mesh(flagGeometry, flagMaterial);
    flag.position.z = -0.1; // Slightly behind the ring center
    ring.add(flag);

    // Particles around the ring
    const particleCount = 1000;
    const particleGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3;
      const angle = (i / particleCount) * Math.PI * 2;
      const radius = 0.8 + Math.cos(angle * 8) * 0.08;
      positions[i3] = Math.cos(angle) * radius;
      positions[i3 + 1] = Math.sin(angle) * radius;
      positions[i3 + 2] = (Math.random() - 0.5) * 0.1;

      // Ukrainian colors
      const hue = i % 2 === 0 ? 0.15 : 0.55; // Yellow vs Blue
      const color = new THREE.Color().setHSL(hue, 0.8, 0.5 + Math.random() * 0.3);
      colors[i3] = color.r;
      colors[i3 + 1] = color.g;
      colors[i3 + 2] = color.b;
    }

    particleGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    particleGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

    const particleMaterial = new THREE.PointsMaterial({
      size: 0.025,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
    });
    const particles = new THREE.Points(particleGeometry, particleMaterial);
    ring.add(particles);

    // Ring torus
    const torusGeometry = new THREE.TorusGeometry(0.8, 0.1, 64, 64);
    const waterRingMaterial = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
      },
      vertexShader: `
        uniform float time;
        varying vec2 vUv;
        varying float vElevation;

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
        varying vec2 vUv;
        varying float vElevation;

        vec3 yellow = vec3(1.0, 0.85, 0.0);
        vec3 blue = vec3(0.0, 0.35, 0.75);
        vec3 gold = vec3(1.0, 0.75, 0.0);
        vec3 skyBlue = vec3(0.29, 0.56, 0.89);

        void main() {
          float t = sin(time * 0.5) * 0.5 + 0.5;
          float angle = atan(vUv.y - 0.5, vUv.x - 0.5);

          vec3 color1 = mix(blue, skyBlue, sin(time + angle * 3.0) * 0.5 + 0.5);
          vec3 color2 = mix(yellow, gold, cos(time * 1.2) * 0.5 + 0.5);

          vec3 baseColor = mix(color1, color2, t);

          float waterEffect = sin(vElevation * 10.0 + time * 2.0) * 0.5 + 0.5;
          vec3 waterColor = mix(baseColor, skyBlue, waterEffect * 0.2);

          gl_FragColor = vec4(waterColor, 1.0);
        }
      `,
    });
    const torus = new THREE.Mesh(torusGeometry, waterRingMaterial);
    ring.add(torus);

    return { scene, camera, renderer, ring, waterRingMaterial, particles, flagMaterial };
  }, []);

  useEffect(() => {
    if (!canvasRef.current || typeof document === 'undefined') return;

    // Create canvas and set it on renderer
    const canvas = document.createElement('canvas');
    renderer.domElement = canvas;
    renderer.setSize(200, 200);
    if (typeof window !== 'undefined') {
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    }

    canvasRef.current.replaceWith(renderer.domElement);

    let animationId;
    const animate = (time) => {
      animationId = requestAnimationFrame(animate);

      // Static ring - no rotation to avoid dizziness
      // Just let the flag wave in the wind

      // Update particle positions
      const positions = particles.geometry.attributes.position;
      for (let i = 0; i < positions.count; i++) {
        const i3 = i * 3;
        const x = positions.getX(i);
        const y = positions.getY(i);
        const z = positions.getZ(i);
        const angle = Math.atan2(y, x);
        const radius = Math.sqrt(x * x + y * y);
        positions.setXYZ(
          i,
          radius * Math.cos(angle + time * 0.0001 + Math.sin(time * 0.0002 + radius) * 0.1),
          radius * Math.sin(angle + time * 0.0001 + Math.sin(time * 0.0002 + radius) * 0.1),
          z + Math.sin(time * 0.001 + z * 2) * 0.02
        );
      }
      positions.needsUpdate = true;

      // Update shader time uniforms
      waterRingMaterial.uniforms.time.value = time * 0.001;
      flagMaterial.uniforms.time.value = time * 0.001;

      renderer.render(scene, camera);
    };
    animate(0);

    return () => {
      if (animationId) cancelAnimationFrame(animationId);
      // Clean up Three.js resources
      renderer.dispose();
      scene.clear();
    };
  }, [scene, camera, renderer, ring, waterRingMaterial, particles, flagMaterial]);

  return (
    <div className="aspect-square rounded-2xl bg-gradient-to-br from-blue-500 via-green-500 to-purple-600 flex items-center justify-center shadow-2xl">
      <canvas
        ref={canvasRef}
        style={{
          filter: 'drop-shadow(0 0 20px rgba(255, 215, 0, 0.3))',
        }}
      />
    </div>
  );
};

export default RingLogoWithFlag;
