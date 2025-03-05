// physics.js - Core physics engine for the Rod Impact Simulator

class PhysicsEngine {
    constructor() {
        this.gravity = 9.81; // m/s²
        this.planetRadius = 6371000; // meters (Earth radius)
        this.atmosphericDensity = 1.225; // kg/m³ (sea level, Earth)
        this.objects = [];
        this.timeStep = 0.016; // ~60 FPS, seconds per frame
        this.globalTime = 0;
    }

    init(gravity = 9.81, planetRadius = 6371000, atmosphericDensity = 1.225) {
        this.gravity = gravity;
        this.planetRadius = planetRadius;
        this.atmosphericDensity = atmosphericDensity;
        console.log(`Physics initialized: Gravity=${this.gravity} m/s², Radius=${this.planetRadius} m, Density=${this.atmosphericDensity} kg/m³`);
    }

    addObject(obj, isOrbital = false, height = 0) {
        const newObj = {
            mass: obj.mass || 1,
            position: { x: obj.x || 0, y: isOrbital ? height : (obj.y || 0), z: obj.z || 0 },
            velocity: { x: obj.vx || 0, y: obj.vy || 0, z: obj.vz || 0 },
            acceleration: { x: 0, y: 0, z: 0 },
            area: obj.area || 1,
            shapeFactor: obj.shapeFactor || 1,
            isActive: true,
            energy: 0,
            momentum: { x: 0, y: 0, z: 0 },
            collided: false
        };
        this.objects.push(newObj);
        this.updateEnergy(this.objects.length - 1);
        return this.objects.length - 1; // Return index
    }

    update() {
        this.globalTime += this.timeStep;

        for (let i = 0; i < this.objects.length; i++) {
            if (!this.objects[i].isActive) continue;

            this.objects[i].acceleration = { x: 0, y: 0, z: 0 };
            this.applyGravity(i);
            this.applyForces(i);
            this.updateKinematics(i);
            this.checkCollisions(i);
            this.updateEnergy(i);
            this.updateMomentum(i);
        }

        this.objects = this.objects.filter(obj => obj.isActive);
    }

    applyGravity(index) {
        const obj = this.objects[index];
        const altitude = obj.position.y;
        const gravityAtAltitude = this.gravity * Math.pow(this.planetRadius / (this.planetRadius + altitude), 2);
        obj.acceleration.y -= gravityAtAltitude;
    }

    applyForce(index, force) {
        const obj = this.objects[index];
        obj.acceleration.x += force.x / obj.mass;
        obj.acceleration.y += force.y / obj.mass;
        obj.acceleration.z += force.z / obj.mass;
    }

    updateKinematics(index) {
        const obj = this.objects[index];
        obj.velocity.x += obj.acceleration.x * this.timeStep;
        obj.velocity.y += obj.acceleration.y * this.timeStep;
        obj.velocity.z += obj.acceleration.z * this.timeStep;

        obj.position.x += obj.velocity.x * this.timeStep;
        obj.position.y += obj.velocity.y * this.timeStep;
        obj.position.z += obj.velocity.z * this.timeStep;

        if (obj.position.y <= 0) {
            obj.position.y = 0;
            obj.isActive = false;
            obj.collided = true;
        }
    }

    checkCollisions(index) {
        const obj = this.objects[index];
        if (obj.position.y <= 0 && !obj.collided) {
            obj.velocity.y = 0;
            obj.isActive = false;
            obj.collided = true;
        }
    }

    updateEnergy(index) {
        const obj = this.objects[index];
        const speed = Math.sqrt(obj.velocity.x * obj.velocity.x + obj.velocity.y * obj.velocity.y + obj.velocity.z * obj.velocity.z);
        obj.energy = 0.5 * obj.mass * speed * speed;
    }

    updateMomentum(index) {
        const obj = this.objects[index];
        obj.momentum.x = obj.mass * obj.velocity.x;
        obj.momentum.y = obj.mass * obj.velocity.y;
        obj.momentum.z = obj.mass * obj.velocity.z;
    }

    getObjectState(index) {
        return { ...this.objects[index] };
    }

    getAtmosphericDensity(altitude) {
        const scaleHeight = 8000;
        return this.atmosphericDensity * Math.exp(-altitude / scaleHeight);
    }

    getAerodynamicHeating(index) {
        const obj = this.objects[index];
        const speed = Math.sqrt(obj.velocity.x * obj.velocity.x + obj.velocity.y * obj.velocity.y + obj.velocity.z * obj.velocity.z);
        const density = this.getAtmosphericDensity(obj.position.y);
        return 0.5 * density * Math.pow(speed, 3) * obj.area * obj.shapeFactor;
    }

    reset() {
        this.objects = [];
        this.globalTime = 0;
    }

    // Placeholder for deOrbit (used by game.js and rods.js)
    deOrbit(index, factor) {
        if (this.objects[index]) {
            this.objects[index].vy = -Math.sqrt(2 * this.gravity * this.objects[index].position.y) * factor;
        }
    }
}

const Physics = new PhysicsEngine();
window.Physics = Physics;