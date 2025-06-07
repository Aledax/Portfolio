export const shapeVertexShader = `
    attribute vec3 barycentric;
    varying vec3 vBarycentric; // Gets passed to fragment shader
    varying vec3 vNormal;

    void main() {
        vBarycentric = barycentric;
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); // These three values are provided by Three.js
    }
`;

export const shapeBackFragmentShader = `
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

export const shapeFrontFragmentShader = `
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

export const buttonVertexShader = `
    varying vec2 v_uv;

    void main() {
        v_uv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`

export const buttonFragmentShader = `
    precision mediump float;
    varying vec2 v_uv;

    uniform vec2 u_size;
    uniform float u_borderWidth;
    uniform vec4 u_borderColor;

    void main() {
        vec2 pixelPos = v_uv * u_size;

        float borderSmoothWidth = 0.01;

        float left = pixelPos.x;
        float right = u_size.x - pixelPos.x;
        float bottom = pixelPos.y;
        float top = u_size.y - pixelPos.y;

        float distance = min(min(left, right), min(bottom, top));

        
        float alpha = 0.9;
        if (distance <= borderSmoothWidth) {
            alpha *= distance / borderSmoothWidth;
        } else if (distance <= borderSmoothWidth + u_borderWidth) {
            alpha *= 1.0;
        } else if (distance <= borderSmoothWidth * 2.0 + u_borderWidth) {
            alpha *= 1.0 - (distance - borderSmoothWidth - u_borderWidth) / borderSmoothWidth;
        } else {
            alpha *= 0.2;
        }

        gl_FragColor = vec4(u_borderColor.x, u_borderColor.y, u_borderColor.z, alpha);
    }
`