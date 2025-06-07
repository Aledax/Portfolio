import * as THREE from 'https://esm.sh/three@0.160.1';
import { Text } from 'https://esm.sh/troika-three-text@0.48.0?deps=three@0.160.1';
import { createDodecahedronGeometry } from './dodecahedron.js';
import { projectData } from './projectdata.js';

var scene, camera, renderer, clock;
var glowMesh, dodecahedronGeometry, shapeZPivot, shapeBack, shapeFront;

const rotationMultiplier = 0.005;
const rotationAcceleration = 0.5;
const rotationFacingAcceleration = 5;
const rotationFixedDeceleration = 0.75;
const rotationFreeDeceleration = 0.95;
const rotationFacingDeceleration = 0.85;
const faceMaximumSpeed = 7;
const backgroundScrollMultiplier = -1;
const shapePosition = new THREE.Vector3(0, 0.3, 0);
const shapeRadius = 1;
const shapeFloatAmplitude = 0.075;
const shapeFloatPeriod = 5;
const shapeFloatRotationAmplitude = 0.05;
const shapeFloatRotationOffset = shapeFloatPeriod * 0.25;
const shapeFaceRequiredDot = 0.91;

const titleFont = '../assets/fonts/Sophiecomic-Regular.ttf';
const titleSize = 0.6;
const titleKerning = -0.02;
const titleColor = 0xf0ffff;
const titleOpacity = 0.95;
const titleY = 1.75;
const titleShrinkRotation = 1.2;
const titleShrinkRotationLerp = 0.2;
const titleShrinkLerp = 0.2;
const titleShrinkInterval = 0.03;
const titleFloatPeriod = 4.1;
const titleFloatRotationAmplitude = 0.1;
const titleFloatRotationPhaseOffset = titleFloatPeriod / 2;
const titleFloatAmplitude = 0.01;
const titleFloatLetterPhaseOffset = 2;

const bodyFont = '../assets/fonts/Sophiecomic-Regular.ttf';
const bodySize = 0.18;
const bodyColor = 0xf0ffff;
const bodyParenthesisColor = 0xffff66;
const bodyOpacity = 1;
const bodyY = -0.9;
const bodyLineSpacing = 0.17;
const bodyLineHeight = 0.2; // Approximate, should be about equal to the actual Y
const bodyShrinkLerp = 0.2;
const bodyFloatPeriod = 4.1;
const bodyFloatRotationAmplitude = 0.03;

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

var normalArrows = [];
var iconPlaceholders = [];
var activatedIconMeshes = [];
var iconGlowMeshes = [];
var iconFlashMeshes = [];

var titleLetterTexts = [];
var titleLetterPlaceholders = [];
var titleLetterPlaceholderPositions = [];
var allTitlesPlaceholder = new THREE.Object3D();

var bodyLineTexts = [];
var bodyPlaceholders = [];
var allBodiesPlaceholder = new THREE.Object3D();

var mouseDown = false;
var mousePos = new THREE.Vector2();
var mouseVelocity = new THREE.Vector2();
var screenMousePos = new THREE.Vector2();
var backgroundScrollPos = new THREE.Vector2(0, 0);
var raycaster = new THREE.Raycaster();
var focusedFace = -1;
var focusedTime = 0;
var titleReadyCounter = 0;
var bodyReadyCounter = 0;

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

    allTitlesPlaceholder.position.set(0, titleY, 0);
    allBodiesPlaceholder.position.set(0, bodyY, 0);

    for (let i = 0; i < 12; i++) {
        const data = projectData[i];

        // Title text

        const letterTexts = [];
        const letterPlaceholders = [];
        titleLetterPlaceholderPositions.push([]);
        const thisTitleSize = data.nameSize ? titleSize * data.nameSize : titleSize;

        for (let letter = 0; letter < data.name.length; letter++) {
            const text = new Text();
            text.font = titleFont;
            text.text = data.name[letter];
            text.fontSize = thisTitleSize;
            text.color = titleColor;
            text.material.transparent = true;
            text.material.opacity = titleOpacity;
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
            const kerning = titleKerning;
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
                const letterCenter = new THREE.Vector3(-totalWidth / 2 + incrementalWidth + letterWidths[letter] / 2, titleY, 0);
                const letterTopLeft = new THREE.Vector3(-letterWidths[letter] / 2, thisTitleSize / 2, 0);
                // letterPlaceholders[letter].position.copy(letterCenter);
                letterTexts[letter].position.copy(letterTopLeft);
                incrementalWidth += letterWidths[letter] + kerning;
                titleLetterPlaceholderPositions[i].push(letterCenter);
            }

            titleReadyCounter += 1;
        });

        titleLetterTexts.push(letterTexts);
        titleLetterPlaceholders.push(letterPlaceholders);

        // Body text

        const thisBodyLineTexts = [];
        bodyLineTexts.push(thisBodyLineTexts);
        const thisBodyPlaceholder = new THREE.Object3D();
        thisBodyPlaceholder.scale.set(0, 0, 1);
        bodyPlaceholders.push(thisBodyPlaceholder);
        scene.add(allBodiesPlaceholder);
        allBodiesPlaceholder.add(thisBodyPlaceholder);

        if (data.description) {
            for (let line = 0; line < data.description.length; line++) {
                const text = new Text();
                text.font = bodyFont;
                text.text = data.description[line];
                text.fontSize = bodySize;
                text.color = line == data.description.length - 1 ? bodyParenthesisColor : bodyColor;
                text.material.transparent = true;
                text.material.opacity = bodyOpacity;
                thisBodyLineTexts.push(text);
                thisBodyPlaceholder.add(text);
            }
        }

        Promise.all(thisBodyLineTexts.map(syncTextPromise)).then(() => {
            var totalHeight;

            for (let line = 0; line < thisBodyLineTexts.length; line++) {
                thisBodyLineTexts[line].geometry.computeBoundingBox();
                const bbox = thisBodyLineTexts[line].geometry.boundingBox;
                const size = new THREE.Vector3();
                bbox.getSize(size);

                if (line == 0) {
                    totalHeight = bodyLineSpacing * (thisBodyLineTexts.length - 1) + bodyLineHeight;
                    bodyPlaceholders[i].position.y = -totalHeight / 2;
                }

                thisBodyLineTexts[line].position.x = -size.x / 2;
                thisBodyLineTexts[line].position.y = totalHeight / 2 - bodyLineSpacing * line;
            }

            bodyReadyCounter += 1;
        });
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

    const rotationZ = shapeFloatRotationAmplitude * Math.cos(clock.getElapsedTime() * Math.PI * 2 / shapeFloatPeriod - shapeFloatRotationOffset);
    shapeZPivot.rotation.z = rotationZ;

    const floatY = shapeFloatAmplitude * Math.cos(clock.getElapsedTime() * Math.PI * 2 / shapeFloatPeriod);
    shapeZPivot.position.copy(shapePosition.clone().add(new THREE.Vector3(0, floatY, 0)));

    glowMesh.position.copy(shapeZPivot.position);

    const normalMatrix = new THREE.Matrix3().getNormalMatrix(shapeFront.matrixWorld);
    const shapeNormals = dodecahedronGeometry.attributes.normal.array;
    const faceDirection = new THREE.Vector3(0, 0, 1.0);
    var highestDot = -1;
    var bestIndex = -1;
    var bestNormal = null;
    var normals = [];
    for (let i = 0; i < 12; i++) {
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

    if (titleReadyCounter == projectData.length && bodyReadyCounter == projectData.length) {
        for (let i = 0; i < 12; i++) {
            for (let letter = 0; letter < titleLetterPlaceholders[i].length; letter++) {
                const show = (i == focusedFace && focusedTime >= letter * titleShrinkInterval);

                const targetScale = show ? 1 : 0;
                const currentScale = titleLetterPlaceholders[i][letter].scale.x;
                const newScale = currentScale + titleShrinkLerp * (targetScale - currentScale);
                titleLetterPlaceholders[i][letter].scale.set(newScale, newScale, 1);
            
                const targetRotation = show ? 0 : titleShrinkRotation;
                const currentRotation = titleLetterPlaceholders[i][letter].rotation.z;
                const newRotation = currentRotation + titleShrinkRotationLerp * (targetRotation - currentRotation);
                titleLetterPlaceholders[i][letter].rotation.z = newRotation;

                if (show) {
                    const newPosition = titleLetterPlaceholderPositions[i][letter].clone();
                    newPosition.y = titleY + titleFloatAmplitude * Math.cos(clock.getElapsedTime() * Math.PI * 2 / titleFloatPeriod - titleFloatLetterPhaseOffset * letter);
                    titleLetterPlaceholders[i][letter].position.copy(newPosition);
                    titleLetterPlaceholders[i][letter].rotation.z = titleFloatRotationAmplitude * Math.cos(clock.getElapsedTime() * Math.PI * 2 / titleFloatPeriod - titleFloatRotationPhaseOffset - titleFloatLetterPhaseOffset * letter);
                }
            }

            const showBody = (i == focusedFace);

            const targetBodyScale = showBody ? 1 : 0;
            const currentBodyScale = bodyPlaceholders[i].scale.x;
            const newBodyScale = currentBodyScale + bodyShrinkLerp * (targetBodyScale - currentBodyScale);
            bodyPlaceholders[i].scale.set(newBodyScale, newBodyScale, 1);
            bodyPlaceholders[i].rotation.z = bodyFloatRotationAmplitude * Math.cos(clock.getElapsedTime() * Math.PI * 2 / bodyFloatPeriod);
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