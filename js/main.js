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
    document.addEventListener('mousedown', onDocumentMouseDown, false);
    document.addEventListener('mouseup', onDocumentMouseUp, false);
    document.addEventListener('mousemove', onDocumentMouseMove, false);

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

function onDocumentMouseDown(event) {

    event.preventDefault();

    switch(event.which) {
        case 1:
            mousedown = true;
            break;
    }
}

function onDocumentMouseUp(event) {

    event.preventDefault();

    switch(event.which) {
        case 1:
            mousedown = false;
            break;
    }
}

function onDocumentMouseMove(event) {

    event.preventDefault();

    var thisX = event.clientX;
    var thisY = event.clientY;

    if (mousedown) {
        cube.rotation.y += rotationMultiplier * (thisX - lastX);
        cube.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, cube.rotation.x + rotationMultiplier * (thisY - lastY)));
    }

    lastX = event.clientX;
    lastY = event.clientY;
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize(window.innerWidth, window.innerHeight);
}