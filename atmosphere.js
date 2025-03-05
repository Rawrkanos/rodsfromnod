// atmosphere.js - Atmospheric physics simulation with enhanced flexibility

class Atmosphere {
    constructor() {
        this.planetRadius = 6371000;
        this.rotationPeriod = 86400;
        this.atmosphericScaleHeight = 8000;
        this.surfaceDensity = 1.225;

        this.layers = this.initializeDefaultLayers();
        this.windField = this.initializeWindField();
        this.weatherModifiers = { density: 1.0, windScale: 1.0 };

        this.upgradeModifiers = {
            dragReduction: 1.0,
            windResistance: 1.0,
            coriolisReduction: 1.0
        };

        Game.systems.atmosphere = this;
        console.log('Atmosphere initialized with Earth defaults');
    }

    initializeDefaultLayers() {
        return [
            { name: 'Troposphere', minAlt: 0, maxAlt: 12000, densityFactor: 1.0, windBase: 5, windMax: 20 },
            { name: 'Stratosphere', minAlt: 12000, maxAlt: 50000, densityFactor: 0.1, windBase: 10, windMax: 50 },
            { name: 'Mesosphere', minAlt: 50000, maxAlt: 85000, densityFactor: 0.01, windBase: 5, windMax: 30 },
            { name: 'Thermosphere', minAlt: 85000, maxAlt: 600000, densityFactor: 0.0001, windBase: 2, windMax: 10 },
            { name: 'Exosphere', minAlt: 600000, maxAlt: Infinity, densityFactor: 0.000001, windBase: 0, windMax: 1 }
        ];
    }

    init(surfaceDensity = 1.225, scaleHeight = 8000, radius = 6371000, rotationPeriod = 86400, customLayers = null) {
        this.surfaceDensity = surfaceDensity;
        this.atmosphericScaleHeight = scaleHeight;
        this.planetRadius = radius;
        this.rotationPeriod = rotationPeriod;
        this.layers = customLayers || this.initializeDefaultLayers();
        this.windField = this.initializeWindField();
        this.weatherModifiers = { density: 1.0, windScale: 1.0 };
        console.log(`Atmosphere reset: Density=${surfaceDensity}, ScaleHeight=${scaleHeight}, Radius=${radius}, Rotation=${rotationPeriod}, Layers=${this.layers.length}`);
    }

    initializeWindField() {
        const wind = {};
        this.layers.forEach(layer => {
            wind[layer.name] = {
                speed: layer.windBase + Math.random() * (layer.windMax - layer.windBase),
                direction: Math.random() * 2 * Math.PI,
                variability: Math.random() * 0.1,
                gust: { active: false, magnitude: 0, duration: 0 }
            };
        });
        return wind;
    }

    updateWindField(deltaTime) {
        this.layers.forEach(layer => {
            const wind = this.windField[layer.name];
            wind.direction += wind.variability * deltaTime * (Math.random() - 0.5);
            wind.speed = Math.max(layer.windBase, Math.min(layer.windMax, wind.speed + (Math.random() - 0.5) * deltaTime));

            if (wind.gust.active) {
                wind.gust.duration -= deltaTime;
                if (wind.gust.duration <= 0) wind.gust.active = false;
            }
        });
    }

    applyWeatherEffects(modifiers) {
        this.weatherModifiers.density = modifiers.density || 1.0;
        this.weatherModifiers.windScale = modifiers.windScale || 1.0;
        if (modifiers.gusts) {
            this.layers.forEach(layer => {
                const wind = this.windField[layer.name];
                if (Math.random() < modifiers.gusts.chance) {
                    wind.gust = {
                        active: true,
                        magnitude: modifiers.gusts.magnitude,
                        duration: modifiers.gusts.duration
                    };
                }
            });
        }
    }

    applyUpgradeEffects(modifiers) {
        this.upgradeModifiers.dragReduction = modifiers.dragReduction || 1.0;
        this.upgradeModifiers.windResistance = modifiers.windResistance || 1.0;
        this.upgradeModifiers.coriolisReduction = modifiers.coriolisReduction || 1.0;
    }

    getDensity(altitude) {
        const baseDensity = this.surfaceDensity * Math.exp(-altitude / this.atmosphericScaleHeight);
        const layer = this.getLayer(altitude);
        return baseDensity * layer.densityFactor * this.weatherModifiers.density;
    }

    getLayer(altitude) {
        return this.layers.find(layer => altitude >= layer.minAlt && altitude <= layer.maxAlt) || this.layers[this.layers.length - 1];
    }

    calculateForces(obj) {
        const altitude = obj.position.y;
        const density = this.getDensity(altitude);
        const wind = this.getWind(altitude);

        const relativeVelocity = {
            x: obj.velocity.x - wind.x * this.upgradeModifiers.windResistance,
            y: obj.velocity.y - wind.y,
            z: obj.velocity.z - wind.z * this.upgradeModifiers.windResistance
        };
        const speed = Math.sqrt(relativeVelocity.x ** 2 + relativeVelocity.y ** 2 + relativeVelocity.z ** 2);
        const dragMagnitude = 0.5 * density * speed * speed * obj.area * obj.shapeFactor * this.upgradeModifiers.dragReduction;
        const dragDirection = {
            x: -relativeVelocity.x / (speed || 1),
            y: -relativeVelocity.y / (speed || 1),
            z: -relativeVelocity.z / (speed || 1)
        };
        const dragForce = {
            x: dragMagnitude * dragDirection.x,
            y: dragMagnitude * dragDirection.y,
            z: dragMagnitude * dragDirection.z
        };

        const coriolisForce = this.calculateCoriolisForce(obj);

        return {
            x: dragForce.x + coriolisForce.x,
            y: dragForce.y + coriolisForce.y,
            z: dragForce.z + coriolisForce.z
        };
    }

    getWind(altitude) {
        const layer = this.getLayer(altitude);
        const wind = this.windField[layer.name];
        const baseSpeed = wind.speed * this.weatherModifiers.windScale;
        const gustSpeed = wind.gust.active ? wind.gust.magnitude : 0;
        const totalSpeed = baseSpeed + gustSpeed;
        return {
            x: totalSpeed * Math.cos(wind.direction),
            y: 0,
            z: totalSpeed * Math.sin(wind.direction)
        };
    }

    calculateCoriolisForce(obj) {
        const omega = 2 * Math.PI / this.rotationPeriod;
        const mass = obj.mass;
        const velocity = obj.velocity;
        const coriolis = {
            x: 2 * mass * omega * velocity.z,
            y: 0,
            z: -2 * mass * omega * velocity.x
        };
        const scale = Game.gameState.isOrbitalPhase ? 0.1 : 0.01;
        return {
            x: coriolis.x * scale * this.upgradeModifiers.coriolisReduction,
            y: coriolis.y * scale * this.upgradeModifiers.coriolisReduction,
            z: coriolis.z * scale * this.upgradeModifiers.coriolisReduction
        };
    }

    getTerminalVelocity(obj) {
        const density = this.getDensity(obj.position.y);
        const g = Physics.gravity * Math.pow(this.planetRadius / (this.planetRadius + obj.position.y), 2);
        return Math.sqrt((2 * obj.mass * g) / (density * obj.area * obj.shapeFactor * this.upgradeModifiers.dragReduction));
    }

    preCalculateTrajectory(physicsIndex) {
        const obj = Physics.getObjectState(physicsIndex);
        const trajectory = [];
        let currentState = { ...obj };
        const timeStep = Physics.timeStep;
        const maxSteps = 10000;

        for (let i = 0; i < maxSteps && currentState.isActive; i++) {
            const forces = this.calculateForces(currentState);
            const acceleration = {
                x: forces.x / currentState.mass,
                y: forces.y / currentState.mass - Physics.gravity * Math.pow(this.planetRadius / (this.planetRadius + currentState.position.y), 2),
                z: forces.z / currentState.mass
            };

            currentState.velocity.x += acceleration.x * timeStep;
            currentState.velocity.y += acceleration.y * timeStep;
            currentState.velocity.z += acceleration.z * timeStep;

            currentState.position.x += currentState.velocity.x * timeStep;
            currentState.position.y += currentState.velocity.y * timeStep;
            currentState.position.z += currentState.velocity.z * timeStep;

            if (currentState.position.y <= Game.systems.terrain.getHeightAt(currentState.position.x, currentState.position.z)) {
                currentState.isActive = false;
                currentState.collided = true;
            }

            trajectory.push({
                time: i * timeStep,
                position: { ...currentState.position },
                velocity: { ...currentState.velocity },
                energy: 0.5 * currentState.mass * (currentState.velocity.x ** 2 + currentState.velocity.y ** 2 + currentState.velocity.z ** 2)
            });
        }

        return trajectory;
    }

    update(deltaTime) {
        this.updateWindField(deltaTime);
    }

    getAtmosphereData() {
        return {
            layers: this.layers,
            windField: this.windField,
            surfaceDensity: this.surfaceDensity,
            scaleHeight: this.atmosphericScaleHeight,
            weatherModifiers: this.weatherModifiers,
            upgradeModifiers: this.upgradeModifiers
        };
    }
}

const AtmosphereInstance = new Atmosphere();
window.Atmosphere = AtmosphereInstance;