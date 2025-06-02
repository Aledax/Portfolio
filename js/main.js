import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/Addons.js';
import { RenderPass } from 'three/examples/jsm/Addons.js';
import { SSAARenderPass } from 'three/examples/jsm/Addons.js';
import { createDodecahedronGeometry } from './dodecahedron.js';

var scene, camera, renderer, composer, aaPass, clock;
var glowMesh, dodecahedronGeometry, shapeZPivot, shapeBack, shapeFront;

var normalArrows = [];
var unactivatedIconMeshes = [];
var activatedIconMeshes = [];
var iconGlowMeshes = [];

const rotationMultiplier = 0.005;
const rotationAcceleration = 0.5;
const rotationFacingAcceleration = 5;
const rotationFixedDeceleration = 0.75;
const rotationFreeDeceleration = 0.95;
const rotationFacingDeceleration = 0.85;
const faceMaximumSpeed = 7;
const backgroundScrollMultiplier = -1;
const shapePosition = new THREE.Vector3(0, 0, 0);
const shapeRadius = 1;
const shapeFloatAmplitude = 0.0025;
const shapeFloatPeriod = 5;
const shapeFloatRotationAmplitude = 0.05;
const shapeFloatRotationOffset = shapeFloatPeriod / 2;
const shapeFaceRequiredDot = 0.91;

// const titleSize = 24;
// const titleY = 2;
// const titleKerning = 0.5;
// const titleText = 'Alex Day';
// const titleFont = 'js/dashhorizon.otf';
// const titleColor = 0x00aaff;
// const titleTextMeshes = [];

const shapeVertexShader = `
    attribute vec3 barycentric;
    varying vec3 vBarycentric; // Gets passed to fragment shader
    varying vec3 vNormal;

    void main() {
        vBarycentric = barycentric;
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); // These three values are provided by Three.js
    }
`;

const shapeBackFragmentShader = `
    precision mediump float; // Specify float precision
    varying vec3 vBarycentric; // Comes from vertex shader
    varying vec3 vNormal;

    void main() {
        float lighting = -vNormal.y * 0.25 + 0.75;
        float edgeCloseness = vBarycentric.y;
        float alpha = 0.0;
        float opaqueAlpha = 0.4;
        float transparentAlpha = 0.0;
        float opaqueBarrier = 0.01;
        float transparentBarrier = 0.02;
        if (edgeCloseness < opaqueBarrier) {
            alpha = opaqueAlpha;
        } else if (edgeCloseness < transparentBarrier) {
            alpha = opaqueAlpha + (transparentAlpha - opaqueAlpha) * (edgeCloseness - opaqueBarrier) / (transparentBarrier - opaqueBarrier);
        } else {
            alpha = transparentAlpha;
        }
        gl_FragColor = vec4(vec3(0.0, 0.65, 1.0) * lighting, alpha);
    }
`

const shapeFrontFragmentShader = `
    precision mediump float; // Specify float precision
    varying vec3 vBarycentric; // Comes from vertex shader
    varying vec3 vNormal;

    void main() {
        float maxLightFactor = 0.75;
        float minDarkFactor = 0.25;
        vec3 lightSourceDirection = vec3(-0.25, 1.0, 0.0);
        float lightSourceFacing = dot(lightSourceDirection, vNormal);
        float lightFactor = 0.0;
        float darkFactor = 1.0;
        if (lightSourceFacing >= 0.0) {
            lightFactor = lightSourceFacing * maxLightFactor;
        } else {
            darkFactor = 1.0 + lightSourceFacing * (1.0 - minDarkFactor);
        }

        float edgeCloseness = vBarycentric.y;
        float alpha = 0.0;
        float opaqueAlpha = 1.0;
        float transparentAlpha = 0.15;
        float opaqueBarrier = 0.05;
        float transparentBarrier = 0.07;
        if (edgeCloseness < opaqueBarrier) {
            alpha = opaqueAlpha;
        } else if (edgeCloseness < transparentBarrier) {
            alpha = opaqueAlpha + (transparentAlpha - opaqueAlpha) * (edgeCloseness - opaqueBarrier) / (transparentBarrier - opaqueBarrier);
        } else {
            alpha = transparentAlpha;
        }
        gl_FragColor = vec4((vec3(0.0, (0.65 + lightFactor / 1.5) * (darkFactor + ((1.0 - darkFactor) / 1.5)), 1.0) + lightFactor) * darkFactor, alpha);
    }
`

var mousedown = false;
var mousepos = new THREE.Vector2();
var mousevelocity = new THREE.Vector2();
var scenemousepos = new THREE.Vector2();
var backgroundscrollpos = new THREE.Vector2(0, 0);
var raycaster = new THREE.Raycaster();

init();

function init() {

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(
        50,
        window.innerWidth/window.innerHeight,
        0.1,
        1000);
    renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x000000, 0);
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    aaPass = new SSAARenderPass(scene, camera);
    aaPass.sampleLevel = 2;
    composer.addPass(aaPass);

    clock = new THREE.Clock();
    clock.start();

    document.body.appendChild(renderer.domElement);
    document.addEventListener('mousedown', e => onPress(e.clientX, e.clientY), false);
    document.addEventListener('mouseup', e => onRelease(e.clientX, e.clientY), false);
    document.addEventListener('mousemove', e => onMove(e.clientX, e.clientY), false);
    document.addEventListener('touchstart', e => onPress(e.touches[0].clientX, e.touches[0].clientY), false);
    document.addEventListener('touchend', e => {
        if (mousedown) {
            e.preventDefault();
        }
        onRelease(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: false });
    document.addEventListener('touchmove', e => {
        if (mousedown) {
            e.preventDefault();
        }
        onMove(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: false });

    window.addEventListener('resize', onWindowResize, false);

    const textureLoader = new THREE.TextureLoader();
    const glowURL = new URL(
        '../assets/images/glow.png?as=webp',
        import.meta.url
    );
    const glowTexture = textureLoader.load(glowURL);
    const glowMaterial = new THREE.MeshBasicMaterial({
        map: glowTexture,
        transparent: true,
        opacity: 0.75,
        depthWrite: false,
        blending: THREE.AdditiveBlending
    });
    const glowGeometry = new THREE.PlaneGeometry(2.5, 2.5);
    glowMesh = new THREE.Mesh(glowGeometry, glowMaterial);
    scene.add(glowMesh);

    const unactivatedIconURL = new URL(
        '../assets/images/icons/unactivated/sampleicon.png?as=webp',
        import.meta.url
    );
    const activatedIconURL = new URL(
        '../assets/images/icons/activated/sampleicon.png?as=webp',
        import.meta.url
    );
    const unactivatedIconTexture = textureLoader.load(unactivatedIconURL, texture => {
        texture.minFilter = THREE.NearestFilter;
        texture.magFilter = THREE.NearestFilter;
        texture.generateMipmaps = false;
    });
    const activatedIconTexture = textureLoader.load(activatedIconURL, texture => {
        texture.minFilter = THREE.NearestFilter;
        texture.magFilter = THREE.NearestFilter;
        texture.generateMipmaps = false;
    });
    const unactivatedIconMaterial = new THREE.MeshBasicMaterial({
        map: unactivatedIconTexture,
        transparent: false,
        opacity: 0.05,
        depthWrite: false,
        blending: THREE.AdditiveBlending
    });
    const activatedIconMaterial = new THREE.MeshBasicMaterial({
        map: activatedIconTexture,
        transparent: false,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending
    });
    const iconGeometry = new THREE.PlaneGeometry(0.5, 0.5);
    const iconGlowGeometry = new THREE.PlaneGeometry(1, 1);
    for (let i = 0; i < 12; i++) {
        const unactivatedIconMesh = new THREE.Mesh(iconGeometry, unactivatedIconMaterial);
        const activatedIconMesh = new THREE.Mesh(iconGeometry, activatedIconMaterial.clone());
        const iconGlowMesh = new THREE.Mesh(iconGlowGeometry, glowMaterial.clone());
        unactivatedIconMeshes.push(unactivatedIconMesh);
        activatedIconMeshes.push(activatedIconMesh);
        iconGlowMeshes.push(iconGlowMesh);
    }

    shapeZPivot = new THREE.Object3D();
    scene.add(shapeZPivot);

    dodecahedronGeometry = createDodecahedronGeometry(shapeRadius);
    const barycentric = [];
    for (let i = 0; i < 60; i++) {
        barycentric.push(1, 0, 0);
        barycentric.push(0, 1, 0);
        barycentric.push(0, 0, 1);
    }
    dodecahedronGeometry.setAttribute('barycentric', new THREE.Float32BufferAttribute(barycentric, 3));
    
    const shapeBackMaterial = new THREE.ShaderMaterial({
        transparent: true,
        side: THREE.BackSide,
        vertexShader: shapeVertexShader,
        fragmentShader: shapeBackFragmentShader
    });
    const shapeFrontMaterial = new THREE.ShaderMaterial({
        transparent: true,
        vertexShader: shapeVertexShader,
        fragmentShader: shapeFrontFragmentShader
    });
    shapeBack = new THREE.Mesh(dodecahedronGeometry, shapeBackMaterial);
    shapeFront = new THREE.Mesh(dodecahedronGeometry, shapeFrontMaterial);
    
    const shapeNormals = dodecahedronGeometry.attributes.normal.array;
    for (let i = 0; i < 12; i++) {
        const normal = new THREE.Vector3(
            shapeNormals[i*45],
            shapeNormals[i*45+1],
            shapeNormals[i*45+2]
        ).normalize();
        shapeFront.add(unactivatedIconMeshes[i]);
        shapeFront.add(activatedIconMeshes[i]);
        shapeFront.add(iconGlowMeshes[i]);
        unactivatedIconMeshes[i].position.copy(normal.clone().multiplyScalar(0.8));
        unactivatedIconMeshes[i].lookAt(normal.clone().multiplyScalar(2));
        activatedIconMeshes[i].position.copy(normal.clone().multiplyScalar(0.8));
        activatedIconMeshes[i].lookAt(normal.clone().multiplyScalar(2));
        iconGlowMeshes[i].position.copy(normal.clone().multiplyScalar(0.8));
        iconGlowMeshes[i].lookAt(normal.clone().multiplyScalar(2));
    }
    
    const initialQuaternion = new THREE.Quaternion();
    initialQuaternion.setFromAxisAngle(new THREE.Vector3(1, 0, 0), -59 * Math.PI / 180);
    shapeBack.quaternion.premultiply(initialQuaternion);
    shapeFront.quaternion.premultiply(initialQuaternion);
    shapeZPivot.add(shapeBack);
    shapeZPivot.add(shapeFront);

    for (let i = 0; i < 12; i++) {
        normalArrows.push(new THREE.ArrowHelper(
            new THREE.Vector3(1, 0, 0),
            new THREE.Vector3(0, 0, 0),
            1,
            0xff0000
        ));
        // scene.add(normalArrows[i]);
    };

    camera.position.z = 5;

    animate();
}

function rotateShape() {
    const q = new THREE.Quaternion();
    q.setFromAxisAngle(new THREE.Vector3(mousevelocity.y, mousevelocity.x, 0).normalize(), rotationMultiplier * mousevelocity.length());
    shapeBack.quaternion.premultiply(q);
    shapeFront.quaternion.premultiply(q);
}

function animate() {

    requestAnimationFrame(animate);

    const rotationZ = shapeFloatRotationAmplitude * Math.cos((clock.getElapsedTime() - shapeFloatRotationOffset) * Math.PI * 2 / shapeFloatPeriod);
    shapeZPivot.rotation.z = rotationZ;

    const floatY = shapeFloatAmplitude * Math.cos(clock.getElapsedTime() * Math.PI * 2 / shapeFloatPeriod);
    shapeZPivot.position.copy(shapePosition.add(new THREE.Vector3(0, floatY, 0)));

    glowMesh.position.copy(shapeZPivot.position);

    const normalMatrix = new THREE.Matrix3().getNormalMatrix(shapeFront.matrixWorld);
    const shapeNormals = dodecahedronGeometry.attributes.normal.array;
    const faceDirection = new THREE.Vector3(0, 0, 1.0);
    var highestDot = -1;
    var bestIndex = -1;
    var bestNormal = null;
    for (let i = 0; i < 12; i++) {
        // console.log(dodecahedronGeometry.attributes.normal.array[i]);
        const normal = new THREE.Vector3(shapeNormals[i*45], shapeNormals[(i*45)+1], shapeNormals[(i*45)+2]).applyMatrix3(normalMatrix).normalize();
        const dot = normal.dot(faceDirection);
        normalArrows[i].setDirection(normal);
        normalArrows[i].setColor(0xff0000);
        if (dot >= shapeFaceRequiredDot && dot > highestDot) {
            highestDot = dot;
            bestIndex = i;
            bestNormal = normal;
        }
    }
    if (bestIndex != -1) {
        normalArrows[bestIndex].setColor(0x00ff00);
    }
    for (let i = 0; i < 12; i++) {
        if (bestIndex == i && (mousedown || mousevelocity.length() <= faceMaximumSpeed)) {
            activatedIconMeshes[i].material.opacity += 0.4 * (1.0 - activatedIconMeshes[i].material.opacity);
            iconGlowMeshes[i].material.opacity += 0.4 * (1.0 - iconGlowMeshes[i].material.opacity);
        } else {
            activatedIconMeshes[i].material.opacity *= 0.8;
            iconGlowMeshes[i].material.opacity *= 0.8;
        }
    }

    if (mousedown) {
        mousevelocity.multiplyScalar(rotationFixedDeceleration);
    } else {
        if (mousevelocity.length() <= faceMaximumSpeed && bestIndex != -1) {
            const resolveDirection = new THREE.Vector2(-bestNormal.x, bestNormal.y);
            mousevelocity.add(resolveDirection.multiplyScalar(rotationFacingAcceleration));
            mousevelocity.multiplyScalar(rotationFacingDeceleration);
        } else {
            mousevelocity.multiplyScalar(rotationFreeDeceleration);
        }
    }
    rotateShape();

    composer.render(scene, camera);

    backgroundscrollpos.add(new THREE.Vector2(mousevelocity.x * backgroundScrollMultiplier, mousevelocity.y * backgroundScrollMultiplier));
    document.body.style.backgroundPosition = `${backgroundscrollpos.x}px ${backgroundscrollpos.y}px`;
}

function onPress(x, y) {

    mousepos = new THREE.Vector2(x, y);

    scenemousepos = new THREE.Vector2(
        (x / window.innerWidth) * 2 - 1,
        (y / window.innerHeight) * -2 + 1
    );
    raycaster.setFromCamera(scenemousepos, camera);
    const planeZ = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    const intersection = new THREE.Vector3();
    raycaster.ray.intersectPlane(planeZ, intersection);

    if (intersection) {
        if (shapePosition.distanceTo(intersection) <= shapeRadius) {
            mousedown = true;
        }
    }
}

function onRelease(x, y) {

    mousedown = false;
}

function onMove(x, y) {

    if (mousedown) {
        mousevelocity.add(new THREE.Vector2(x - mousepos.x, y - mousepos.y).multiplyScalar(rotationAcceleration));
    }

    mousepos = new THREE.Vector2(x, y);
}

function onWindowResize() {

    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
}