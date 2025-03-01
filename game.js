// Enhanced game.js with WebGPU rendering and improved physics simulation

// Game state variables
let canvas, device, context, pipeline;
let rod = { mass: 100, shape: 'rod', altitude: 30000, velocity: 0, position: [0, 30000, 0] };
let gravity = 9.81;
let airDensity = 1.225;
let dragCoefficient = 0.82; // Adjusted for tungsten rod
let impactData = null;

async function initWebGPU() {
    canvas = document.getElementById('gameCanvas');
    if (!navigator.gpu) {
        console.error("WebGPU not supported");
        return;
    }
    
    const adapter = await navigator.gpu.requestAdapter();
    device = await adapter.requestDevice();
    context = canvas.getContext('webgpu');
    context.configure({ device, format: 'bgra8unorm' });
    
    pipeline = device.createRenderPipeline({
        vertex: { module: createShaderModule(device, vertexShader), entryPoint: 'main' },
        fragment: { module: createShaderModule(device, fragmentShader), entryPoint: 'main', targets: [{ format: 'bgra8unorm' }] },
        primitive: { topology: 'triangle-list' }
    });
    render();
}

function createShaderModule(device, source) {
    return device.createShaderModule({ code: source });
}

function calculatePhysics(deltaTime) {
    let dragForce = 0.5 * airDensity * rod.velocity * rod.velocity * dragCoefficient;
    let netForce = rod.mass * gravity - dragForce;
    let acceleration = netForce / rod.mass;
    rod.velocity += acceleration * deltaTime;
    rod.position[1] -= rod.velocity * deltaTime;
    
    if (rod.position[1] <= 0) {
        impactData = calculateImpact();
    }
}

function calculateImpact() {
    let kineticEnergy = 0.5 * rod.mass * rod.velocity * rod.velocity;
    let craterRadius = Math.pow(kineticEnergy, 1/3) / 10;
    let ejecta = kineticEnergy / 1000;
    return { craterRadius, ejecta };
}

function render() {
    if (!context) return;
    
    let commandEncoder = device.createCommandEncoder();
    let renderPass = commandEncoder.beginRenderPass({
        colorAttachments: [{
            view: context.getCurrentTexture().createView(),
            loadOp: 'clear', storeOp: 'store', clearValue: [0, 0, 0, 1]
        }]
    });
    renderPass.setPipeline(pipeline);
    renderPass.draw(3, 1, 0, 0);
    renderPass.end();
    device.queue.submit([commandEncoder.finish()]);
    requestAnimationFrame(render);
}

document.getElementById('dropButton').addEventListener('click', () => {
    let interval = setInterval(() => {
        if (rod.position[1] <= 0) {
            clearInterval(interval);
            console.log("Impact Data:", impactData);
        } else {
            calculatePhysics(0.1);
        }
    }, 100);
});

window.onload = initWebGPU;
