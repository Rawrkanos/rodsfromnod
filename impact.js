// impact.js - Impact calculations and scoring system

class Impact {
    constructor() {
        this.pendingImpacts = new Map();
        this.baseScoreMultiplier = 0.001;
        this.resistanceBonus = 2.0;
        this.efficiencyBonus = 1.5;
        this.explosionDuration = 2;
        this.shockwaveSpeed = 343;

        Game.systems.impact = this;
        console.log('Impact system initialized');
    }

    preCalculateImpact(data) {
        const { x, z, energy, physicsIndex } = data;
        const terrainResistance = Game.systems.terrain.getResistanceAt(x, z);
        const rodState = Game.systems.rods.getRodState();

        const craterRadius = 0.015 * Math.pow(energy, 1 / 3.4) * (1 - terrainResistance);
        const craterDepth = craterRadius * 0.15;
        const explosionRadius = craterRadius * 0.5;
        const explosionEnergy = energy * 0.3;

        const weatherMod = Game.systems.weather ? Game.systems.weather.getWeatherEffects().windScale : 1.0;
        const materialBonus = rodState.strength;
        const efficiency = energy / rodState.mass;
        const explosionMultiplier = Game.systems.upgrades ? Game.systems.upgrades.getExplosionMultiplier() : 1.0;
        const score = (energy / 1000) * this.baseScoreMultiplier * 
                      (1 + terrainResistance * this.resistanceBonus) * 
                      weatherMod * materialBonus * 
                      (1 + Math.min(1, efficiency / 1e6) * this.efficiencyBonus) * 
                      explosionMultiplier;

        const ejectaData = this.calculateEjecta(energy, x, z, terrainResistance, rodState);
        const shockwaveData = this.calculateShockwave(energy, x, z, physicsIndex);

        this.pendingImpacts.set(physicsIndex, {
            x,
            z,
            energy,
            craterRadius,
            craterDepth,
            explosionRadius,
            explosionEnergy,
            score,
            ejectaData,
            shockwaveData,
            applied: false
        });

        Game.systems.terrain.preCalculateImpact({ x, z, energy, physicsIndex });
    }

    handleImpact(rodState) {
        const physicsIndex = Game.systems.physics.objects.indexOf(Physics.objects.find(obj => obj === rodState));
        const impactData = this.pendingImpacts.get(physicsIndex);

        if (!impactData || impactData.applied) {
            this.preCalculateImpact({
                x: rodState.position.x,
                z: rodState.position.z,
                energy: rodState.energy,
                physicsIndex
            });
            return this.handleImpact(rodState);
        }

        Game.systems.terrain.deformTerrain({
            x: impactData.x,
            z: impactData.z,
            energy: impactData.energy
        });

        if (Game.systems.shockwave) {
            Game.systems.shockwave.applyShockwave(impactData.shockwaveData);
        }
        if (Game.systems.ejecta) {
            Game.systems.ejecta.processEjecta(physicsIndex);
        }

        Game.updateGameState({ score: Game.gameState.score + impactData.score });
        impactData.applied = true;

        const weatherMod = Game.systems.weather ? Game.systems.weather.getWeatherEffects().windScale : 1.0;
        return {
            energy: impactData.energy,
            craterRadius: impactData.craterRadius,
            craterDepth: impactData.craterDepth,
            score: impactData.score,
            scoreBreakdown: {
                base: impactData.energy / 1000 * this.baseScoreMultiplier,
                resistanceBonus: impactData.score * this.resistanceBonus,
                weatherBonus: impactData.score * weatherMod,
                efficiencyBonus: impactData.score * Math.min(1, (impactData.energy / rodState.mass) / 1e6) * this.efficiencyBonus
            }
        };
    }

    calculateEjecta(energy, x, z, resistance, rodState) {
        const ejectaCount = Math.min(100, Math.floor(energy / 1e6));
        const ejecta = Game.systems.terrain.getDebris({ x, z, energy });
        const ejectaEnergyFraction = 0.1 * (1 - resistance) * rodState.strength;
        return {
            count: ejectaCount,
            debris: ejecta,
            energyFraction: ejectaEnergyFraction
        };
    }

    calculateShockwave(energy, x, z, physicsIndex) {
        const radius = Math.sqrt(energy / 1e5);
        const intensity = energy / (4 * Math.PI * radius * radius);
        return {
            x,
            z,
            radius,
            intensity,
            duration: radius / this.shockwaveSpeed,
            physicsIndex
        };
    }

    getImpactAnimationData(physicsIndex) {
        const impactData = this.pendingImpacts.get(physicsIndex);
        if (!impactData || !impactData.applied) return null;

        return {
            x: impactData.x,
            z: impactData.z,
            energy: impactData.energy,
            craterRadius: impactData.craterRadius,
            craterDepth: impactData.craterDepth,
            explosionRadius: impactData.explosionRadius,
            explosionEnergy: impactData.explosionEnergy,
            explosionDuration: this.explosionDuration,
            ejectaData: impactData.ejectaData,
            shockwaveData: impactData.shockwaveData
        };
    }

    reset() {
        this.pendingImpacts.clear();
        console.log('Impact system reset');
    }
}

const ImpactInstance = new Impact();
window.Impact = ImpactInstance;