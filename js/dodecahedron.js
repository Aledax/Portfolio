import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

const radius = 1;

const phi = (1 + Math.sqrt(5)) / 2;
const a = 1.0 / Math.sqrt(3); // Cube vertex
const b = phi / Math.sqrt(3); // Roof vertex (long)
const c = 1 / phi / Math.sqrt(3); // Roof vertex (short)

const vertices = [
    [a, a, a],
    [-a, a, a],
    [a, a, -a],
    [-a, a, -a],
    [a, -a, a],
    [-a, -a, a],
    [a, -a, -a],
    [-a, -a, -a],
    [c, b, 0],
    [-c, b, 0],
    [c, -b, 0],
    [-c, -b, 0],
    [b, 0, c],
    [b, 0, -c],
    [-b, 0, c],
    [-b, 0, -c],
    [0, c, b],
    [0, -c, b],
    [0, c, -b],
    [0, -c, -b]
];

for (let v = 0; v < 20; v++) {
    for (let c = 0; c < 3; c++) {
        vertices[v][c] *= radius;
    }
}

const pentagons = [
    [8, 9, 3, 18, 2],
    [9, 8, 0, 16, 1],
    [10, 11, 5, 17, 4],
    [11, 10, 6, 19, 7],
    [12, 13, 6, 10, 4],
    [13, 12, 0, 8, 2],
    [14, 15, 3, 9, 1],
    [15, 14, 5, 11, 7],
    [16, 17, 5, 14, 1],
    [17, 16, 0, 12, 4],
    [18, 19, 6, 13, 2],
    [19, 18, 3, 15, 7]
];

const faceCenters = [];

for (let p = 0; p < 12; p++) {
    let pentagon = pentagons[p];
    let sum = [0, 0, 0];
    for (let v = 0; v < 5; v++) {
        sum[0] += vertices[pentagon[v]][0];
        sum[1] += vertices[pentagon[v]][1];
        sum[2] += vertices[pentagon[v]][2];
    }
    for (let c = 0; c < 3; c++) {
        sum[c] /= 5;
    }
    faceCenters.push(sum);
}

var positions = [];

for (let p = 0; p < 12; p++) {
    let pentagon = pentagons[p];
    for (let e = 0; e < 5; e++) {
        positions = positions.concat(vertices[pentagon[e]]);
        positions = positions.concat(faceCenters[p]);
        positions = positions.concat(vertices[pentagon[(e+1)%5]]);
    }
}

export function createDodecahedronGeometry() {

    let geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.computeVertexNormals();

    return geometry;
}