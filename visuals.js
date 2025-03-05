// visuals.js - Enhanced WebGL rendering with procedural textures

import * as THREE from 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r134/three.min.js';
import { EffectComposer } from 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r134/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r134/examples/jsm/postprocessing/RenderPass.js';
import { BloomPass } from 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r134/examples/jsm/postprocessing/BloomPass.js';

// Assumes SimplexNoise is loaded globally via index.html
const noise = new SimplexNoise();

class Visuals {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.composer = null;
        this.rodMesh = null;
        this.terrainMesh = null;
        this.ejectaMeshes = [];
        this.shockwaveMesh = null;
        this.objectMeshes = new Map();
        this.rainParticles = null;
        this.cloudGroup = null;

        this.clock = new THREE.Clock();
        Game.systems.visuals = this;
    }

    generateNormalMap(width = 256, height = 256) {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        const imageData = ctx.createImageData(width, height);

        for (let x = 0; x < width; x++) {
            for (let y = 0; y < height; y++) {
                const noiseValue = noise.perlin2(x / 50, y / 50) * 0.5 + 0.5;
                const i = (x + y * width) * 4;
                imageData.data[i] = (noiseValue - 0.5) * 255;
                imageData.data[i + 1] = (noiseValue - 0.5) * 255;
                imageData.data[i + 2] = 255;
                imageData.data[i + 3] = 255;
            }
        }
        ctx.putImageData(imageData, 0, 0);
        return new THREE.CanvasTexture(canvas);
    }

    generateBarkTexture(width = 128, height = 256) {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        const imageData = ctx.createImageData(width, height);

        for (let x = 0; x < width; x++) {
            for (let y = 0; y < height; y++) {
                const noiseValue = noise.perlin2(x / 20, y / 100) * 0.5 + 0.5;
                const baseColor = [139, 69, 19];
                const i = (x + y * width) * 4;
                imageData.data[i] = baseColor[0] * (0.8 + noiseValue * 0.4);
                imageData.data[i + 1] = baseColor[1] * (0.8 + noiseValue * 0.4);
                imageData.data[i + 2] = baseColor[2] * (0.8 + noiseValue * 0.4);
                imageData.data[i + 3] = 255;
            }
        }
        ctx.putImageData(imageData, 0, 0);
        return new THREE.CanvasTexture(canvas);
    }

    generateLeafTexture(width = 128, height = 128) {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        const imageData = ctx.createImageData(width, height);

        for (let x = 0; x < width; x++) {
            for (let y = 0; y < height; y++) {
                const noiseValue = noise.perlin2(x / 20, y / 20) * 0.5 + 0.5;
                const i = (x + y * width) * 4;
                const alpha = noiseValue > 0.3 ? 255 : 0;
                imageData.data[i] = 0;
                imageData.data[i + 1] = 255 * noiseValue;
                imageData.data[i + 2] = 0;
                imageData.data[i + 3] = alpha;
            }
        }
        ctx.putImageData(imageData, 0, 0);
        return new THREE.CanvasTexture(canvas);
    }

    generateRockNormalTexture(width = 128, height = 128) {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        const imageData = ctx.createImageData(width, height);

        for (let x = 0; x < width; x++) {
            for (let y = 0; y < height; y++) {
                const noiseValue = noise.perlin2(x / 10, y / 10) * 0.5 + 0.5;
                const i = (x + y * width) * 4;
                imageData.data[i] = (noiseValue - 0.5) * 255;
                imageData.data[i + 1] = (noiseValue - 0.5) * 255;
                imageData.data[i + 2] = 255;
                imageData.data[i + 3] = 255;
            }
        }
        ctx.putImageData(imageData, 0, 0);
        return new THREE.CanvasTexture(canvas);
    }

    init(canvas) {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, canvas.width / canvas.height, 0.1, 20000);
        this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
        this.renderer.setSize(canvas.width, canvas.height);

        this.camera.position.set(0, 1000, 1000);
        this.camera.lookAt(0, 0, 0);

        const ambientLight = new THREE.AmbientLight(0x404040);
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(0, 1, 1);
        directionalLight.castShadow = true;
        this.scene.add(ambientLight, directionalLight);

        const terrainGeometry = new THREE.PlaneGeometry(Game.systems.terrain.width, Game.systems.terrain.depth, Game.systems.terrain.gridWidth - 1, Game.systems.terrain.gridDepth - 1);
        const terrainMaterial = new THREE.MeshPhongMaterial({ 
            vertexColors: true, 
            shininess: 10, 
            normalMap: this.generateNormalMap(Game.systems.terrain.gridWidth, Game.systems.terrain.gridDepth) 
        });
        this.terrainMesh = new THREE.Mesh(terrainGeometry, terrainMaterial);
        this.terrainMesh.rotation.x = -Math.PI / 2;
        this.terrainMesh.receiveShadow = true;
        this.scene.add(this.terrainMesh);
        this.updateTerrain();

        this.scene.background = new THREE.Color(0x87ceeb);
        this.scene.fog = new THREE.Fog(0x87ceeb, 500, 2000);

        this.composer = new EffectComposer(this.renderer);
        this.composer.addPass(new RenderPass(this.scene, this.camera));
        this.composer.addPass(new BloomPass(1.5, 25, 4.0, 512));

        console.log('Enhanced WebGL initialized');
    }

    render() {
        if (!this.renderer) return;

        const deltaTime = this.clock.getDelta();

        if (Game.gameState.currentRodIndex >= 0) {
            const rodState = Game.systems.physics.getObjectState(Game.gameState.currentRodIndex);
            const rodData = Game.systems.rods.getRodState();
            if (!this.rodMesh) {
                const geometry = new THREE.CylinderGeometry(rodData.radius, rodData.radius, rodData.length, 16);
                const material = new THREE.MeshPhongMaterial({ 
                    color: this.hexToThreeColor(Game.systems.rods.materials[rodData.material].color), 
                    emissive: 0xff0000, 
                    emissiveIntensity: rodState.velocity.y < -1000 ? 0.5 : 0 
                });
                this.rodMesh = new THREE.Mesh(geometry, material);
                this.rodMesh.castShadow = true;
                this.scene.add(this.rodMesh);
            }
            this.rodMesh.position.set(rodState.position.x, rodState.position.y - rodData.length / 2, rodState.position.z);
            const degradation = Game.systems.rods.checkDegradation(rodState.velocity);
            if (degradation.degraded) {
                this.rodMesh.material.opacity = Math.max(0.3, 1 - degradation.massLoss / rodData.mass);
                this.rodMesh.scale.setScalar(1 - degradation.massLoss / rodData.mass);
            }
            if (rodState.collided) {
                this.handleImpact(Game.gameState.currentRodIndex);
                this.scene.remove(this.rodMesh);
                this.rodMesh = null;
            }

            if (rodState.velocity.y < -1000) {
                const particle = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 8), new THREE.MeshBasicMaterial({ color: 0xff4500, transparent: true, opacity: 0.5 }));
                particle.position.copy(this.rodMesh.position);
                this.scene.add(particle);
                setTimeout(() => this.scene.remove(particle), 200);
            }
        }

        this.updateWeatherEffects(deltaTime);
        this.updateObjectAnimations();

        this.composer.render();
    }

    handleImpact(physicsIndex) {
        const impactData = Game.systems.impact.getImpactAnimationData(physicsIndex);
        const ejectaData = Game.systems.ejecta.getEjectaAnimationData(physicsIndex);
        const shockwaveData = Game.systems.shockwave.getShockwaveAnimationData(physicsIndex);

        if (impactData) {
            this.animateImpact(impactData);
            this.camera.position.lerp(new THREE.Vector3(impactData.x, 500, impactData.z + 500), 0.05);
            this.camera.lookAt(impactData.x, 0, impactData.z);
        }
        if (ejectaData) this.animateEjecta(ejectaData);
        if (shockwaveData) this.animateShockwave(shockwaveData);
    }

    animateImpact(impactData) {
        this.updateTerrain();

        const explosionGeometry = new THREE.SphereGeometry(impactData.explosionRadius, 32, 32);
        const explosionMaterial = new THREE.MeshBasicMaterial({ color: 0xff4500, transparent: true, opacity: 0.9 });
        const explosionMesh = new THREE.Mesh(explosionGeometry, explosionMaterial);
        explosionMesh.position.set(impactData.x, impactData.craterDepth / 2, impactData.z);
        this.scene.add(explosionMesh);

        const dustGeometry = new THREE.BufferGeometry();
        const dustPositions = new Float32Array(1000 * 3);
        for (let i = 0; i < 1000; i++) {
            dustPositions[i * 3] = impactData.x + (Math.random() - 0.5) * impactData.craterRadius * 2;
            dustPositions[i * 3 + 1] = Math.random() * impactData.craterDepth;
            dustPositions[i * 3 + 2] = impactData.z + (Math.random() - 0.5) * impactData.craterRadius * 2;
        }
        dustGeometry.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
        const dustMaterial = new THREE.PointsMaterial({ color: 0x8b4513, size: 0.5, transparent: true, opacity: 0.7 });
        const dustParticles = new THREE.Points(dustGeometry, dustMaterial);
        this.scene.add(dustParticles);

        let time = 0;
        const animate = () => {
            time += Physics.timeStep;
            explosionMesh.scale.setScalar(1 + time * 2);
            explosionMaterial.opacity = 0.9 * (1 - time / impactData.explosionDuration);
            dustMaterial.opacity = 0.7 * (1 - time / impactData.explosionDuration);
            dustParticles.position.y += 0.1;
            if (time < impactData.explosionDuration) requestAnimationFrame(animate);
            else {
                this.scene.remove(explosionMesh, dustParticles);
            }
        };
        animate();
    }

    animateEjecta(ejectaData) {
        this.ejectaMeshes.forEach(m => this.scene.remove(m.mesh));
        this.ejectaMeshes = [];

        ejectaData.particles.forEach((p, i) => {
            const size = p.type === 'boulder' || p.type === 'flamingBoulder' ? 2 : p.type === 'rock' ? 1 : 0.5;
            const geometry = p.type === 'dirt' ? new THREE.SphereGeometry(size, 8, 8) : new THREE.IcosahedronGeometry(size, 1);
            const material = new THREE.MeshPhongMaterial({ 
                color: this.hexToThreeColor(p.color), 
                emissive: p.type.includes('flaming') ? 0xff4500 : 0, 
                emissiveIntensity: p.type.includes('flaming') ? 0.8 : 0,
                normalMap: p.type !== 'dirt' ? this.generateRockNormalTexture() : null
            });
            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.set(p.initialPosition.x, p.initialPosition.y, p.initialPosition.z);
            mesh.castShadow = true;
            this.scene.add(mesh);
            this.ejectaMeshes.push({ mesh, trajectory: ejectaData.trajectories[i], time: 0 });
        });

        const animate = () => {
            let allDone = true;
            this.ejectaMeshes.forEach(e => {
                if (e.time < e.trajectory.length) {
                    allDone = false;
                    const step = e.trajectory[Math.floor(e.time)];
                    e.mesh.position.set(step.x, step.y, step.z);
                    e.mesh.material.color.setHex(this.hexToThreeColor(step.color));
                    e.mesh.material.emissive.setHex(step.type.includes('flaming') ? 0xff4500 : 0);
                    e.mesh.rotation.x += 0.1;
                    e.mesh.rotation.z += 0.1;
                    if (e.time > 0 && e.trajectory[e.time - 1].y > step.y) {
                        const trail = new THREE.Mesh(new THREE.SphereGeometry(0.2, 4, 4), new THREE.MeshBasicMaterial({ color: 0x8b4513, transparent: true, opacity: 0.5 }));
                        trail.position.copy(e.mesh.position);
                        this.scene.add(trail);
                        setTimeout(() => this.scene.remove(trail), 500);
                    }
                    e.time += 1;
                }
            });
            if (!allDone) requestAnimationFrame(animate);
        };
        animate();

        ejectaData.secondaryImpacts.forEach(() => this.updateTerrain());
    }

    animateShockwave(shockwaveData) {
        const geometry = new THREE.TorusGeometry(1, 0.5, 16, 64);
        const material = new THREE.MeshBasicMaterial({ color: 0xaaaaaa, transparent: true, opacity: 0.7, side: THREE.DoubleSide });
        this.shockwaveMesh = new THREE.Mesh(geometry, material);
        this.shockwaveMesh.position.set(shockwaveData.x, 1, shockwaveData.z);
        this.shockwaveMesh.rotation.x = Math.PI / 2;
        this.scene.add(this.shockwaveMesh);

        let time = 0;
        const animate = () => {
            time += Physics.timeStep;
            const stepIndex = Math.floor(time / (shockwaveData.duration / shockwaveData.animationSteps.length));
            if (stepIndex < shockwaveData.animationSteps.length) {
                const step = shockwaveData.animationSteps[stepIndex];
                this.shockwaveMesh.scale.set(step.radius, step.radius, 1);
                material.opacity = 0.7 * (step.intensity / shockwaveData.animationSteps[0].intensity);
                requestAnimationFrame(animate);
            } else {
                this.scene.remove(this.shockwaveMesh);
                this.shockwaveMesh = null;
            }
        };
        animate();
    }

    updateTerrain() {
        const terrainData = Game.systems.terrain.getTerrainData();
        const vertices = this.terrainMesh.geometry.attributes.position.array;
        const colors = new Float32Array(vertices.length);

        for (let x = 0; x < terrainData.gridWidth; x++) {
            for (let z = 0; z < terrainData.gridDepth; z++) {
                const vertexIndex = (x + z * terrainData.gridWidth) * 3;
                const height = terrainData.heightMap[x][z];
                vertices[vertexIndex + 1] = height + (noise.perlin2(x / 50, z / 50) * 2);
                const typeColor = new THREE.Color(this.hexToThreeColor(terrainData.terrainTypes[terrainData.typeMap[x][z]].color));
                colors[vertexIndex] = typeColor.r;
                colors[vertexIndex + 1] = typeColor.g;
                colors[vertexIndex + 2] = typeColor.b;
            }
        }
        this.terrainMesh.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        this.terrainMesh.geometry.attributes.position.needsUpdate = true;
        this.terrainMesh.geometry.attributes.color.needsUpdate = true;
        this.terrainMesh.geometry.computeVertexNormals();

        terrainData.objects.forEach(obj => {
            const key = `${obj.x},${obj.z}`;
            if (!this.objectMeshes.has(key) && obj.intact) {
                let mesh;
                if (obj.type === 'tree') {
                    const trunkGeometry = new THREE.CylinderGeometry(0.5, 0.5, 2, 8);
                    const trunkMaterial = new THREE.MeshPhongMaterial({ 
                        color: 0x8b4513, 
                        map: this.generateBarkTexture() 
                    });
                    const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
                    trunk.position.y = 1;
                    const foliage = new THREE.Group();
                    for (let i = 0; i < 3; i++) {
                        const coneGeometry = new THREE.ConeGeometry(2 - i * 0.5, 3, 8);
                        const coneMaterial = new THREE.MeshPhongMaterial({ 
                            color: 0x00ff00 * (1 - i * 0.1), 
                            map: this.generateLeafTexture(), 
                            transparent: true 
                        });
                        const cone = new THREE.Mesh(coneGeometry, coneMaterial);
                        cone.position.y = 2 + i * 1.5;
                        foliage.add(cone);
                    }
                    mesh = new THREE.Group();
                    mesh.add(trunk, foliage);
                } else {
                    const geometry = new THREE.IcosahedronGeometry(obj.height / 2, 1);
                    const material = new THREE.MeshPhongMaterial({ 
                        color: this.hexToThreeColor(terrainData.objectTypes[obj.type].color), 
                        normalMap: this.generateRockNormalTexture() 
                    });
                    mesh = new THREE.Mesh(geometry, material);
                }
                mesh.position.set(obj.x, obj.y + (obj.type === 'tree' ? 0 : obj.height / 2), obj.z);
                mesh.castShadow = true;
                this.scene.add(mesh);
                this.objectMeshes.set(key, { mesh, physicsIndex: undefined });
            }
        });
    }

    updateWeatherEffects(deltaTime) {
        const weatherData = Game.systems.weather ? Game.systems.weather.getWeatherData() : { precipIntensity: 0, cloudCover: 0, windScale: 1 };
        this.scene.fog.density = (weatherData.cloudCover + weatherData.precipIntensity) * 0.001;

        if (weatherData.precipIntensity > 0) {
            if (!this.rainParticles) {
                const geometry = new THREE.BufferGeometry();
                const positions = new Float32Array(5000 * 3);
                for (let i = 0; i < 5000; i++) {
                    positions[i * 3] = (Math.random() - 0.5) * Game.systems.terrain.width;
                    positions[i * 3 + 1] = Math.random() * 1000;
                    positions[i * 3 + 2] = (Math.random() - 0.5) * Game.systems.terrain.depth;
                }
                geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
                const material = new THREE.LineBasicMaterial({ color: weatherData.exoticType === 'acid' ? 0x00ff00 : 0x0000ff, opacity: 0.5, transparent: true });
                this.rainParticles = new THREE.LineSegments(geometry, material);
                this.scene.add(this.rainParticles);
            }
            const positions = this.rainParticles.geometry.attributes.position.array;
            for (let i = 0; i < positions.length / 3; i++) {
                positions[i * 3 + 1] -= deltaTime * 50 * weatherData.precipIntensity;
                if (positions[i * 3 + 1] < 0) positions[i * 3 + 1] += 1000;
            }
            this.rainParticles.geometry.attributes.position.needsUpdate = true;
        } else if (this.rainParticles) {
            this.scene.remove(this.rainParticles);
            this.rainParticles = null;
        }

        if (weatherData.cloudCover > 0.3 && !this.cloudGroup) {
            this.cloudGroup = new THREE.Group();
            for (let i = 0; i < 10; i++) {
                const cloud = new THREE.Mesh(
                    new THREE.SphereGeometry(100, 16, 16),
                    new THREE.MeshBasicMaterial({ color: 0xcccccc, transparent: true, opacity: weatherData.cloudCover * 0.5 })
                );
                cloud.position.set((Math.random() - 0.5) * 2000, 800 + Math.random() * 200, (Math.random() - 0.5) * 2000);
                this.cloudGroup.add(cloud);
            }
            this.scene.add(this.cloudGroup);
        } else if (weatherData.cloudCover <= 0.3 && this.cloudGroup) {
            this.scene.remove(this.cloudGroup);
            this.cloudGroup = null;
        }
    }

    updateObjectAnimations() {
        this.objectMeshes.forEach((entry, key) => {
            const { mesh, physicsIndex } = entry;
            if (physicsIndex !== undefined) {
                const state = Game.systems.physics.getObjectState(physicsIndex);
                if (state.active) {
                    mesh.position.set(state.position.x, state.position.y, state.position.z);
                    if (mesh.children.length > 1) {
                        mesh.rotation.z = Math.atan2(state.velocity.x, state.velocity.y) * 0.5;
                    }
                }
            }
        });
    }

    hexToThreeColor(hex) {
        return parseInt(hex.replace('#', '0x'), 16);
    }

    reset() {
        this.scene.children = this.scene.children.filter(c => c === this.terrainMesh || c.type === 'Light');
        this.rodMesh = null;
        this.ejectaMeshes = [];
        this.shockwaveMesh = null;
        this.objectMeshes.clear();
        this.rainParticles = null;
        this.cloudGroup = null;
        this.updateTerrain();
        this.scene.background = new THREE.Color(0x87ceeb);
        this.scene.fog.density = 0;
    }
}

const VisualsInstance = new Visuals();
window.Visuals = VisualsInstance;