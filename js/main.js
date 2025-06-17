import * as THREE from 'https://esm.sh/three@0.160.1';
import { Text } from 'https://esm.sh/troika-three-text@0.48.0?deps=three@0.160.1';
import { dodecahedronFaceCount, createDodecahedronGeometry } from './dodecahedron.js';
import { shapeVertexShader, shapeFrontFragmentShader, shapeBackFragmentShader, buttonVertexShader, buttonFragmentShader } from './shaders.js';
import { projectData } from './projectdata.js';
import { shuffle } from './shuffle.js';

// Parameters

const cameraPosition = new THREE.Vector3(0, 0, 5);
const cameraFOV = 50;
const cameraNear = 0.1;
const cameraFar = 1000;

const shapePosition = new THREE.Vector3(0, 0.31, 0);
const shapeToCamera = cameraPosition.clone().sub(shapePosition).normalize();
const shapeRadius = 1;

const shapeGlowOpacity = 0.85;
const shapeGlowWidth = 2.5;

const shapeRotationHeldSpeed = 0.005 / shapeRadius;
const shapeRotationHeldAcceleration = 0.5;
const shapeRotationHeldDeceleration = 0.75;
const shapeRotationFocusedAcceleration = 5;
const shapeRotationFocusedDeceleration = 0.9;
const shapeRotationFreeDeceleration = 0.95;

const shapeFloatAmplitude = 0.075;
const shapeFloatPeriod = 5;
const shapeFloatRotationAmplitude = 0.05;
const shapeFloatRotationOffset = shapeFloatPeriod * 0.25;

const shapeFocusMaximumSpeed = 10;
const shapeFocusRequiredDot = 0.94;

const iconGlowWidth = 0.75;
const iconFlashWidth = 1.5;
const iconDiscoveredOpacity = 0.9;
const iconFocusLerp = 0.4;
const iconFlashLerp = 0.95;

const backgroundSkyScrollSpeed = -0.75 / shapeRadius;
const backgroundStarsMidScrollSpeed = -0.85 / shapeRadius;
const backgroundStarsFrontScrollSpeed = -1.15 / shapeRadius;

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
var shapeGlowMesh, shapeZPivot, shapeBackMesh, shapeFrontMesh;

const dodecahedronGeometry = createDodecahedronGeometry(shapeRadius);
const dodecahedronNormalArray = dodecahedronGeometry.attributes.normal.array;
const dodecahedronNormals = []
for (let i = 0; i < dodecahedronFaceCount; i++) {
    dodecahedronNormals.push(new THREE.Vector3(
        dodecahedronNormalArray[i*45],
        dodecahedronNormalArray[i*45+1],
        dodecahedronNormalArray[i*45+2]
    ).normalize());
}
const barycentric = [];
for (let i = 0; i < 60; i++) {
    barycentric.push(1, 0, 0);
    barycentric.push(0, 1, 0);
    barycentric.push(0, 0, 1);
}
dodecahedronGeometry.setAttribute('barycentric', new THREE.Float32BufferAttribute(barycentric, 3));

const shapeFaceCount = dodecahedronFaceCount;

var iconPlaceholders = Array(12).fill(null);
var iconBrightMeshes = Array(12).fill(null);
var iconGlowMeshes = Array(12).fill(null);
var iconFlashMeshes = Array(12).fill(null);

var allTitlesPlaceholder = new THREE.Object3D();
var titleLetterPlaceholderPositions = [];
var titleLetterPlaceholders = [];
var titleLetterTexts = [];

var allBodiesPlaceholder = new THREE.Object3D();
var bodyPlaceholders = [];
var bodyLineTexts = [];

var allButtonsPlaceholder = new THREE.Object3D();
var buttonPlaceholders = [];
var buttonBackgroundMeshes = [];
var buttonTexts = [];

// States

var shapeMouseDown = false;

var mousePos = new THREE.Vector2();
var mouseVelocity = new THREE.Vector2();
var normalizedMousePos = new THREE.Vector2();

var backgroundSkyScrollPos = new THREE.Vector2(0, 0);
var backgroundStarsMidScrollPos = new THREE.Vector2(0, 0);
var backgroundStarsFrontScrollPos = new THREE.Vector2(0, 0);

var raycaster = new THREE.Raycaster();

var focusedFace = -1;
var discoveredFaces = Array(12).fill(false);
var focusedStopwatch = 0;

var hoveringButton = -1;

var songCounter = 0;
var radioFace;
var radioSongs;
for (let face = 0; face < shapeFaceCount; face++) {
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

/** Initialization function for the THREE.js scene. */
function init() {
    
    // SCENE & CAMERA

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(
        cameraFOV,
        window.innerWidth/window.innerHeight,
        cameraNear,
        cameraFar);
    renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x000000, 0);

    clock = new THREE.Clock();
    clock.start();

    // EVENTS

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
    const shapeGlowMaterial = new THREE.MeshBasicMaterial({
        map: glowTexture,
        transparent: true,
        opacity: shapeGlowOpacity,
        depthWrite: false,
        blending: THREE.AdditiveBlending
    });
    const shapeGlowGeometry = new THREE.PlaneGeometry(shapeGlowWidth * shapeRadius, shapeGlowWidth * shapeRadius);
    shapeGlowMesh = new THREE.Mesh(shapeGlowGeometry, shapeGlowMaterial);
    scene.add(shapeGlowMesh);

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
    shapeBackMesh = new THREE.Mesh(dodecahedronGeometry, shapeBackMaterial);
    shapeFrontMesh = new THREE.Mesh(dodecahedronGeometry, shapeFrontMaterial);
    
    const initialQuaternion = new THREE.Quaternion();
    initialQuaternion.setFromAxisAngle(new THREE.Vector3(1, 0, 0), -55 * Math.PI / 180);
    shapeBackMesh.quaternion.premultiply(initialQuaternion);
    shapeFrontMesh.quaternion.premultiply(initialQuaternion);
    shapeZPivot.add(shapeFrontMesh);
    shapeZPivot.add(shapeBackMesh);
    shapeFrontMesh.renderOrder = 1;
    shapeBackMesh.renderOrder = 0;

    // ICONS

    const iconGlowGeometry = new THREE.PlaneGeometry(iconGlowWidth * shapeRadius, iconGlowWidth * shapeRadius);
    const iconFlashGeometry = new THREE.PlaneGeometry(iconFlashWidth * shapeRadius, iconFlashWidth * shapeRadius);
    const loadingManager = new THREE.LoadingManager();
    loadingManager.onLoad = () => {
        shapeFrontMesh.updateMatrixWorld(true);

        for (let i = 0; i < 12; i++) {
            var normal = dodecahedronNormals[i];
            iconPlaceholders[i].position.copy(normal.clone().multiplyScalar(0.8 * shapeRadius));
            iconPlaceholders[i].lookAt(normal.clone().multiplyScalar(2 * shapeRadius).applyMatrix4(shapeFrontMesh.matrixWorld));
            console.log(i, normal.clone().multiplyScalar(2 * shapeRadius).applyMatrix4(shapeFrontMesh.matrixWorld));
        }

        readyCounter += 1;
    };
    const iconLoader = new THREE.TextureLoader(loadingManager);

    for (let i = 0; i < shapeFaceCount; i++) {

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
            const iconGeometry = new THREE.PlaneGeometry(0.5 * iconScale * shapeRadius, 0.5 * iconScale * shapeRadius);
            const iconPlaceholder = new THREE.Object3D();
            const activatedIconMesh = new THREE.Mesh(iconGeometry, activatedIconMaterial.clone());
            const iconGlowMesh = new THREE.Mesh(iconGlowGeometry, shapeGlowMaterial.clone());
            const iconFlashMesh = new THREE.Mesh(iconFlashGeometry, shapeGlowMaterial.clone());
            iconPlaceholders[i] = iconPlaceholder;
            iconBrightMeshes[i] = activatedIconMesh;
            activatedIconMesh.renderOrder = 2;
            iconGlowMesh.material.opacity = 0;
            iconGlowMeshes[i] = iconGlowMesh;
            iconFlashMesh.material.opacity = 0;
            iconFlashMeshes[i] = iconFlashMesh;
            
            shapeFrontMesh.add(iconPlaceholder);
            iconPlaceholder.add(activatedIconMesh);
            iconPlaceholder.add(iconGlowMesh);
            iconPlaceholder.add(iconFlashMesh);
        });
    }

    // TEXT

    allTitlesPlaceholder.position.set(0, titleY, 0);
    allBodiesPlaceholder.position.set(0, bodyY, 0);
    allButtonsPlaceholder.position.set(0, buttonY, 0);

    scene.add(allTitlesPlaceholder);
    scene.add(allBodiesPlaceholder);
    scene.add(allButtonsPlaceholder);

    for (let i = 0; i < shapeFaceCount; i++) {

        const data = projectData[i];

        // Title

        const thisTitleLetterTexts = [];
        const thisTitleLetterPlaceholders = [];
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

            const placeholder = new THREE.Object3D();
            placeholder.scale.set(0, 0, 1);
            placeholder.add(text);
            allTitlesPlaceholder.add(placeholder);

            thisTitleLetterTexts.push(text);
            thisTitleLetterPlaceholders.push(placeholder);
        }

        Promise.all(thisTitleLetterTexts.map(syncTextPromise)).then(() => {
            
            const kerning = titleKerning;
            let totalWidth = 0.0;
            const letterWidths = [];

            for (let letter = 0; letter < thisTitleLetterTexts.length; letter++) {
                thisTitleLetterTexts[letter].geometry.computeBoundingBox();
                const bbox = thisTitleLetterTexts[letter].geometry.boundingBox;
                const size = new THREE.Vector3();
                bbox.getSize(size);
                totalWidth += size.x;
                if (letter != 0) {
                    totalWidth += kerning;
                }
                letterWidths.push(size.x)
            }

            let incrementalWidth = 0;

            for (let letter = 0; letter < thisTitleLetterTexts.length; letter++) {
                const letterCenter = new THREE.Vector3(-totalWidth / 2 + incrementalWidth + letterWidths[letter] / 2, 0, 0);
                const letterTopLeft = new THREE.Vector3(-letterWidths[letter] / 2, thisTitleSize / 2, 0);
                thisTitleLetterTexts[letter].position.copy(letterTopLeft);
                incrementalWidth += letterWidths[letter] + kerning;
                titleLetterPlaceholderPositions[i].push(letterCenter);
            }

            readyCounter += 1;
        });

        titleLetterTexts.push(thisTitleLetterTexts);
        titleLetterPlaceholders.push(thisTitleLetterPlaceholders);

        // Body

        const thisBodyLineTexts = [];
        bodyLineTexts.push(thisBodyLineTexts);
        const thisBodyPlaceholder = new THREE.Object3D();
        thisBodyPlaceholder.scale.set(0, 0, 1);
        bodyPlaceholders.push(thisBodyPlaceholder);
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
                placeholder.position.set(((data.links.length - 1) / -2 + link) * buttonInterval, 0, 0);
                placeholder.scale.set(0, 0, 1);
                allButtonsPlaceholder.add(placeholder);
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
        buttonBackgroundMeshes.push(thisButtonBackgrounds);
        buttonTexts.push(thisButtonTexts);
    }

    camera.position.copy(cameraPosition);

    animate();
}

/** Per-frame update call. */
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
        focusedStopwatch += elapsed;
    }

    const rotationZ = shapeFloatRotationAmplitude * Math.cos(clock.getElapsedTime() * Math.PI * 2 / shapeFloatPeriod - shapeFloatRotationOffset);
    shapeZPivot.rotation.z = rotationZ;

    const floatY = shapeFloatAmplitude * Math.cos(clock.getElapsedTime() * Math.PI * 2 / shapeFloatPeriod);
    shapeZPivot.position.copy(shapePosition.clone().add(new THREE.Vector3(0, floatY, 0)));

    shapeGlowMesh.position.copy(shapeZPivot.position);

    const normalMatrix = new THREE.Matrix3().getNormalMatrix(shapeFrontMesh.matrixWorld);
    var highestDot = -1;
    var bestIndex = -1;
    var bestNormal = null;
    var worldNormals = [];
    for (let i = 0; i < shapeFaceCount; i++) {
        const worldNormal = dodecahedronNormals[i].clone().applyMatrix3(normalMatrix).normalize();
        const dot = worldNormal.dot(shapeToCamera);
        if (dot > highestDot) {
            highestDot = dot;
            bestIndex = i;
            bestNormal = worldNormal;
        }
        worldNormals.push(worldNormal);
    }

    for (let i = 0; i < shapeFaceCount; i++) {
        if (i == focusedFace) {
            const localX = new THREE.Vector3(1, 0, 0);
            const worldX = localX.clone().applyQuaternion(iconBrightMeshes[i].getWorldQuaternion(new THREE.Quaternion()));
            const currentAngle = Math.atan2(worldX.y, worldX.x);
            iconBrightMeshes[i].rotation.set(0, 0, iconBrightMeshes[i].rotation.z - currentAngle * 0.1);
        }
        if (discoveredFaces[i]) {
            iconBrightMeshes[i].material.opacity += iconFocusLerp * (iconDiscoveredOpacity - iconBrightMeshes[i].material.opacity);
            iconGlowMeshes[i].material.opacity += iconFocusLerp * (iconDiscoveredOpacity - iconGlowMeshes[i].material.opacity);
        } else {
            const brightness = Math.pow(Math.max(0, worldNormals[i].dot(shapeToCamera)), 6) * 0.5;
            iconBrightMeshes[i].material.opacity += iconFocusLerp * (brightness - iconBrightMeshes[i].material.opacity);
            iconGlowMeshes[i].material.opacity += iconFocusLerp * (brightness - iconGlowMeshes[i].material.opacity);
        }
        iconFlashMeshes[i].material.opacity *= iconFlashLerp;
    }

    if (!shapeMouseDown && focusedFace == -1 && bestIndex != -1 && highestDot >= shapeFocusRequiredDot && mouseVelocity.length() <= shapeFocusMaximumSpeed) {
        focusedFace = bestIndex;
        discoveredFaces[focusedFace] = true;
        focusedStopwatch = 0;
        iconBrightMeshes[focusedFace].material.opacity = 1;
        iconGlowMeshes[focusedFace].material.opacity = 1;
        iconFlashMeshes[focusedFace].material.opacity = 1;
    }

    if (focusedFace != -1 && (focusedFace != bestIndex || bestNormal <= shapeFocusRequiredDot)) {
        focusedFace = -1;
    }

    for (let i = 0; i < shapeFaceCount; i++) {

        // Titles

        for (let letter = 0; letter < titleLetterPlaceholders[i].length; letter++) {
            const show = (i == focusedFace && focusedStopwatch >= letter * titleShrinkInterval);

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
                newPosition.y = titleFloatAmplitude * Math.cos(clock.getElapsedTime() * Math.PI * 2 / titleFloatPeriod - titleFloatLetterPhaseOffset * letter);
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
        
            buttonPlaceholders[i][link].position.y = buttonFloatAmplitude * Math.cos(clock.getElapsedTime() * Math.PI * 2 / buttonFloatPeriod - buttonFloatButtonPhaseOffset * link);
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

    const q = new THREE.Quaternion();
    q.setFromAxisAngle(new THREE.Vector3(mouseVelocity.y, mouseVelocity.x, 0).normalize(), shapeRotationHeldSpeed * mouseVelocity.length());
    shapeBackMesh.quaternion.premultiply(q);
    shapeFrontMesh.quaternion.premultiply(q);

    renderer.render(scene, camera);

    backgroundSkyScrollPos.add(new THREE.Vector2(mouseVelocity.x * backgroundSkyScrollSpeed, mouseVelocity.y * backgroundSkyScrollSpeed));
    backgroundStarsMidScrollPos.add(new THREE.Vector2(mouseVelocity.x * backgroundStarsMidScrollSpeed, mouseVelocity.y * backgroundStarsMidScrollSpeed));
    backgroundStarsFrontScrollPos.add(new THREE.Vector2(mouseVelocity.x * backgroundStarsFrontScrollSpeed, mouseVelocity.y * backgroundStarsFrontScrollSpeed));
    document.body.style.backgroundPosition = `${backgroundStarsFrontScrollPos.x}px ${backgroundStarsFrontScrollPos.y}px, ${backgroundStarsMidScrollPos.x}px ${backgroundStarsMidScrollPos.y}px, ${backgroundSkyScrollPos.x}px ${backgroundSkyScrollPos.y}px`;
}

/** Check whether the mouse is hovering over any buttons and update accordingly. */
function updateHoveringLink(x, y) {

    normalizedMousePos = new THREE.Vector2(
        (x / window.innerWidth) * 2 - 1,
        (y / window.innerHeight) * -2 + 1
    );
    raycaster.setFromCamera(normalizedMousePos, camera);

    if (focusedFace != -1 && hoveringButton == -1) {
        for (let link = 0; link < buttonBackgroundMeshes[focusedFace].length; link++) {
            if (raycaster.intersectObject(buttonBackgroundMeshes[focusedFace][link]).length > 0) {
                hoveringButton = link;
                document.body.style.cursor = 'pointer';
            }
        }
    } else if (focusedFace != -1 && hoveringButton != -1) {
        if (raycaster.intersectObject(buttonBackgroundMeshes[focusedFace][hoveringButton]) == 0) {
            hoveringButton = -1;
            document.body.style.cursor = 'default';
        }
    }
}

/** Attempt to open a button link, if hovering. */
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

/** Callback function for click and touch events. */
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

/** Callback function for release and tap end events. */
function onRelease() {

    shapeMouseDown = false;
}

/** Callback function for moving the mouse or dragging the screen. */
function onMove(x, y) {

    if (shapeMouseDown) {
        mouseVelocity.add(new THREE.Vector2(x - mousePos.x, y - mousePos.y).multiplyScalar(shapeRotationHeldAcceleration));
    }

    mousePos = new THREE.Vector2(x, y);

    updateHoveringLink(x, y);
}

/** Callback function for resizing the window. */
function onWindowResize() {

    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize(window.innerWidth, window.innerHeight);
}