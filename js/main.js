import * as THREE from 'https://esm.sh/three@0.160.1';
import { Text } from 'https://esm.sh/troika-three-text@0.48.0?deps=three@0.160.1';
import { createDodecahedronGeometry } from './dodecahedron.js';
import { shapeVertexShader, shapeFrontFragmentShader, shapeBackFragmentShader, buttonVertexShader, buttonFragmentShader } from './shaders.js';
import { projectData } from './projectdata.js';

// Parameters

const cameraPosition = new THREE.Vector3(0, 0, 5);

const shapeRotationHeldSpeed = 0.005;
const shapeRotationHeldAcceleration = 0.5;
const shapeRotationHeldDeceleration = 0.75;
const shapeRotationFocusedAcceleration = 5;
const shapeRotationFocusedDeceleration = 0.9;
const shapeRotationFreeDeceleration = 0.95;
const shapeFocusMaximumSpeed = 10;
const backgroundSkyScrollSpeed = -0.75;
const backgroundStarsScrollSpeed = -0.85;
const backgroundStarsScrollSpeed2 = -1.15;
const shapePosition = new THREE.Vector3(0, 0.31, 0);
const shapeToCamera = cameraPosition.clone().sub(shapePosition).normalize();
const shapeRadius = 1;
const shapeFloatAmplitude = 0.075;
const shapeFloatPeriod = 5;
const shapeFloatRotationAmplitude = 0.05;
const shapeFloatRotationOffset = shapeFloatPeriod * 0.25;
const shapeFocusRequiredDot = 0.94;

const titleFont = '../assets/fonts/Sophiecomic-Regular.ttf';
const titleSize = 0.55;
const titleKerning = -0.01;
const titleColor = 0x77ffff;
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
const bodyFontSize = 0.16;
const bodyColor = 0xf0ffff;
const bodyParenthesisColor = 0xffff66;
const bodyOpacity = 1;
const bodyY = -0.9;
const bodyLineSpacing = 0.17;
const bodyLineHeight = 0.2; // Approximate, should be about equal to the actual Y
const bodyShrinkLerp = 0.2;
const bodyFloatPeriod = 4.1;
const bodyFloatRotationAmplitude = 0.02;

const buttonFont = '../assets/fonts/Sophiecomic-Regular.ttf';
const buttonFontSize = 0.225;
const buttonFontOffsetY = 0.03;
const buttonFontColor = 0xf0ffff;
const buttonFontOpacity = 1;
const buttonSize = new THREE.Vector2(1, 0.325);
const buttonY = -1.77;
const buttonInterval = 1.2;
const buttonShrinkLerp = 0.2;
const buttonBorderWidth = 0.015;
const buttonColors = {
    'github': new THREE.Vector4(0.2, 0.85, 1, 1),
    'play': new THREE.Vector4(1, 0.2, 0.9, 1),
    'video': new THREE.Vector4(0.2, 1, 0.4, 1),
    'radio': new THREE.Vector4(0.5, 0.4, 1, 1)
}
const buttonFloatPeriod = 4.1;
const buttonFloatRotationAmplitude = 0.02;
const buttonFloatAmplitude = 0.01;
const buttonFloatRotationPhaseOffset = titleFloatPeriod / 2;
const buttonFloatButtonPhaseOffset = 2;

// Three Objects

var scene, camera, renderer, clock;
var glowMesh, dodecahedronGeometry, shapeZPivot, shapeBack, shapeFront;

var iconPlaceholders = Array(12).fill(null);
var activatedIconMeshes = Array(12).fill(null);
var iconGlowMeshes = Array(12).fill(null);
var iconFlashMeshes = Array(12).fill(null);

var titleLetterTexts = [];
var titleLetterPlaceholders = [];
var titleLetterPlaceholderPositions = [];
var allTitlesPlaceholder = new THREE.Object3D();

var bodyLineTexts = [];
var bodyPlaceholders = [];
var allBodiesPlaceholder = new THREE.Object3D();

var buttonPlaceholders = [];
var buttonBackgrounds = [];
var buttonTexts = [];

// States

var shapeMouseDown = false;
var mousePos = new THREE.Vector2();
var mouseVelocity = new THREE.Vector2();
var normalizedMousePos = new THREE.Vector2();
var backgroundSkyScrollPos = new THREE.Vector2(0, 0);
var backgroundStarsScrollPos = new THREE.Vector2(0, 0);
var backgroundStarsScrollPos2 = new THREE.Vector2(0, 0);
var raycaster = new THREE.Raycaster();
var focusedFace = -1;
var discoveredFaces = Array(12).fill(false);
var focusedTime = 0;
var hoveringButton = -1;
var songCounter = 0;
var radioFace;
var radioSongs;
for (let face = 0; face < projectData.length; face++) {
    if (projectData[face].name == 'Space Radio') {
        radioFace = face;
        radioSongs = [...projectData[face].links[0].links];
        shuffle(radioSongs);
        break;
    }
}

var readyCounter = 0;
var readyLimit = 37;
var ready = false;

function syncTextPromise(text) {
    return new Promise(resolve => text.sync(() => resolve()));
}

init();

function init() {
    
    // WINDOW

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
    document.addEventListener('mousedown', e => {
        onPress(e.clientX, e.clientY);
        tryOpenLink();
    }, false);
    document.addEventListener('mouseup', e => onRelease(e.clientX, e.clientY), false);
    document.addEventListener('mousemove', e => onMove(e.clientX, e.clientY), false);
    document.addEventListener('touchstart', e => {
        e.preventDefault();
        onPress(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: false });
    document.addEventListener('touchend', e => {
        if (shapeMouseDown) {
            e.preventDefault();
        }
        onRelease();
        tryOpenLink();
    }, { passive: false });
    document.addEventListener('touchmove', e => {
        if (shapeMouseDown) {
            e.preventDefault();
        }
        onMove(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: false });

    window.addEventListener('resize', onWindowResize, false);

    // SHAPE

    const glowLoader = new THREE.TextureLoader();
    const glowURL = new URL(
        '../assets/images/glow.png?as=webp',
        import.meta.url
    );
    const glowTexture = glowLoader.load(glowURL);
    const glowMaterial = new THREE.MeshBasicMaterial({
        map: glowTexture,
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
        blending: THREE.AdditiveBlending
    });
    const glowGeometry = new THREE.PlaneGeometry(2.5, 2.5);
    glowMesh = new THREE.Mesh(glowGeometry, glowMaterial);
    scene.add(glowMesh);

    dodecahedronGeometry = createDodecahedronGeometry(shapeRadius);
    const shapeNormals = dodecahedronGeometry.attributes.normal.array;
    const barycentric = [];
    for (let i = 0; i < 60; i++) {
        barycentric.push(1, 0, 0);
        barycentric.push(0, 1, 0);
        barycentric.push(0, 0, 1);
    }
    dodecahedronGeometry.setAttribute('barycentric', new THREE.Float32BufferAttribute(barycentric, 3));

    shapeZPivot = new THREE.Object3D();
    scene.add(shapeZPivot)
    
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
    shapeBackMaterial.depthTest = false;
    shapeBack = new THREE.Mesh(dodecahedronGeometry, shapeBackMaterial);
    shapeFront = new THREE.Mesh(dodecahedronGeometry, shapeFrontMaterial);
    
    const initialQuaternion = new THREE.Quaternion();
    initialQuaternion.setFromAxisAngle(new THREE.Vector3(1, 0, 0), -55 * Math.PI / 180);
    shapeBack.quaternion.premultiply(initialQuaternion);
    shapeFront.quaternion.premultiply(initialQuaternion);
    shapeZPivot.add(shapeBack);
    shapeZPivot.add(shapeFront);
    shapeFront.renderOrder = 1;
    shapeBack.renderOrder = 0;

    // ICONS

    const iconGlowGeometry = new THREE.PlaneGeometry(0.75, 0.75);
    const iconFlashGeometry = new THREE.PlaneGeometry(1.5, 1.5);
    const loadingManager = new THREE.LoadingManager();
    loadingManager.onLoad = () => {
        shapeFront.updateMatrixWorld(true);

        for (let i = 0; i < 12; i++) {
            const normal = new THREE.Vector3(
                shapeNormals[i*45],
                shapeNormals[i*45+1],
                shapeNormals[i*45+2]
            ).normalize();

            iconPlaceholders[i].position.copy(normal.clone().multiplyScalar(0.8));
            iconPlaceholders[i].lookAt(normal.clone().multiplyScalar(2).applyMatrix4(shapeFront.matrixWorld));
            console.log(i, normal.clone().multiplyScalar(2).applyMatrix4(shapeFront.matrixWorld));
        }

        readyCounter += 1;
    };
    const iconLoader = new THREE.TextureLoader(loadingManager);

    for (let i = 0; i < 12; i++) {

        let iconPath = `../assets/images/icons/activated/icon${i}.png?as=webp`;

        fetch(iconPath).then(response => {
            if (!response.ok) {
                iconPath = '../assets/images/icons/activated/sampleicon.png?as=webp';
            }
            const activatedIconURL = new URL(
                iconPath,
                import.meta.url
            );
            const activatedIconTexture = iconLoader.load(activatedIconURL, texture => {
                texture.minFilter = THREE.NearestFilter;
                texture.magFilter = THREE.NearestFilter;
                texture.generateMipmaps = false;
            });
            const activatedIconMaterial = new THREE.MeshBasicMaterial({
                map: activatedIconTexture,
                transparent: true,
                opacity: 0,
                depthWrite: false,
                blending: THREE.AdditiveBlending
            });
            
            let iconScale = 1;
            if (projectData[i].iconSize) {
                iconScale = projectData[i].iconSize;
            }
            const iconGeometry = new THREE.PlaneGeometry(0.5 * iconScale, 0.5 * iconScale);
            const iconPlaceholder = new THREE.Object3D();
            const activatedIconMesh = new THREE.Mesh(iconGeometry, activatedIconMaterial.clone());
            const iconGlowMesh = new THREE.Mesh(iconGlowGeometry, glowMaterial.clone());
            const iconFlashMesh = new THREE.Mesh(iconFlashGeometry, glowMaterial.clone());
            iconPlaceholders[i] = iconPlaceholder;
            activatedIconMeshes[i] = activatedIconMesh;
            activatedIconMesh.renderOrder = 2;
            iconGlowMesh.material.opacity = 0;
            iconGlowMeshes[i] = iconGlowMesh;
            iconFlashMesh.material.opacity = 0;
            iconFlashMeshes[i] = iconFlashMesh;
            
            shapeFront.add(iconPlaceholder);
            iconPlaceholder.add(activatedIconMesh);
            iconPlaceholder.add(iconGlowMesh);
            iconPlaceholder.add(iconFlashMesh);
        });
    }

    // TEXT

    allTitlesPlaceholder.position.set(0, titleY, 0);
    allBodiesPlaceholder.position.set(0, bodyY, 0);

    for (let i = 0; i < 12; i++) {
        const data = projectData[i];

        // Title

        const letterTexts = [];
        const letterPlaceholders = [];
        titleLetterPlaceholderPositions.push([]);
        const thisTitleSize = data.nameSize ? titleSize * data.nameSize : titleSize;

        for (let letter = 0; letter < data.name.length; letter++) {
            const text = new Text();
            text.font = titleFont;
            text.text = data.name[letter];
            text.sdfGlyphSize = 128;
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
            placeholder.scale.set(0, 0, 1);
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
                letterTexts[letter].position.copy(letterTopLeft);
                incrementalWidth += letterWidths[letter] + kerning;
                titleLetterPlaceholderPositions[i].push(letterCenter);
            }

            readyCounter += 1;
        });

        titleLetterTexts.push(letterTexts);
        titleLetterPlaceholders.push(letterPlaceholders);

        // Body

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
                text.sdfGlyphSize = 128;
                text.fontSize = bodyFontSize;
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

            readyCounter += 1;
        });

        // Buttons

        const thisButtonPlaceholders = [];
        const thisButtonBackgrounds = []
        const thisButtonTexts = [];

        if (data.links) {
            for (let link = 0; link < data.links.length; link++) {
                const linkData = data.links[link];

                const placeholder = new THREE.Object3D();
                placeholder.position.set(((data.links.length - 1) / -2 + link) * buttonInterval, buttonY, 0);
                placeholder.scale.set(0, 0, 1);
                scene.add(placeholder);
                thisButtonPlaceholders.push(placeholder);

                const material = new THREE.ShaderMaterial({
                    transparent: true,
                    uniforms: {
                        u_size: { value: buttonSize },
                        u_borderWidth: { value: buttonBorderWidth },
                        u_borderColor: { value: buttonColors[linkData.type] }
                    },
                    vertexShader: buttonVertexShader,
                    fragmentShader: buttonFragmentShader
                });
                const geometry = new THREE.PlaneGeometry(buttonSize.x, buttonSize.y);
                const background = new THREE.Mesh(geometry, material);
                background.scale.set(1, 1, 1);
                placeholder.add(background);
                thisButtonBackgrounds.push(background);
                
                const text = new Text();
                text.font = buttonFont;
                text.text = linkData.name;
                text.sdfGlyphSize = 128;
                text.fontSize = buttonFontSize;
                text.color = buttonFontColor;
                text.material.transparent = true;
                text.material.opacity = buttonFontOpacity;
                background.add(text);
                thisButtonTexts.push(text);
            }
        }

        Promise.all(thisButtonTexts.map(syncTextPromise)).then(() => {
            for (let link = 0; link < thisButtonTexts.length; link++) {
                thisButtonTexts[link].geometry.computeBoundingBox();
                const bbox = thisButtonTexts[link].geometry.boundingBox;
                const size = new THREE.Vector3();
                bbox.getSize(size);

                thisButtonTexts[link].position.set(-size.x / 2, size.y / 2 + buttonFontOffsetY, 0.1);
            }

            readyCounter += 1;
        });

        buttonPlaceholders.push(thisButtonPlaceholders);
        buttonBackgrounds.push(thisButtonBackgrounds);
        buttonTexts.push(thisButtonTexts);
    }

    camera.position.copy(cameraPosition);

    animate();
}

function rotateShape() {
    const q = new THREE.Quaternion();
    q.setFromAxisAngle(new THREE.Vector3(mouseVelocity.y, mouseVelocity.x, 0).normalize(), shapeRotationHeldSpeed * mouseVelocity.length());
    shapeBack.quaternion.premultiply(q);
    shapeFront.quaternion.premultiply(q);
}

function animate() {

    requestAnimationFrame(animate);
    if (readyCounter < readyLimit) return;

    if (!ready) {
        ready = true;
        setTimeout(() => {
            document.getElementById('loading-screen').style.opacity = 0;
            document.getElementById('loading-screen').style.pointerEvents = 'none';
        });
    }

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
    var highestDot = -1;
    var bestIndex = -1;
    var bestNormal = null;
    var localNormals = [];
    var worldNormals = [];
    for (let i = 0; i < 12; i++) {
        const localNormal = new THREE.Vector3(shapeNormals[i*45], shapeNormals[(i*45)+1], shapeNormals[(i*45)+2]).normalize();
        localNormals.push(localNormal);
        const worldNormal = localNormal.applyMatrix3(normalMatrix).normalize();
        const dot = worldNormal.dot(shapeToCamera);
        if (dot > highestDot) {
            highestDot = dot;
            bestIndex = i;
            bestNormal = worldNormal;
        }
        worldNormals.push(worldNormal);
    }

    for (let i = 0; i < 12; i++) {
        if (i == focusedFace) {
            const localX = new THREE.Vector3(1, 0, 0);
            const worldX = localX.clone().applyQuaternion(activatedIconMeshes[i].getWorldQuaternion(new THREE.Quaternion()));
            const currentAngle = Math.atan2(worldX.y, worldX.x);
            activatedIconMeshes[i].rotation.set(0, 0, activatedIconMeshes[i].rotation.z - currentAngle * 0.1);
        }
        if (discoveredFaces[i]) {
            activatedIconMeshes[i].material.opacity += 0.4 * (0.9 - activatedIconMeshes[i].material.opacity);
            iconGlowMeshes[i].material.opacity += 0.4 * (0.9 - iconGlowMeshes[i].material.opacity);
        } else {
            const brightness = Math.pow(Math.max(0, worldNormals[i].dot(shapeToCamera)), 6) * 0.5;
            activatedIconMeshes[i].material.opacity += 0.4 * (brightness - activatedIconMeshes[i].material.opacity);
            iconGlowMeshes[i].material.opacity += 0.4 * (brightness - iconGlowMeshes[i].material.opacity);
        }
        iconFlashMeshes[i].material.opacity *= 0.95;
    }

    if (!shapeMouseDown && focusedFace == -1 && bestIndex != -1 && highestDot >= shapeFocusRequiredDot && mouseVelocity.length() <= shapeFocusMaximumSpeed) {
        focusedFace = bestIndex;
        discoveredFaces[focusedFace] = true;
        focusedTime = 0;
        activatedIconMeshes[focusedFace].material.opacity = 1;
        iconGlowMeshes[focusedFace].material.opacity = 1;
        iconFlashMeshes[focusedFace].material.opacity = 1;
    }

    if (focusedFace != -1 && (focusedFace != bestIndex || bestNormal <= shapeFocusRequiredDot)) {
        focusedFace = -1;
    }

    for (let i = 0; i < 12; i++) {

        // Titles

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

        // Bodies

        const showBody = (i == focusedFace);

        const targetBodyScale = showBody ? 1 : 0;
        const currentBodyScale = bodyPlaceholders[i].scale.x;
        const newBodyScale = currentBodyScale + bodyShrinkLerp * (targetBodyScale - currentBodyScale);
        bodyPlaceholders[i].scale.set(newBodyScale, newBodyScale, 1);
        bodyPlaceholders[i].rotation.z = bodyFloatRotationAmplitude * Math.cos(clock.getElapsedTime() * Math.PI * 2 / bodyFloatPeriod);
    
        // Buttons

        for (let link = 0; link < buttonPlaceholders[i].length; link++) {
            const show = (i == focusedFace);

            const targetScale = show ? (link == hoveringButton ? 1.15 : 1) : 0;
            const currentScale = buttonPlaceholders[i][link].scale.x;
            const newScale = currentScale + buttonShrinkLerp * (targetScale - currentScale);
            buttonPlaceholders[i][link].scale.set(newScale, newScale, 1);
        
            buttonPlaceholders[i][link].position.y = buttonY + buttonFloatAmplitude * Math.cos(clock.getElapsedTime() * Math.PI * 2 / buttonFloatPeriod - buttonFloatButtonPhaseOffset * link);
            buttonPlaceholders[i][link].rotation.z = buttonFloatRotationAmplitude * Math.cos(clock.getElapsedTime() * Math.PI * 2 / buttonFloatPeriod - buttonFloatRotationPhaseOffset - buttonFloatButtonPhaseOffset * link);
        }
    }

    if (shapeMouseDown) {
        mouseVelocity.multiplyScalar(shapeRotationHeldDeceleration);
    } else {
        if (focusedFace != -1) {
            const resolveDirection = shapeToCamera.clone().sub(bestNormal);
            const angularMagnitude = resolveDirection.length();
            const resolveDirection2D = new THREE.Vector2(resolveDirection.x, -resolveDirection.y).normalize();
            mouseVelocity.add(resolveDirection2D.multiplyScalar(shapeRotationFocusedAcceleration * angularMagnitude));
            mouseVelocity.multiplyScalar(shapeRotationFocusedDeceleration);
        } else {
            mouseVelocity.multiplyScalar(shapeRotationFreeDeceleration);
        }
    }
    rotateShape();

    renderer.render(scene, camera);

    backgroundSkyScrollPos.add(new THREE.Vector2(mouseVelocity.x * backgroundSkyScrollSpeed, mouseVelocity.y * backgroundSkyScrollSpeed));
    backgroundStarsScrollPos.add(new THREE.Vector2(mouseVelocity.x * backgroundStarsScrollSpeed, mouseVelocity.y * backgroundStarsScrollSpeed));
    backgroundStarsScrollPos2.add(new THREE.Vector2(mouseVelocity.x * backgroundStarsScrollSpeed2, mouseVelocity.y * backgroundStarsScrollSpeed2));
    document.body.style.backgroundPosition = `${backgroundStarsScrollPos.x}px ${backgroundStarsScrollPos.y}px, ${backgroundStarsScrollPos2.x}px ${backgroundStarsScrollPos2.y}px, ${backgroundSkyScrollPos.x}px ${backgroundSkyScrollPos.y}px`;
}

function updateHoveringLink(x, y) {
    normalizedMousePos = new THREE.Vector2(
        (x / window.innerWidth) * 2 - 1,
        (y / window.innerHeight) * -2 + 1
    );
    raycaster.setFromCamera(normalizedMousePos, camera);

    if (focusedFace != -1 && hoveringButton == -1) {
        for (let link = 0; link < buttonBackgrounds[focusedFace].length; link++) {
            if (raycaster.intersectObject(buttonBackgrounds[focusedFace][link]).length > 0) {
                hoveringButton = link;
                document.body.style.cursor = 'pointer';
            }
        }
    } else if (focusedFace != -1 && hoveringButton != -1) {
        if (raycaster.intersectObject(buttonBackgrounds[focusedFace][hoveringButton]) == 0) {
            hoveringButton = -1;
            document.body.style.cursor = 'default';
        }
    }
}

function shuffle(array) {
    for (let i = 0; i < array.length; i++) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

function tryOpenLink() {
    if (focusedFace != -1 && hoveringButton != -1) {
        if (focusedFace == radioFace) {
            window.open(radioSongs[songCounter], '_blank');
            songCounter += 1;
            if (songCounter == radioSongs.length) {
                shuffle(radioSongs);
                songCounter = 0;
            }
        } else {
            window.open(projectData[focusedFace].links[hoveringButton].link, '_blank');
        }
        hoveringButton = -1;
    }
}

function onPress(x, y) {

    if (!ready) return;

    mousePos = new THREE.Vector2(x, y);

    normalizedMousePos = new THREE.Vector2(
        (x / window.innerWidth) * 2 - 1,
        (y / window.innerHeight) * -2 + 1
    );
    raycaster.setFromCamera(normalizedMousePos, camera);
    const planeZ = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    const intersection = new THREE.Vector3();
    raycaster.ray.intersectPlane(planeZ, intersection);

    if (intersection) {
        if (shapePosition.distanceTo(intersection) <= shapeRadius) {
            shapeMouseDown = true;
        }
    }

    updateHoveringLink(x, y);
}

function onRelease() {

    shapeMouseDown = false;
}

function onMove(x, y) {

    if (shapeMouseDown) {
        mouseVelocity.add(new THREE.Vector2(x - mousePos.x, y - mousePos.y).multiplyScalar(shapeRotationHeldAcceleration));
    }

    mousePos = new THREE.Vector2(x, y);

    updateHoveringLink(x, y);
}

function onWindowResize() {

    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize(window.innerWidth, window.innerHeight);
}