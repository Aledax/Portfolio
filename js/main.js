import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { createDodecahedronGeometry } from './dodecahedron.js';

var scene, camera, renderer, clock;
var glowMesh, shapeZPivot, shapeBack, shapeFront;

const rotationMultiplier = 0.005;
const rotationAcceleration = 0.5;
const rotationFixedDeceleration = 0.75;
const rotationFreeDeceleration = 0.95;
const backgroundScrollMultiplier = 2;
const shapePosition = new THREE.Vector3(0, 0, 0);
const shapeRadius = 1;
const shapeFloatAmplitude = 0.0025;
const shapeFloatPeriod = 5;
const shapeFloatRotationAmplitude = 0.05;
const shapeFloatRotationOffset = shapeFloatPeriod / 2;

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
    const glowTexture = textureLoader.load('../assets/images/glow.png');
    const glowMaterial = new THREE.MeshBasicMaterial({
        map: glowTexture,
        transparent: true,
        opacity: 0.5,
        depthWrite: false,
        blending: THREE.AdditiveBlending
    });
    const glowGeometry = new THREE.PlaneGeometry(2.5, 2.5);
    glowMesh = new THREE.Mesh(glowGeometry, glowMaterial);
    scene.add(glowMesh);

    shapeZPivot = new THREE.Object3D();
    scene.add(shapeZPivot);

    const geometry = createDodecahedronGeometry(shapeRadius);
    const barycentric = [];
    for (let i = 0; i < 60; i++) {
        barycentric.push(1, 0, 0);
        barycentric.push(0, 1, 0);
        barycentric.push(0, 0, 1);
    }
    geometry.setAttribute('barycentric', new THREE.Float32BufferAttribute(barycentric, 3));
    
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
    shapeBack = new THREE.Mesh(geometry, shapeBackMaterial);
    shapeFront = new THREE.Mesh(geometry, shapeFrontMaterial);
    const initialQuaternion = new THREE.Quaternion();
    initialQuaternion.setFromAxisAngle(new THREE.Vector3(1, 0, 0), -59 * Math.PI / 180);
    shapeBack.quaternion.premultiply(initialQuaternion);
    shapeFront.quaternion.premultiply(initialQuaternion);
    shapeZPivot.add(shapeBack);
    shapeZPivot.add(shapeFront);

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

    if (mousedown) {
        mousevelocity.multiplyScalar(rotationFixedDeceleration);
    } else {
        mousevelocity.multiplyScalar(rotationFreeDeceleration);
    }
    rotateShape();

    renderer.render(scene, camera);

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
}