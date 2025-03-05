// game.js - Core game logic and system coordinator

const Game = {
    canvas: null,
    uiContainer: null,
    ctx: null,
    isRunning: false,
    lastTime: 0,
    globalTime: 0,
    rodFallSpeedMultiplier: 1,
    impactTime: null,
    gameState: {
        score: 0,
        totalScorePerPrestige: 0,
        totalScorePerAscension: 0,
        totalScoreOverall: 0,
        prestigePoints: 0,
        ascensionPoints: 0,
        totalEnergy: 0,
        currentRodIndex: -1,
        launchHeight: 10,
        upgradeLevel: 0,
        prestigeLevel: 0,
        ascensionLevel: 0,
        isOrbitalPhase: false
    },

    systems: {
        physics: null,
        terrain: null,
        atmosphere: null,
        weather: null,
        rods: null,
        impact: null,
        ejecta: null,
        shockwave: null,
        visuals: null,
        upgrades: null,
        prestige: null,
        ascension: null,
        saves: null,
        options: null,
        stats: null,
        pip: null,
        ui: null
    },

    init(canvas, uiContainer) {
        this.canvas = canvas;
        this.uiContainer = uiContainer;
        this.ctx = canvas.getContext('2d');

        this.systems.physics = window.Physics;
        this.systems.physics.init(9.81, 6371000, 1.225);

        this.initializeSystems();

        this.isRunning = true;
        this.lastTime = performance.now();
        this.globalTime = 0;
        requestAnimationFrame(this.gameLoop.bind(this));

        this.setupInputs();

        console.log('Game initialized with canvas size:', canvas.width, 'x', canvas.height);
    },

    initializeSystems() {},

    gameLoop(currentTime) {
        if (!this.isRunning) return;

        const deltaTime = (currentTime - this.lastTime) / 1000;
        this.lastTime = currentTime;
        this.globalTime += deltaTime;

        this.update(deltaTime);
        this.render();

        requestAnimationFrame(this.gameLoop.bind(this));
    },

    update(deltaTime) {
        let physicsDeltaTime = deltaTime * this.rodFallSpeedMultiplier;
        if (this.gameState.currentRodIndex >= 0 && this.impactTime) {
            const timeToImpact = this.impactTime - this.globalTime;
            if (timeToImpact <= 5) {
                this.rodFallSpeedMultiplier = 1;
                physicsDeltaTime = deltaTime;
            }
        }
        this.systems.physics.update(physicsDeltaTime);

        if (this.gameState.currentRodIndex >= 0) {
            const rodState = this.systems.physics.getObjectState(this.gameState.currentRodIndex);
            if (rodState.collided) {
                const impactResult = this.systems.impact.handleImpact(rodState);
                this.gameState.score += impactResult.score;
                this.gameState.totalScorePerPrestige += impactResult.score;
                this.gameState.totalScorePerAscension += impactResult.score;
                this.gameState.totalScoreOverall += impactResult.score;
                this.gameState.totalEnergy += impactResult.energy;
                this.gameState.currentRodIndex = -1;
                this.impactTime = null;
                this.rodFallSpeedMultiplier = 1;
                this.updateProgression();
            }
        }

        if (this.systems.atmosphere) {
            this.applyAtmosphericForces();
        }

        if (this.systems.weather) {
            this.systems.weather.update(deltaTime);
        }

        if (this.systems.ui) this.systems.ui.updateUI(this.gameState);
        if (this.systems.stats) this.systems.stats.updateStats(this.getCurrentStats());
    },

    render() {
        if (this.systems.visuals) {
            this.systems.visuals.render();
        } else {
            this.renderTemporary();
        }
    },

    renderTemporary() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.fillStyle = 'green';
        this.ctx.fillRect(0, this.canvas.height - 50, this.canvas.width, 50);
        if (this.gameState.currentRodIndex >= 0) {
            const rod = this.systems.physics.getObjectState(this.gameState.currentRodIndex);
            const scale = this.gameState.isOrbitalPhase ? 100000 : this.gameState.launchHeight;
            const yPos = this.canvas.height - 50 - (rod.position.y / scale * (this.canvas.height - 50));
            this.ctx.fillStyle = 'gray';
            this.ctx.fillRect(this.canvas.width / 2 - 5, yPos, 10, 20);
        }
        this.ctx.fillStyle = 'white';
        this.ctx.font = '16px Arial';
        this.ctx.fillText(`Score: ${Math.floor(this.gameState.score)}`, 10, 20);
        this.ctx.fillText(`Height: ${this.gameState.launchHeight}m`, 10, 40);
    },

    setupInputs() {
        this.canvas.addEventListener('click', (event) => {
            if (this.gameState.currentRodIndex === -1 && this.systems.rods) {
                this.launchRod();
            }
        });
    },

    launchRod() {
        const rod = this.systems.rods.createRod();
        rod.y = this.gameState.launchHeight;

        let physicsIndex;
        if (this.gameState.isOrbitalPhase) {
            physicsIndex = this.systems.physics.addObject(rod, true, this.gameState.launchHeight);
            setTimeout(() => {
                if (this.gameState.currentRodIndex >= 0) {
                    this.systems.physics.deOrbit(this.gameState.currentRodIndex, 0.1);
                    const trajectory = this.systems.atmosphere.preCalculateTrajectory(this.gameState.currentRodIndex);
                    const finalState = trajectory[trajectory.length - 1];
                    this.impactTime = this.globalTime + finalState.time + 1;
                    this.rodFallSpeedMultiplier = 10;
                }
            }, 1000);
        } else {
            physicsIndex = this.systems.physics.addObject(rod);
            const trajectory = this.systems.atmosphere.preCalculateTrajectory(physicsIndex);
            this.impactTime = this.globalTime + trajectory[trajectory.length - 1].time;
            this.rodFallSpeedMultiplier = 10;
        }

        this.gameState.currentRodIndex = physicsIndex;
        console.log(`Rod launched: mass=${rod.mass}kg, height=${rod.y}m, impact at ${this.impactTime.toFixed(2)}s`);
    },

    updateProgression() {
        if (this.systems.upgrades) {
            this.gameState.launchHeight = this.systems.upgrades.getLaunchHeight();
            if (this.gameState.launchHeight >= 160000 && !this.gameState.isOrbitalPhase) {
                this.gameState.isOrbitalPhase = true;
                console.log('Entered orbital phase at 160km');
            }
        }

        if (this.systems.prestige && this.gameState.totalScorePerPrestige > 1e12 && this.gameState.prestigeLevel < 15) {
            this.systems.prestige.triggerPrestige();
        }

        if (this.systems.ascension && this.gameState.prestigeLevel >= 15 && this.gameState.ascensionLevel === 0) {
            this.systems.ascension.triggerAscension();
        }
    },

    applyAtmosphericForces() {
        for (let i = 0; i < this.systems.physics.objects.length; i++) {
            const obj = this.systems.physics.getObjectState(i);
            if (obj.isActive) {
                const force = this.systems.atmosphere.calculateForces(obj);
                this.systems.physics.applyForce(i, force);
            }
        }
    },

    getCurrentStats() {
        const rodIndex = this.gameState.currentRodIndex;
        if (rodIndex < 0 || !this.systems.physics.objects[rodIndex]) {
            return { altitude: 0, velocity: 0, energy: 0 };
        }
        const rod = this.systems.physics.getObjectState(rodIndex);
        return {
            altitude: rod.position.y,
            velocity: Math.sqrt(rod.velocity.x * rod.velocity.x + rod.velocity.y * rod.velocity.y),
            energy: rod.energy
        };
    },

    stop() {
        this.isRunning = false;
    },

    reset(fullReset = false) {
        this.systems.physics.reset();
        this.systems.rods.reset();
        this.systems.impact.reset();
        this.systems.ejecta.reset();
        this.systems.shockwave.reset();
        this.systems.terrain.reset();
        this.systems.visuals.reset();
        this.systems.upgrades.reset(fullReset);

        this.gameState.score = 0;
        this.gameState.totalEnergy = 0;
        this.gameState.currentRodIndex = -1;
        this.gameState.launchHeight = 10;
        this.gameState.upgradeLevel = 0;
        this.gameState.totalScorePerPrestige = fullReset ? 0 : this.gameState.totalScorePerPrestige;
        this.gameState.totalScorePerAscension = fullReset ? 0 : this.gameState.totalScorePerAscension;
        if (fullReset) {
            this.gameState.prestigeLevel = 0;
            this.gameState.ascensionLevel = 0;
            this.gameState.isOrbitalPhase = false;
            this.gameState.prestigePoints = 0;
            this.gameState.ascensionPoints = 0;
        }
        this.impactTime = null;
        this.rodFallSpeedMultiplier = 1;

        if (this.systems.ui) this.systems.ui.updateUI(this.gameState);
    },

    updateGameState(updates) {
        Object.assign(this.gameState, updates);
    }
};

window.Game = Game;