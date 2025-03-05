// rods.js - Rod properties and mechanics

class Rods {
    constructor() {
        this.materials = {
            wood: { density: 700, strength: 0.15, color: '#8b4513', unlockUpgrade: 0 },
            pvc: { density: 1380, strength: 0.2, color: '#f0f0f0', unlockUpgrade: 1 },
            aluminum: { density: 2700, strength: 0.3, color: '#d3d3d3', unlockUpgrade: 3 },
            titanium: { density: 4500, strength: 0.6, color: '#b0c4de', unlockUpgrade: 5 },
            steel: { density: 7850, strength: 0.5, color: '#a9a9a9', unlockPrestige: 1 },
            lead: { density: 11340, strength: 0.4, color: '#696969', unlockPrestige: 5 },
            tungsten: { density: 19250, strength: 0.9, color: '#4a4a4a', unlockPrestige: 10 },
            osmium: { density: 22590, strength: 0.85, color: '#2f4f4f', unlockAscension: 1 },
            unobtanium: { density: 50000, strength: 0.95, color: '#00ced1', unlockAscension: 5 },
            neutronium: { density: 1e6, strength: 0.98, color: '#ff00ff', unlockAscension: 15 },
            hyperdense: { density: 1e8, strength: 1.0, color: '#ffd700', unlockAscension: 50 }
        };

        this.currentRod = null;
        this.finalImpactForce = 0;

        Game.systems.rods = this;
        console.log('Rods initialized');
    }

    createRod() {
        const upgradeData = Game.systems.upgrades.getRodUpgradeData();
        const material = this.materials[upgradeData.material];
        const length = upgradeData.length;
        const radius = upgradeData.radius;
        const volume = Math.PI * radius * radius * length;
        const mass = material.density * volume;

        this.currentRod = {
            mass,
            area: Math.PI * radius * radius,
            shapeFactor: upgradeData.shapeFactor,
            material: upgradeData.material,
            length,
            radius,
            strength: material.strength,
            x: Game.canvas.width / 2,
            y: Game.gameState.launchHeight,
            z: Game.canvas.height / 2,
            vx: 0,
            vy: 0,
            vz: 0
        };

        this.preCalculateImpactForce();
        return this.currentRod;
    }

    isMaterialUnlocked(material, upgradeLevel, prestigeLevel, ascensionLevel) {
        return (
            (material.unlockUpgrade !== undefined && upgradeLevel >= material.unlockUpgrade) ||
            (material.unlockPrestige !== undefined && prestigeLevel >= material.unlockPrestige) ||
            (material.unlockAscension !== undefined && ascensionLevel >= material.unlockAscension)
        );
    }

    preCalculateImpactForce() {
        const physicsIndex = Physics.objects.length;
        Physics.addObject(this.currentRod, Game.gameState.isOrbitalPhase, Game.gameState.launchHeight);
        if (Game.gameState.isOrbitalPhase) {
            setTimeout(() => Physics.deOrbit(physicsIndex, 0.1), 1000);
        }

        const trajectory = Game.systems.atmosphere.preCalculateTrajectory(physicsIndex);
        const finalState = trajectory[trajectory.length - 1];
        this.finalImpactForce = finalState.energy;

        if (Game.systems.impact) {
            Game.systems.impact.preCalculateImpact({
                x: finalState.position.x,
                z: finalState.position.z,
                energy: this.finalImpactForce,
                physicsIndex
            });
        }
        if (Game.systems.terrain) {
            Game.systems.terrain.preCalculateImpact({
                x: finalState.position.x,
                z: finalState.position.z,
                energy: this.finalImpactForce,
                physicsIndex
            });
        }

        console.log(`Rod pre-calculated: Material=${this.currentRod.material}, Mass=${this.currentRod.mass.toFixed(2)}kg, Final Impact Force=${this.finalImpactForce.toExponential(2)} J`);
    }

    getRodState() {
        return { ...this.currentRod, finalImpactForce: this.finalImpactForce };
    }

    checkDegradation(velocity) {
        const speed = Math.sqrt(velocity.x ** 2 + velocity.y ** 2 + velocity.z ** 2);
        const threshold = 1000;
        if (speed > threshold && this.currentRod.strength < 0.8) {
            return {
                degraded: true,
                massLoss: this.currentRod.mass * 0.5,
                newShapeFactor: this.currentRod.shapeFactor * 1.5
            };
        }
        return { degraded: false };
    }

    applyDegradation(physicsIndex, degradation) {
        const obj = Physics.objects[physicsIndex];
        if (obj && degradation.degraded) {
            obj.mass -= degradation.massLoss;
            obj.shapeFactor = degradation.newShapeFactor;
            this.currentRod.mass = obj.mass;
            this.currentRod.shapeFactor = obj.shapeFactor;
            console.log(`Rod degraded: Mass=${obj.mass}kg, ShapeFactor=${obj.shapeFactor}`);
        }
    }

    reset() {
        this.currentRod = null;
        this.finalImpactForce = 0;
    }

    getAvailableMaterials() {
        const upgradeLevel = Game.gameState.upgradeLevel || 0;
        const prestigeLevel = Game.gameState.prestigeLevel || 0;
        const ascensionLevel = Game.gameState.ascensionLevel || 0;
        return Object.entries(this.materials)
            .filter(([_, mat]) => this.isMaterialUnlocked(mat, upgradeLevel, prestigeLevel, ascensionLevel))
            .map(([name, mat]) => ({ name, ...mat }));
    }
}

const RodsInstance = new Rods();
window.Rods = RodsInstance;