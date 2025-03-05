// upgrades.js - Player progression with hump-shaped balance

class Upgrades {
    constructor() {
        this.upgrades = {
            material: {
                levels: [
                    { name: 'Wood', cost: 10, density: 700, strength: 0.15, color: '#8b4513', unlocked: true },
                    { name: 'PVC', cost: 30, density: 1380, strength: 0.2, color: '#f0f0f0', unlocked: false }, // Upgrade 1
                    { name: 'Aluminum', cost: 100, density: 2700, strength: 0.3, color: '#d3d3d3', unlocked: false }, // Upgrade 3
                    { name: 'Titanium', cost: 300, density: 4500, strength: 0.6, color: '#b0c4de', unlocked: false }, // Upgrade 5
                    { name: 'Steel', cost: 10, density: 7850, strength: 0.5, color: '#a9a9a9', unlocked: false, prestigeCost: 1 }, // Prestige 1
                    { name: 'Lead', cost: 50, density: 11340, strength: 0.4, color: '#696969', unlocked: false, prestigeCost: 5 }, // Prestige 5
                    { name: 'Tungsten', cost: 200, density: 19250, strength: 0.9, color: '#4a4a4a', unlocked: false, prestigeCost: 10 }, // Prestige 10
                    { name: 'Osmium', cost: 1, density: 22590, strength: 0.85, color: '#2f4f4f', unlocked: false, ascensionCost: 1 }, // Ascension 1
                    { name: 'Unobtanium', cost: 5, density: 50000, strength: 0.95, color: '#00ced1', unlocked: false, ascensionCost: 5 }, // Ascension 5
                    { name: 'Neutronium', cost: 20, density: 1e6, strength: 0.98, color: '#ff00ff', unlocked: false, ascensionCost: 15 }, // Ascension 15
                    { name: 'Hyperdense', cost: 100, density: 1e8, strength: 1.0, color: '#ffd700', unlocked: false, ascensionCost: 50 } // Ascension 50
                ],
                currentLevel: 0,
                baseCostMultiplier: 2.5
            },
            size: {
                levels: [
                    { name: 'Small', cost: 5, sizeMultiplier: 1.0 },
                    { name: 'Medium', cost: 15, sizeMultiplier: 1.5 },
                    { name: 'Large', cost: 30, sizeMultiplier: 2.0 },
                    { name: 'Huge', cost: 60, sizeMultiplier: 2.5 },
                    { name: 'Massive', cost: 120, sizeMultiplier: 3.0 }
                ],
                currentLevel: 0,
                baseCostMultiplier: 1.6,
                materialCostFactor: 1.0
            },
            shape: {
                levels: [
                    { name: 'Blunt', cost: 10, dragCoefficient: 1.0, lengthFactor: 1.0, areaFactor: 1.0 },
                    { name: 'Cylindrical', cost: 50, dragCoefficient: 0.8, lengthFactor: 1.5, areaFactor: 0.7 },
                    { name: 'Streamlined', cost: 200, dragCoefficient: 0.3, lengthFactor: 2.0, areaFactor: 0.5 }
                ],
                currentLevel: 0,
                baseCostMultiplier: 2.0
            },
            launchHeight: {
                levels: [
                    { name: 'Ground Toss', cost: 5, height: 10, unlocked: true },
                    { name: 'Rooftop', cost: 10, height: 30, unlocked: true },
                    { name: 'Small Balloon', cost: 25, height: 300, unlocked: true },
                    { name: 'Airplane', cost: 150, height: 12000, unlocked: false, prestigeCost: 1 }, // Prestige 1
                    { name: 'Weather Balloon', cost: 500, height: 30000, unlocked: false, prestigeCost: 2 }, // Prestige 2
                    { name: 'Sub-Orbital', cost: 2000, height: 100000, unlocked: false, prestigeCost: 3 }, // Prestige 3
                    { name: 'LEO', cost: 10000, height: 160000, unlocked: false, prestigeCost: 4 }, // Prestige 4
                    { name: 'MEO', cost: 50000, height: 2000000, unlocked: false, prestigeCost: 6 }, // Prestige 6
                    { name: 'HEO', cost: 200000, height: 35786000, unlocked: false, prestigeCost: 8 } // Prestige 8
                ],
                currentLevel: 0,
                baseCostMultiplier: 2.3
            },
            explosionMultiplier: {
                levels: [
                    { name: 'Base Impact', cost: 100, multiplier: 1.0, unlocked: true },
                    { name: 'Enhanced Blast', cost: 1000, multiplier: 1.5, unlocked: false, prestigeCost: 2 }, // Prestige 2
                    { name: 'High Explosive', cost: 10000, multiplier: 2.0, unlocked: false, prestigeCost: 4 }, // Prestige 4
                    { name: 'Mega Blast', cost: 100000, multiplier: 3.0, unlocked: false, prestigeCost: 6 } // Prestige 6
                ],
                currentLevel: 0,
                baseCostMultiplier: 2.8
            }
        };

        Game.systems.upgrades = this;
        console.log('Upgrades system initialized');
    }

    getLaunchHeight() {
        return this.upgrades.launchHeight.levels[this.upgrades.launchHeight.currentLevel].height;
    }

    canPurchase(upgradeType, level = this.upgrades[upgradeType].currentLevel + 1) {
        if (level >= this.upgrades[upgradeType].levels.length) return false;
        const upgrade = this.upgrades[upgradeType].levels[level];
        if (!upgrade.unlocked) return false;

        if (upgrade.prestigeCost !== undefined) {
            return Game.gameState.prestigePoints >= upgrade.prestigeCost;
        } else if (upgrade.ascensionCost !== undefined) {
            return Game.gameState.ascensionPoints >= upgrade.ascensionCost;
        } else {
            const cost = this.getUpgradeCost(upgradeType, level);
            return Game.gameState.score >= cost;
        }
    }

    getUpgradeCost(upgradeType, level) {
        const baseCost = this.upgrades[upgradeType].levels[level].cost;
        const multiplier = this.upgrades[upgradeType].baseCostMultiplier;
        const prestigeBonus = Game.systems.prestige ? Game.systems.prestige.getCostReductionMultiplier() : 1.0;
        let costFactor = 1.0;
        if (upgradeType === 'size') {
            costFactor = this.upgrades.size.materialCostFactor;
        }
        return Math.floor(baseCost * Math.pow(multiplier, level) * costFactor / prestigeBonus);
    }

    purchaseUpgrade(upgradeType) {
        const nextLevel = this.upgrades[upgradeType].currentLevel + 1;
        if (!this.canPurchase(upgradeType, nextLevel)) return false;

        const upgrade = this.upgrades[upgradeType].levels[nextLevel];
        if (upgrade.prestigeCost !== undefined) {
            Game.updateGameState({ prestigePoints: Game.gameState.prestigePoints - upgrade.prestigeCost });
        } else if (upgrade.ascensionCost !== undefined) {
            Game.updateGameState({ ascensionPoints: Game.gameState.ascensionPoints - upgrade.ascensionCost });
        } else {
            const cost = this.getUpgradeCost(upgradeType, nextLevel);
            Game.updateGameState({ score: Game.gameState.score - cost });
        }

        this.upgrades[upgradeType].currentLevel = nextLevel;

        if (upgradeType === 'material') {
            this.upgrades.size.currentLevel = 0;
            this.upgrades.size.materialCostFactor = 1.0 + this.upgrades.material.currentLevel * 0.1;
        }

        this.applyUpgradeEffects(upgradeType);
        console.log(`Purchased ${upgradeType} level ${nextLevel}`);
        return true;
    }

    applyUpgradeEffects(upgradeType) {
        const levelData = this.upgrades[upgradeType].levels[this.upgrades[upgradeType].currentLevel];
        switch (upgradeType) {
            case 'launchHeight':
                Game.updateGameState({ 
                    launchHeight: levelData.height,
                    isOrbitalPhase: levelData.height >= 160000
                });
                break;
        }
    }

    getRodUpgradeData() {
        const material = this.upgrades.material.levels[this.upgrades.material.currentLevel];
        const size = this.upgrades.size.levels[this.upgrades.size.currentLevel];
        const shape = this.upgrades.shape.levels[this.upgrades.shape.currentLevel];
        const baseLength = 0.5;
        const baseRadius = 0.05;
        const length = baseLength * size.sizeMultiplier * shape.lengthFactor;
        const radius = baseRadius * size.sizeMultiplier * shape.areaFactor;
        const volume = Math.PI * radius * radius * length;
        const mass = material.density * volume * 10; // Adjusted for ~3 points early
        return {
            material: material.name,
            mass,
            density: material.density,
            strength: material.strength,
            color: material.color,
            shapeFactor: shape.dragCoefficient,
            radius,
            length
        };
    }

    getExplosionMultiplier() {
        return this.upgrades.explosionMultiplier.levels[this.upgrades.explosionMultiplier.currentLevel].multiplier;
    }

    reset(fullReset = false) {
        this.upgrades.material.currentLevel = 0;
        this.upgrades.size.currentLevel = 0;
        this.upgrades.size.materialCostFactor = 1.0;
        this.upgrades.shape.currentLevel = 0;
        this.upgrades.launchHeight.currentLevel = 0;
        this.upgrades.explosionMultiplier.currentLevel = 0;
        if (!fullReset) {
            const prestigeLevel = Game.systems.prestige ? Game.systems.prestige.getPrestigeLevel() : 0;
            this.unlockPrestigeUpgrades(prestigeLevel);
        }
        this.applyUpgradeEffects('launchHeight');
        console.log('Upgrades reset');
    }

    unlockPrestigeUpgrades(prestigeLevel) {
        if (prestigeLevel >= 1) this.upgrades.material.levels[4].unlocked = true; // Steel
        if (prestigeLevel >= 1) this.upgrades.launchHeight.levels[3].unlocked = true; // Airplane
        if (prestigeLevel >= 2) this.upgrades.launchHeight.levels[4].unlocked = true; // Weather Balloon
        if (prestigeLevel >= 2) this.upgrades.explosionMultiplier.levels[1].unlocked = true; // Enhanced Blast
        if (prestigeLevel >= 3) this.upgrades.launchHeight.levels[5].unlocked = true; // Sub-Orbital
        if (prestigeLevel >= 4) this.upgrades.launchHeight.levels[6].unlocked = true; // LEO
        if (prestigeLevel >= 4) this.upgrades.explosionMultiplier.levels[2].unlocked = true; // High Explosive
        if (prestigeLevel >= 5) this.upgrades.material.levels[5].unlocked = true; // Lead
        if (prestigeLevel >= 6) this.upgrades.launchHeight.levels[7].unlocked = true; // MEO
        if (prestigeLevel >= 6) this.upgrades.explosionMultiplier.levels[3].unlocked = true; // Mega Blast
        if (prestigeLevel >= 8) this.upgrades.launchHeight.levels[8].unlocked = true; // HEO
        if (prestigeLevel >= 10) this.upgrades.material.levels[6].unlocked = true; // Tungsten
    }

    setAscensionBaseMaterial(ascensionLevel) {
        this.upgrades.material.levels.forEach(level => level.unlocked = false);
        if (ascensionLevel >= 1) this.upgrades.material.levels[7].unlocked = true; // Osmium
        if (ascensionLevel >= 5) this.upgrades.material.levels[8].unlocked = true; // Unobtanium
        if (ascensionLevel >= 15) this.upgrades.material.levels[9].unlocked = true; // Neutronium
        if (ascensionLevel >= 50) this.upgrades.material.levels[10].unlocked = true; // Hyperdense
        this.upgrades.material.currentLevel = Math.max(0, ascensionLevel >= 50 ? 10 : ascensionLevel >= 15 ? 9 : ascensionLevel >= 5 ? 8 : 7);
        this.upgrades.size.currentLevel = 0;
        this.upgrades.size.materialCostFactor = 1.0 + this.upgrades.material.currentLevel * 0.1;
    }
}

const UpgradesInstance = new Upgrades();
window.Upgrades = UpgradesInstance;