import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

var scene, camera, renderer;
var cube;

var rotationMultiplier = 0.0075;

var mousedown = false;
var lastX = 0;
var lastY = 0;

init();

function init() {

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(
        75,
        window.innerWidth/window.innerHeight,
        0.1,
        1000);
    renderer = new THREE.WebGLRenderer();
    renderer.setSize(window.innerWidth, window.innerHeight);
    
    document.body.appendChild(renderer.domElement);
    document.addEventListener('mousedown', e => onPress(e.clientX, e.clientY), false);
    document.addEventListener('mouseup', e => onRelease(e.clientX, e.clientY), false);
    document.addEventListener('mousemove', e => onMove(e.clientX, e.clientY), false);
    document.addEventListener('touchstart', e => onPress(e.touches[0].clientX, e.touches[0].clientY), false);
    document.addEventListener('touchend', e => onRelease(e.touches[0].clientX, e.touches[0].clientY), false);
    document.addEventListener('touchmove', e => {
        e.preventDefault(); // Prevent scroll
        onMove(e.touches[0].clientX, e.touches[0].clientY);}, false);

    window.addEventListener('resize', onWindowResize, false);

    const geometry = new THREE.BoxGeometry();
    const material = new THREE.MeshNormalMaterial();
    cube = new THREE.Mesh(geometry, material);
    scene.add(cube);

    camera.position.z = 5;

    animate();
}

function animate() {

    requestAnimationFrame(animate);

    // if (mousedown) {
    //     cube.rotation.x += 0.01;
    //     cube.rotation.y += 0.01;
    // }

    renderer.render(scene, camera);
}

function onPress(x, y) {

    mousedown = true;
}

function onRelease(x, y) {

    mousedown = false;
}

function onMove(x, y) {

    if (mousedown) {
        cube.rotation.y += rotationMultiplier * (x - lastX);
        cube.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, cube.rotation.x + rotationMultiplier * (y - lastY)));
    }

    lastX = x;
    lastY = y;
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize(window.innerWidth, window.innerHeight);
}