// weather.js - Dynamic weather subsystem

class Weather {
    constructor() {
        this.weatherStates = {
            clear: { windScale: 1.0, densityMod: 1.0, precip: 0, cloudCover: 0.1, gustChance: 0.05 },
            windy: { windScale: 1.5, densityMod: 1.0, precip: 0, cloudCover: 0.3, gustChance: 0.2 },
            rain: { windScale: 1.2, densityMod: 1.05, precip: 0.5, cloudCover: 0.7, gustChance: 0.1 },
            storm: { windScale: 2.0, densityMod: 1.1, precip: 1.0, cloudCover: 0.9, gustChance: 0.4 },
            hurricane: { windScale: 3.0, densityMod: 1.15, precip: 1.5, cloudCover: 1.0, gustChance: 0.6 }
        };

        this.currentState = 'clear';
        this.stateDuration = 0;
        this.transitionTime = 60;

        this.basePrecipIntensity = 0;
        this.cloudCover = 0;
        this.gustParams = { chance: 0, magnitude: 0, duration: 0 };

        this.planetaryWeatherMod = {
            intensityScale: 1.0,
            exoticType: null
        };

        this.externalModifiers = {
            windReduction: 1.0,
            precipReduction: 1.0
        };

        this.updateWeatherState();
        Game.systems.weather = this;
        console.log('Weather initialized with clear conditions');
    }

    init(intensityScale = 1.0, exoticType = null) {
        this.planetaryWeatherMod.intensityScale = intensityScale;
        this.planetaryWeatherMod.exoticType = exoticType;
        this.currentState = 'clear';
        this.stateDuration = 0;
        this.updateWeatherState();
        console.log(`Weather reset: IntensityScale=${intensityScale}, ExoticType=${exoticType}`);
    }

    updateWeatherState() {
        const state = this.weatherStates[this.currentState];
        this.basePrecipIntensity = state.precip * this.planetaryWeatherMod.intensityScale * this.externalModifiers.precipReduction;
        this.cloudCover = state.cloudCover;
        this.gustParams = {
            chance: state.gustChance * this.planetaryWeatherMod.intensityScale,
            magnitude: 20 * state.windScale * this.planetaryWeatherMod.intensityScale,
            duration: 2 + Math.random() * 3
        };

        if (Game.systems.atmosphere) {
            Game.systems.atmosphere.applyWeatherEffects({
                density: state.densityMod * this.planetaryWeatherMod.intensityScale,
                windScale: state.windScale * this.planetaryWeatherMod.intensityScale * this.externalModifiers.windReduction,
                gusts: this.gustParams
            });
        }
    }

    update(deltaTime) {
        this.stateDuration -= deltaTime;
        if (this.stateDuration <= 0) {
            this.transitionWeather();
        }

        this.updateWeatherState();
    }

    transitionWeather() {
        const roll = Math.random();
        if (Game.gameState.isOrbitalPhase) {
            if (roll < 0.2) this.currentState = 'clear';
            else if (roll < 0.4) this.currentState = 'windy';
            else if (roll < 0.6) this.currentState = 'rain';
            else if (roll < 0.9) this.currentState = 'storm';
            else this.currentState = 'hurricane';
        } else {
            if (roll < 0.4) this.currentState = 'clear';
            else if (roll < 0.7) this.currentState = 'windy';
            else if (roll < 0.9) this.currentState = 'rain';
            else this.currentState = 'storm';
        }

        this.stateDuration = this.transitionTime * (0.5 + Math.random());
        console.log(`Weather transitioned to ${this.currentState}, duration=${this.stateDuration.toFixed(1)}s`);
    }

    applyExternalModifiers(modifiers) {
        this.externalModifiers.windReduction = modifiers.windReduction || 1.0;
        this.externalModifiers.precipReduction = modifiers.precipReduction || 1.0;
        this.updateWeatherState();
        console.log(`Weather modifiers applied: Wind=${this.externalModifiers.windReduction}, Precip=${this.externalModifiers.precipReduction}`);
    }

    getWeatherEffects() {
        return {
            windScale: this.weatherStates[this.currentState].windScale * this.planetaryWeatherMod.intensityScale * this.externalModifiers.windReduction,
            densityMod: this.weatherStates[this.currentState].densityMod * this.planetaryWeatherMod.intensityScale,
            precipitation: this.basePrecipIntensity,
            cloudCover: this.cloudCover,
            gustChance: this.gustParams.chance,
            isExotic: !!this.planetaryWeatherMod.exoticType,
            exoticType: this.planetaryWeatherMod.exoticType
        };
    }

    getWeatherData() {
        return {
            state: this.currentState,
            precipIntensity: this.basePrecipIntensity,
            cloudCover: this.cloudCover,
            windScale: this.weatherStates[this.currentState].windScale * this.planetaryWeatherMod.intensityScale,
            exoticType: this.planetaryWeatherMod.exoticType,
            durationRemaining: this.stateDuration
        };
    }
}

const WeatherInstance = new Weather();
window.Weather = WeatherInstance;