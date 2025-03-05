// terrain.js - Dynamically sized terrain generation and impact handling

class Terrain {
    constructor() {
        this.baseSize = 10;
        this.width = this.baseSize;
        this.depth = this.baseSize;
        this.gridSize = 10;
        this.gridWidth = Math.floor(this.width / this.gridSize);
        this.gridDepth = Math.floor(this.depth / this.gridSize);

        this.heightMap = [];
        this.densityMap = [];
        this.typeMap = [];
        this.objects = [];
        this.pendingImpacts = [];

        this.terrainTypes = {
            grass: { density: 500, resistance: 0.2, color: '#00ff00' },
            dirt: { density: 1500, resistance: 0.5, color: '#8b4513' },
            rock: { density: 2500, resistance: 0.9, color: '#808080' }
        };

        this.objectTypes = {
            tree: { mass: 1000, height: 10, resistance: 0.3, debrisMass: 100 },
            rock: { mass: 5000, height: 2, resistance: 0.8, debrisMass: 500 }
        };

        this.initializeTerrain();
        Game.systems.terrain = this;
    }

    initializeTerrain() {
        this.updateTerrainSize();

        for (let x = 0; x < this.gridWidth; x++) {
            this.heightMap[x] = [];
            this.densityMap[x] = [];
            this.typeMap[x] = [];
            for (let z = 0; z < this.gridDepth; z++) {
                const noise = Math.sin(x * 0.1) * Math.cos(z * 0.1) * 50 + 50;
                this.heightMap[x][z] = Math.max(0, noise);
                const typeRoll = Math.random();
                if (noise < 20) this.typeMap[x][z] = 'dirt';
                else if (noise < 60) this.typeMap[x][z] = 'grass';
                else this.typeMap[x][z] = 'rock';
                this.densityMap[x][z] = this.terrainTypes[this.typeMap[x][z]].density;
            }
        }

        const objectDensity = 0.005;
        const objectCount = Math.floor(this.width * this.depth * objectDensity);
        this.objects = [];
        for (let i = 0; i < objectCount; i++) {
            const x = Math.random() * this.width;
            const z = Math.random() * this.depth;
            const type = Math.random() < 0.7 ? 'tree' : 'rock';
            this.objects.push({
                type,
                x,
                z,
                y: this.getHeightAt(x, z),
                mass: this.objectTypes[type].mass,
                height: this.objectTypes[type].height,
                resistance: this.objectTypes[type].resistance,
                intact: true
            });
        }

        console.log(`Terrain initialized: ${this.width}x${this.depth}m, ${this.gridWidth}x${this.gridDepth} grid, ${this.objects.length} objects`);
    }

    updateTerrainSize() {
        if (!Game.gameState) return;
        const level = Game.gameState.upgradeLevel;
        const isOrbital = Game.gameState.isOrbitalPhase;

        if (isOrbital) {
            this.width = 10000;
            this.depth = 10000;
            this.gridSize = 50;
        } else if (level > 5) {
            this.width = 1000;
            this.depth = 1000;
            this.gridSize = 20;
        } else {
            this.width = this.baseSize;
            this.depth = this.baseSize;
            this.gridSize = 10;
        }

        this.gridWidth = Math.floor(this.width / this.gridSize);
        this.gridDepth = Math.floor(this.depth / this.gridSize);
    }

    getHeightAt(x, z) {
        const gridX = Math.floor(x / this.gridSize);
        const gridZ = Math.floor(z / this.gridSize);
        if (gridX < 0 || gridX >= this.gridWidth || gridZ < 0 || gridZ >= this.gridDepth) return 0;
        return this.heightMap[gridX][gridZ];
    }

    getResistanceAt(x, z) {
        const gridX = Math.floor(x / this.gridSize);
        const gridZ = Math.floor(z / this.gridSize);
        if (gridX < 0 || gridX >= this.gridWidth || gridZ < 0 || gridZ >= this.gridDepth) return 0.5;
        return this.terrainTypes[this.typeMap[gridX][gridZ]].resistance;
    }

    checkCollisions(physicsObj) {
        this.updateTerrainSize();
        const pos = physicsObj.position;
        const terrainHeight = this.getHeightAt(pos.x, pos.z);
        if (pos.y <= terrainHeight) {
            physicsObj.position.y = terrainHeight;
            physicsObj.velocity.y = 0;
            physicsObj.isActive = false;
            physicsObj.collided = true;
            const impact = this.pendingImpacts.find(p => p.physicsIndex === Game.systems.physics.objects.indexOf(physicsObj));
            if (impact) {
                this.applyPendingImpact(impact);
                this.pendingImpacts = this.pendingImpacts.filter(p => p !== impact);
            }
            return { hit: true, resistance: this.getResistanceAt(pos.x, pos.z) };
        }
        for (let obj of this.objects) {
            if (!obj.intact) continue;
            const dx = pos.x - obj.x;
            const dz = pos.z - obj.z;
            const distance = Math.sqrt(dx * dx + dz * dz);
            if (distance < 5 && pos.y <= obj.y + obj.height) {
                physicsObj.isActive = false;
                physicsObj.collided = true;
                obj.intact = false;
                return { hit: true, resistance: obj.resistance, object: obj };
            }
        }
        return { hit: false };
    }

    preCalculateImpact(impactData) {
        const { x, z, energy, physicsIndex } = impactData;
        const resistance = this.getResistanceAt(x, z);
        const radius = Math.sqrt(energy / (1e6 * resistance));
        const depth = energy / (1e7 * resistance);

        const crater = {
            x,
            z,
            radius,
            depth,
            resistance,
            affectedCells: [],
            destroyedObjects: [],
            physicsIndex
        };

        const isLarge = radius > 100;
        const gridRadius = Math.ceil(radius / this.gridSize);
        for (let dx = -gridRadius; dx <= gridRadius; dx++) {
            for (let dz = -gridRadius; dz <= gridRadius; dz++) {
                const tx = Math.floor(x / this.gridSize) + dx;
                const tz = Math.floor(z / this.gridSize) + dz;
                if (tx < 0 || tx >= this.gridWidth || tz < 0 || tz >= this.gridDepth) continue;
                const distance = Math.sqrt(dx * dx + dz * dz) * this.gridSize;
                if (distance <= radius) {
                    const reduction = depth * (1 - distance / radius) * (1 - this.getResistanceAt(tx * this.gridSize, tz * this.gridSize));
                    crater.affectedCells.push({ x: tx, z: tz, reduction });
                }
            }
        }

        this.preCalculateShockwave(crater);
        this.pendingImpacts.push(crater);
        console.log(`Pre-calculated crater: radius=${radius}m, depth=${depth}m, cells=${crater.affectedCells.length}`);
    }

    applyPendingImpact(impact) {
        for (let cell of impact.affectedCells) {
            this.heightMap[cell.x][cell.z] = Math.max(0, this.heightMap[cell.x][cell.z] - cell.reduction);
            this.typeMap[cell.x][cell.z] = 'dirt';
            this.densityMap[cell.x][cell.z] = this.terrainTypes.dirt.density;
        }
        for (let obj of impact.destroyedObjects) {
            obj.intact = false;
        }
    }

    getDebris(impact) {
        const { x, z, energy } = impact;
        const resistance = this.getResistanceAt(x, z);
        const debrisCount = Math.min(100, Math.floor(energy / 1e6));
        const debris = [];
        for (let i = 0; i < debrisCount; i++) {
            const angle = Math.random() * 2 * Math.PI;
            const speed = Math.random() * 50 * (1 - resistance);
            debris.push({
                mass: 10 + Math.random() * 100 * (1 - resistance),
                x: x + Math.cos(angle) * 5,
                y: this.getHeightAt(x, z),
                z: z + Math.sin(angle) * 5,
                vx: Math.cos(angle) * speed,
                vy: 10 + Math.random() * 20,
                vz: Math.sin(angle) * speed
            });
        }
        return debris;
    }

    preCalculateShockwave(crater) {
        const { x, z, energy } = crater;
        const radius = Math.sqrt(energy / 1e5);
        for (let obj of this.objects) {
            if (!obj.intact) continue;
            const dx = x - obj.x;
            const dz = z - obj.z;
            const distance = Math.sqrt(dx * dx + dz * dz);
            if (distance <= radius) {
                const force = (energy / 1e6) * (1 - distance / radius);
                if (force > obj.resistance * 100) {
                    crater.destroyedObjects.push(obj);
                }
            }
        }
    }

    getTerrainData() {
        return {
            heightMap: this.heightMap,
            typeMap: this.typeMap,
            objects: this.objects,
            gridSize: this.gridSize,
            width: this.width,
            depth: this.depth,
            terrainTypes: this.terrainTypes,
            objectTypes: this.objectTypes
        };
    }

    applyShockwave(x, z, intensity) {
        // Placeholder for shockwave effects (called by shockwave.js)
    }

    reset() {
        this.objects = [];
        this.pendingImpacts = [];
        this.initializeTerrain();
    }
}

const TerrainInstance = new Terrain();
window.Terrain = TerrainInstance;