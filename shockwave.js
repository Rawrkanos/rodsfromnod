// shockwave.js - Atmospheric shockwave simulation and damage

class Shockwave {
    constructor() {
        this.shockwaveEvents = new Map();
        this.baseSpeed = 343; // m/s
        this.damageThreshold = 1e6; // J/m²
        this.minAnimationSteps = 10;
        this.maxAnimationSteps = 200;

        Game.systems.shockwave = this;
        console.log('Shockwave system initialized');
    }

    applyShockwave(shockwaveData) {
        const { x, z, radius, intensity, duration, physicsIndex } = shockwaveData;
        if (!physicsIndex) {
            console.error('Shockwave requires physicsIndex');
            return;
        }

        const altitude = Game.systems.terrain.getHeightAt(x, z);
        const density = Game.systems.atmosphere.getDensity(altitude);
        const weatherEffects = Game.systems.weather ? Game.systems.weather.getWeatherEffects() : { windScale: 1.0, precipitation: 0 };
        const speed = this.baseSpeed * (density / 1.225) * (1 + weatherEffects.windScale * 0.1);
        const precipMod = 1 - weatherEffects.precipitation * 0.2;
        const adjustedIntensity = intensity * precipMod;
        const adjustedRadius = radius * (density / 1.225) * precipMod;
        const adjustedDuration = adjustedRadius / speed;

        const terrainData = Game.systems.terrain.getTerrainData();
        const damagedObjects = this.calculateObjectDamage(terrainData.objects, x, z, adjustedRadius, adjustedIntensity);

        const animationData = this.generateAnimationData(x, z, adjustedRadius, adjustedIntensity, adjustedDuration);

        this.shockwaveEvents.set(physicsIndex, {
            x,
            z,
            radius: adjustedRadius,
            intensity: adjustedIntensity,
            duration: adjustedDuration,
            speed,
            damagedObjects,
            animationData,
            applied: false
        });

        Game.systems.terrain.applyShockwave(x, z, adjustedIntensity * density);

        console.log(`Shockwave applied: Radius=${adjustedRadius.toFixed(2)}m, Duration=${adjustedDuration.toFixed(2)}s, Steps=${animationData.steps.length}`);
        return { damagedObjects };
    }

    calculateObjectDamage(objects, x, z, radius, intensity) {
        const damagedObjects = [];
        const radiusSquared = radius * radius;

        const nearbyObjects = objects.filter(obj => {
            const dx = x - obj.x;
            const dz = z - obj.z;
            return (dx * dx + dz * dz) <= radiusSquared && obj.intact;
        });

        nearbyObjects.forEach(obj => {
            const dx = x - obj.x;
            const dz = z - obj.z;
            const distance = Math.sqrt(dx * dx + dz * dz);
            const localIntensity = intensity / (distance * distance + 1);

            if (localIntensity > this.damageThreshold * obj.resistance) {
                obj.intact = false;
                const physicsIndex = this.addToPhysics(obj, localIntensity, x, z, distance);
                damagedObjects.push({
                    x: obj.x,
                    z: obj.z,
                    type: obj.type,
                    physicsIndex,
                    destroyed: true
                });
            } else if (localIntensity > this.damageThreshold * obj.resistance * 0.5) {
                const physicsIndex = this.addToPhysics(obj, localIntensity, x, z, distance);
                damagedObjects.push({
                    x: obj.x,
                    z: obj.z,
                    type: obj.type,
                    physicsIndex,
                    destroyed: false
                });
            }
        });

        return damagedObjects;
    }

    addToPhysics(obj, intensity, x, z, distance) {
        const force = intensity * 0.1;
        const angle = Math.atan2(obj.z - z, obj.x - x);
        const speed = Math.min(50, force / obj.mass);

        const displacedObj = {
            mass: obj.mass,
            area: 0.1,
            shapeFactor: 1.0,
            x: obj.x,
            y: obj.y + obj.height / 2,
            z: obj.z,
            vx: Math.cos(angle) * speed,
            vy: speed * 0.5,
            vz: Math.sin(angle) * speed,
            active: true
        };

        Physics.addObject(displacedObj);
        return Physics.objects.length - 1;
    }

    generateAnimationData(x, z, radius, intensity, duration) {
        const stepCount = Math.min(this.maxAnimationSteps, Math.max(this.minAnimationSteps, Math.ceil(duration / Physics.timeStep)));
        const stepInterval = duration / stepCount;
        const steps = [];
        const speed = radius / duration;

        for (let i = 0; i <= stepCount; i++) {
            const time = i * stepInterval;
            const currentRadius = Math.min(radius, speed * time);
            const currentIntensity = intensity / (currentRadius * currentRadius + 1);

            steps.push({
                time,
                radius: currentRadius,
                intensity: currentIntensity > 0 ? currentIntensity : 0
            });
        }

        return {
            x,
            z,
            steps,
            totalDuration: duration
        };
    }

    getShockwaveAnimationData(physicsIndex) {
        const event = this.shockwaveEvents.get(physicsIndex);
        if (!event || event.applied) return null;

        event.applied = true;
        return {
            x: event.x,
            z: event.z,
            animationSteps: event.animationData.steps,
            duration: event.animationData.totalDuration,
            damagedObjects: event.damagedObjects
        };
    }

    reset() {
        this.shockwaveEvents.clear();
        console.log('Shockwave system reset');
    }
}

const ShockwaveInstance = new Shockwave();
window.Shockwave = ShockwaveInstance;