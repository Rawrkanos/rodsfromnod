// ejecta.js - Ejected material simulation and animation data

class Ejecta {
    constructor() {
        this.ejectaSimulations = new Map();

        this.debrisTypes = {
            dirt: { massRange: [1, 10], color: '#8b4513', probability: 0.5, degradesTo: null, lifespan: Infinity },
            rock: { massRange: [10, 100], color: '#808080', probability: 0.3, degradesTo: 'dirt', lifespan: 10 },
            flaming: { massRange: [5, 50], color: '#ff4500', probability: 0.1, degradesTo: 'dirt', lifespan: 5 },
            boulder: { massRange: [100, 1000], color: '#696969', probability: 0.05, degradesTo: 'rock', lifespan: 15 },
            flamingBoulder: { massRange: [100, 500], color: '#ff4500', probability: 0.05, degradesTo: 'boulder', lifespan: 7 }
        };

        this.secondaryImpactMassThreshold = 50;
        this.massiveImpactEnergyThreshold = 1e10;

        Game.systems.ejecta = this;
        console.log('Ejecta system initialized');
    }

    processEjecta(impactPhysicsIndex) {
        const impactData = Game.systems.impact.getImpactAnimationData(impactPhysicsIndex);
        if (!impactData || !impactData.ejectaData) return;

        const { x, z, energy, ejectaData } = impactData;
        const rodState = Game.systems.rods.getRodState();
        const weatherEffects = Game.systems.weather ? Game.systems.weather.getWeatherEffects() : { windScale: 1.0, precipitation: 0 };

        const ejectaParticles = this.generateDetailedEjecta(
            ejectaData.debris,
            ejectaData.count,
            ejectaData.energyFraction,
            x,
            z,
            energy,
            rodState,
            weatherEffects
        );

        const particleIndices = ejectaParticles.map(particle => {
            Physics.addObject(particle);
            return Physics.objects.length - 1;
        });

        const trajectories = this.simulateTrajectories(particleIndices, energy, weatherEffects);

        this.ejectaSimulations.set(impactPhysicsIndex, {
            particles: ejectaParticles,
            trajectories,
            secondaryImpacts: [],
            applied: false
        });

        console.log(`Ejecta processed for impact ${impactPhysicsIndex}: ${ejectaParticles.length} particles`);
    }

    generateDetailedEjecta(debris, baseCount, energyFraction, x, z, energy, rodState, weatherEffects) {
        const isMassiveImpact = energy > this.massiveImpactEnergyThreshold;
        const count = isMassiveImpact ? Math.min(200, baseCount * 2) : baseCount;
        const particles = [];
        const impactAngle = Math.atan2(rodState.velocity.x, rodState.velocity.y) || Math.PI / 4;
        const materialStrength = rodState.strength;

        for (let i = 0; i < count; i++) {
            const baseParticle = debris[i % debris.length];
            const typeRoll = Math.random();
            let type = 'dirt';

            if (isMassiveImpact) {
                if (typeRoll < this.debrisTypes.flamingBoulder.probability && energy > 1e11) type = 'flamingBoulder';
                else if (typeRoll < this.debrisTypes.flamingBoulder.probability + this.debrisTypes.boulder.probability * materialStrength) type = 'boulder';
                else if (typeRoll < 0.5) type = 'rock';
                else if (typeRoll < 0.6 && energy > 1e9) type = 'flaming';
            } else {
                if (typeRoll < this.debrisTypes.flaming.probability && energy > 1e9) type = 'flaming';
                else if (typeRoll < this.debrisTypes.flaming.probability + this.debrisTypes.rock.probability * materialStrength) type = 'rock';
            }

            const debrisType = this.debrisTypes[type];
            const mass = debrisType.massRange[0] + Math.random() * (debrisType.massRange[1] - debrisType.massRange[0]);
            const radius = Math.cbrt(mass / (1000 * Math.PI));
            const angle = impactAngle + (Math.random() - 0.5) * Math.PI / 2;
            const speed = (baseParticle.vy * energyFraction * weatherEffects.windScale) + Math.random() * (isMassiveImpact ? 30 : 20);

            particles.push({
                mass,
                area: Math.PI * radius * radius,
                shapeFactor: 1.0,
                x: x + Math.cos(angle) * (isMassiveImpact ? 10 : 5),
                y: Game.systems.terrain.getHeightAt(x, z),
                z: z + Math.sin(angle) * (isMassiveImpact ? 10 : 5),
                vx: Math.cos(angle) * speed * weatherEffects.windScale,
                vy: speed,
                vz: Math.sin(angle) * speed * weatherEffects.windScale,
                type,
                color: debrisType.color,
                active: true,
                lifespan: debrisType.lifespan,
                degradesTo: debrisType.degradesTo,
                timeAlive: 0
            });
        }

        return particles;
    }

    simulateTrajectories(particleIndices, impactEnergy, weatherEffects) {
        const trajectories = [];
        const maxSteps = 1000;
        const timeStep = Physics.timeStep;

        particleIndices.forEach(index => {
            const particle = Physics.getObjectState(index);
            const trajectory = [];
            let step = 0;

            while (particle.active && step < maxSteps) {
                Physics.update();
                const state = Physics.getObjectState(index);

                particle.timeAlive += timeStep;
                if (particle.lifespan < Infinity && particle.timeAlive >= particle.lifespan) {
                    this.degradeParticle(index, particle, weatherEffects);
                }

                trajectory.push({
                    x: state.position.x,
                    y: state.position.y,
                    z: state.position.z,
                    time: step * timeStep,
                    type: particle.type,
                    color: particle.color
                });

                if (!state.active && state.collided && particle.mass >= this.secondaryImpactMassThreshold) {
                    const miniCrater = this.calculateMiniCrater(state, impactEnergy);
                    if (miniCrater) {
                        this.ejectaSimulations.get(particleIndices[0])?.secondaryImpacts.push(miniCrater);
                        Game.systems.terrain.deformTerrain({
                            x: state.position.x,
                            z: state.position.z,
                            energy: miniCrater.energy
                        });
                    }
                }

                step++;
            }

            trajectories.push(trajectory);
        });

        return trajectories;
    }

    degradeParticle(index, particle, weatherEffects) {
        if (!particle.degradesTo || !particle.active) return;

        const newType = this.debrisTypes[particle.degradesTo];
        const massLoss = particle.mass * (particle.type.includes('flaming') ? 0.8 : 0.5);
        particle.mass -= massLoss;
        particle.area = Math.PI * Math.pow(Math.cbrt(particle.mass / (1000 * Math.PI)), 2);
        particle.type = newType.type;
        particle.color = newType.color;
        particle.lifespan = Infinity;
        particle.degradesTo = null;

        if (particle.type === 'dirt' && weatherEffects.precipitation > 0) {
            particle.vy *= 0.9;
        }

        const obj = Physics.objects[index];
        if (obj) {
            obj.mass = particle.mass;
            obj.area = particle.area;
            obj.vy = particle.vy;
        }
    }

    calculateMiniCrater(state, impactEnergy) {
        const energy = state.energy;
        if (energy < 1e6) return null;

        const resistance = Game.systems.terrain.getResistanceAt(state.position.x, state.position.z);
        const radius = Math.min(10, 2 * Math.log10(energy) * (1 - resistance));
        const depth = radius * 0.2;

        return {
            x: state.position.x,
            z: state.position.z,
            energy,
            radius,
            depth,
            impactEnergyFraction: energy / impactEnergy,
            isSecondary: true
        };
    }

    getEjectaAnimationData(impactPhysicsIndex) {
        const sim = this.ejectaSimulations.get(impactPhysicsIndex);
        if (!sim || sim.applied) return null;

        sim.applied = true;
        return {
            particles: sim.particles.map(p => ({
                type: p.type,
                color: p.color,
                initialPosition: { x: p.x, y: p.y, z: p.z }
            })),
            trajectories: sim.trajectories,
            duration: sim.trajectories[0]?.length * Physics.timeStep || 0,
            secondaryImpacts: sim.secondaryImpacts
        };
    }

    getSecondaryImpacts(impactPhysicsIndex) {
        const sim = this.ejectaSimulations.get(impactPhysicsIndex);
        return sim ? sim.secondaryImpacts : [];
    }

    reset() {
        this.ejectaSimulations.clear();
        console.log('Ejecta system reset');
    }
}

const EjectaInstance = new Ejecta();
window.Ejecta = EjectaInstance;