import * as THREE from 'https://esm.sh/three@0.160.1';
import { Text } from 'https://esm.sh/troika-three-text@0.48.0?deps=three@0.160.1';
import { createDodecahedronGeometry } from './dodecahedron.js';
import { projectData } from './projectdata.js';

var scene, camera, renderer, clock;
var glowMesh, dodecahedronGeometry, shapeZPivot, shapeBack, shapeFront;

var normalArrows = [];
var iconPlaceholders = [];
var activatedIconMeshes = [];
var iconGlowMeshes = [];
var iconFlashMeshes = [];
var projectNameTexts = [];
var projectNamePlaceholders = [];

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
        float opaqueAlpha = 0.2;
        float transparentAlpha = 0.0;
        float opaqueBarrier = 0.02;
        float transparentBarrier = 0.03;
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
        float transparentAlpha = 0.1;
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

var mouseDown = false;
var mousePos = new THREE.Vector2();
var mouseVelocity = new THREE.Vector2();
var screenMousePos = new THREE.Vector2();
var backgroundScrollPos = new THREE.Vector2(0, 0);
var raycaster = new THREE.Raycaster();
var focusedFace = -1;
var focusedTime = 0;

function syncTextPromise(text) {
    return new Promise(resolve => text.sync(() => resolve()));
}

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
    document.addEventListener('touchstart', e => {
        e.preventDefault();
        onPress(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: false });
    document.addEventListener('touchend', e => {
        if (mouseDown) {
            e.preventDefault();
        }
        onRelease();
    }, { passive: false });
    document.addEventListener('touchmove', e => {
        if (mouseDown) {
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

    const activatedIconURL = new URL(
        '../assets/images/icons/activated/sampleicon.png?as=webp',
        import.meta.url
    );
    const activatedIconTexture = textureLoader.load(activatedIconURL, texture => {
        texture.minFilter = THREE.NearestFilter;
        texture.magFilter = THREE.NearestFilter;
        texture.generateMipmaps = false;
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
    const iconFlashGeometry = new THREE.PlaneGeometry(1.5, 1.5);
    for (let i = 0; i < 12; i++) {
        const iconPlaceholder = new THREE.Object3D();
        const activatedIconMesh = new THREE.Mesh(iconGeometry, activatedIconMaterial.clone());
        const iconGlowMesh = new THREE.Mesh(iconGlowGeometry, glowMaterial.clone());
        const iconFlashMesh = new THREE.Mesh(iconFlashGeometry, glowMaterial.clone());
        iconPlaceholders.push(iconPlaceholder);
        activatedIconMeshes.push(activatedIconMesh);
        iconGlowMeshes.push(iconGlowMesh);
        iconFlashMesh.material.opacity = 0;
        iconFlashMeshes.push(iconFlashMesh);
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
        shapeFront.add(iconPlaceholders[i]);
        iconPlaceholders[i].add(activatedIconMeshes[i]);
        iconPlaceholders[i].add(iconGlowMeshes[i]);
        iconPlaceholders[i].add(iconFlashMeshes[i]);
        iconPlaceholders[i].position.copy(normal.clone().multiplyScalar(0.8));
        iconPlaceholders[i].lookAt(normal.clone().multiplyScalar(2));
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

    for (let i = 0; i < 12; i++) {
        const pData = projectData[i];
        const letterTexts = [];
        const letterPlaceholders = [];

        for (let letter = 0; letter < pData.name.length; letter++) {
            const text = new Text();
            text.font = '../assets/fonts/manrope-extrabold.otf';
            text.text = pData.name[letter];
            text.fontSize = 0.45;
            text.color = 0xffffff;
            text.material.transparent = true;
            text.material.opacity = 1;
            if (text.text == ' ') {
                text.text = 'l';
                text.material.opacity = 0;
            }
            letterTexts.push(text);

            const placeholder = new THREE.Object3D();
            placeholder.add(text);
            scene.add(placeholder);
            letterPlaceholders.push(placeholder);
        }

        Promise.all(letterTexts.map(syncTextPromise)).then(() => {
            const kerning = 0.0;
            let totalWidth = 0.0;
            const letterWidths = [];
            for (let letter = 0; letter < letterTexts.length; letter++) {
                letterTexts[letter].geometry.computeBoundingBox();
                const bbox = letterTexts[letter].geometry.boundingBox;
                const size = new THREE.Vector3();
                bbox.getSize(size);
                totalWidth += size.x;
                if (letter != 0) {
                    totalWidth += kerning;
                }
                letterWidths.push(size.x)
            }

            let incrementalWidth = 0;
            for (let letter = 0; letter < letterTexts.length; letter++) {
                const letterCenter = new THREE.Vector3(-totalWidth / 2 + incrementalWidth + letterWidths[letter] / 2, 1.5, 0);
                const letterTopLeft = new THREE.Vector3(-letterWidths[letter] / 2, 0.45, 0);
                letterPlaceholders[letter].position.copy(letterCenter);
                letterTexts[letter].position.copy(letterTopLeft);
                incrementalWidth += letterWidths[letter] + kerning;
            }
        });

        projectNameTexts.push(letterTexts);
        projectNamePlaceholders.push(letterPlaceholders);
    }

    camera.position.z = 5;

    animate();
}

function rotateShape() {
    const q = new THREE.Quaternion();
    q.setFromAxisAngle(new THREE.Vector3(mouseVelocity.y, mouseVelocity.x, 0).normalize(), rotationMultiplier * mouseVelocity.length());
    shapeBack.quaternion.premultiply(q);
    shapeFront.quaternion.premultiply(q);
}

function animate() {

    requestAnimationFrame(animate);
    const elapsed = clock.getDelta();

    if (focusedFace != -1) {
        focusedTime += elapsed;
    }

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
    var normals = [];
    for (let i = 0; i < 12; i++) {
        // console.log(dodecahedronGeometry.attributes.normal.array[i]);
        const normal = new THREE.Vector3(shapeNormals[i*45], shapeNormals[(i*45)+1], shapeNormals[(i*45)+2]).applyMatrix3(normalMatrix).normalize();
        const dot = normal.dot(faceDirection);
        // normalArrows[i].setDirection(normal);
        // normalArrows[i].setColor(0xff0000);
        if (dot > highestDot) {
            highestDot = dot;
            bestIndex = i;
            bestNormal = normal;
        }
        normals.push(normal);
    }

    if (!mouseDown && focusedFace == -1 && bestIndex != -1 && highestDot >= shapeFaceRequiredDot && mouseVelocity.length() <= faceMaximumSpeed) {
        focusedFace = bestIndex;
        focusedTime = 0;
        activatedIconMeshes[focusedFace].material.opacity = 1;
        iconGlowMeshes[focusedFace].material.opacity = 1;
        iconFlashMeshes[focusedFace].material.opacity = 1;
        // normalArrows[bestIndex].setColor(0x00ff00);
    }

    if (focusedFace != -1 && (focusedFace != bestIndex || bestNormal <= shapeFaceRequiredDot)) {
        focusedFace = -1;
    }

    for (let i = 0; i < 12; i++) {
        for (let letter = 0; letter < projectNamePlaceholders[i].length; letter++) {
            const show = (i == focusedFace && focusedTime >= letter * 0.025);
            
            const targetScale = show ? 1 : 0;
            const currentScale = projectNamePlaceholders[i][letter].scale.x;
            const newScale = currentScale + 0.2 * (targetScale - currentScale);
            projectNamePlaceholders[i][letter].scale.set(newScale, newScale, 1);
        
            const targetRotation = show ? 0 : 0.4;
            const currentRotation = projectNamePlaceholders[i][letter].rotation.z;
            const newRotation = currentRotation + 0.4 * (targetRotation - currentRotation);
            projectNamePlaceholders[i][letter].rotation.z = newRotation;
        }
    }
    
    for (let i = 0; i < 12; i++) {
        if (i == focusedFace) {
            activatedIconMeshes[i].material.opacity += 0.4 * (0.9 - activatedIconMeshes[i].material.opacity);
            iconGlowMeshes[i].material.opacity += 0.4 * (0.9 - iconGlowMeshes[i].material.opacity);
            const localX = new THREE.Vector3(1, 0, 0);
            const worldX = localX.clone().applyQuaternion(activatedIconMeshes[i].getWorldQuaternion(new THREE.Quaternion()));
            const currentAngle = Math.atan2(worldX.y, worldX.x);
            const spinQuaternion = new THREE.Quaternion();
            spinQuaternion.setFromAxisAngle(new THREE.Vector3(0, 0, 1), -currentAngle * 0.1);
            activatedIconMeshes[i].quaternion.premultiply(spinQuaternion);
        } else {
            const brightness = Math.pow(Math.max(0, normals[i].dot(faceDirection)), 7) * 0.5;
            activatedIconMeshes[i].material.opacity += 0.4 * (brightness - activatedIconMeshes[i].material.opacity);
            iconGlowMeshes[i].material.opacity += 0.4 * (brightness - iconGlowMeshes[i].material.opacity);
        }
        iconFlashMeshes[i].material.opacity *= 0.9;
    }

    if (mouseDown) {
        mouseVelocity.multiplyScalar(rotationFixedDeceleration);
    } else {
        if (focusedFace != -1) {
            const resolveDirection = new THREE.Vector2(-bestNormal.x, bestNormal.y);
            mouseVelocity.add(resolveDirection.multiplyScalar(rotationFacingAcceleration));
            mouseVelocity.multiplyScalar(rotationFacingDeceleration);
        } else {
            mouseVelocity.multiplyScalar(rotationFreeDeceleration);
        }
    }
    rotateShape();

    renderer.render(scene, camera);

    backgroundScrollPos.add(new THREE.Vector2(mouseVelocity.x * backgroundScrollMultiplier, mouseVelocity.y * backgroundScrollMultiplier));
    document.body.style.backgroundPosition = `${backgroundScrollPos.x}px ${backgroundScrollPos.y}px`;
}

function onPress(x, y) {

    mousePos = new THREE.Vector2(x, y);

    screenMousePos = new THREE.Vector2(
        (x / window.innerWidth) * 2 - 1,
        (y / window.innerHeight) * -2 + 1
    );
    raycaster.setFromCamera(screenMousePos, camera);
    const planeZ = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    const intersection = new THREE.Vector3();
    raycaster.ray.intersectPlane(planeZ, intersection);

    if (intersection) {
        if (shapePosition.distanceTo(intersection) <= shapeRadius) {
            mouseDown = true;
        }
    }
}

function onRelease() {

    mouseDown = false;
}

function onMove(x, y) {

    if (mouseDown) {
        mouseVelocity.add(new THREE.Vector2(x - mousePos.x, y - mousePos.y).multiplyScalar(rotationAcceleration));
    }

    mousePos = new THREE.Vector2(x, y);
}

function onWindowResize() {

    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize(window.innerWidth, window.innerHeight);
}