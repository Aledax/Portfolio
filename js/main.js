import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

var scene, camera, renderer, clock;
var shapeZPivot, shape;

const rotationMultiplier = 0.005;
const shapePosition = new THREE.Vector3(0, 0, 0);
const shapeRadius = 1;
const shapeFloatAmplitude = 0.0025;
const shapeFloatPeriod = 5;
const shapeFloatRotationAmplitude = 0.05;
const shapeFloatRotationOffset = shapeFloatPeriod / 2;

var mousedown = false;
var mousepos = new THREE.Vector2();
var scenemousepos = new THREE.Vector2();
var raycaster = new THREE.Raycaster();

init();

function init() {

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(
        40,
        window.innerWidth/window.innerHeight,
        0.1,
        1000);
    renderer = new THREE.WebGLRenderer();
    renderer.setSize(window.innerWidth, window.innerHeight);
    clock = new THREE.Clock();
    clock.start();

    document.body.appendChild(renderer.domElement);
    document.addEventListener('mousedown', e => onPress(e.clientX, e.clientY), false);
    document.addEventListener('mouseup', e => onRelease(e.clientX, e.clientY), false);
    document.addEventListener('mousemove', e => onMove(e.clientX, e.clientY), false);
    document.addEventListener('touchstart', e => onPress(e.touches[0].clientX, e.touches[0].clientY), false);
    document.addEventListener('touchend', e => onRelease(e.touches[0].clientX, e.touches[0].clientY), false);
    document.addEventListener('touchmove', e => {
        if (mousedown) {
            e.preventDefault(); // Prevent scroll
        }
        onMove(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: false });

    window.addEventListener('resize', onWindowResize, false);

    shapeZPivot = new THREE.Object3D();
    scene.add(shapeZPivot);

    const geometry = new THREE.IcosahedronGeometry(shapeRadius);
    const material = new THREE.MeshNormalMaterial();
    shape = new THREE.Mesh(geometry, material);
    shapeZPivot.add(shape);

    camera.position.z = 5;

    animate();
}

function animate() {

    requestAnimationFrame(animate);

    const rotationZ = shapeFloatRotationAmplitude * Math.cos((clock.getElapsedTime() - shapeFloatRotationOffset) * Math.PI * 2 / shapeFloatPeriod);
    shapeZPivot.rotation.z = rotationZ;

    const floatY = shapeFloatAmplitude * Math.cos(clock.getElapsedTime() * Math.PI * 2 / shapeFloatPeriod);
    shapeZPivot.position.copy(shapePosition.add(new THREE.Vector3(0, floatY, 0)));

    renderer.render(scene, camera);
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
        const dx = (x - mousepos.x);
        const dy = (y - mousepos.y);
        const q = new THREE.Quaternion();
        q.setFromAxisAngle(new THREE.Vector3(dy, dx, 0).normalize(), rotationMultiplier * new THREE.Vector2(dx, dy).length());
        shape.quaternion.premultiply(q);
    }

    mousepos = new THREE.Vector2(x, y);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize(window.innerWidth, window.innerHeight);
}