'use strict';

// A photographic environment on a moving world plane. This layer is optional:
// its caller keeps the Canvas 2D scene whenever draw() returns false.
const ENVIRONMENT_VERTEX_SHADER = `
    attribute vec2 aPosition;
    varying vec2 vUV;
    void main() {
      vUV = aPosition * 0.5 + 0.5;
      gl_Position = vec4(aPosition, 0.0, 1.0);
    }
  `;
const ENVIRONMENT_FRAGMENT_SHADER = `
    precision highp float;
    varying vec2 vUV;
    uniform sampler2D uPhoto;
    uniform sampler2D uCity;
    uniform vec2 uResolution;
    uniform vec2 uPhotoSize;
    uniform vec2 uCitySize;
    uniform float uTime;
    uniform float uHorizon;
    uniform float uTheme;
    uniform vec3 uLightPosition[8];
    uniform vec3 uLightColor[8];

    const float PI = 3.14159265359;
    float saturate(float x) { return clamp(x, 0.0, 1.0); }
    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
    }
    float noise(vec2 p) {
      vec2 i = floor(p), f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
                 mix(hash(i + vec2(0.0, 1.0)), hash(i + 1.0), f.x), f.y);
    }
    float cloudNoise(vec2 p) {
      float a = noise(p) * 0.57;
      p = mat2(0.8, -0.6, 0.6, 0.8) * p * 2.07 + 19.1;
      a += noise(p) * 0.28;
      p = mat2(0.8, -0.6, 0.6, 0.8) * p * 2.03 + 7.7;
      return a + noise(p) * 0.15;
    }

    // Coordinates use the original Canvas photo fit, including the sky extension.
    vec3 lakePhotograph(vec2 uv) {
      float imageHeight = uResolution.x / uResolution.y * uPhotoSize.y / uPhotoSize.x;
      float imageTop = uHorizon - imageHeight * 0.55;
      float extensionHeight = max(0.4, imageTop + imageHeight * 0.24);
      float sourceY = (uv.y - imageTop) / imageHeight;
      vec3 extendedSky = texture2D(uPhoto, clamp(vec2(uv.x, uv.y / extensionHeight * 0.24), 0.001, 0.999)).rgb;
      vec3 originalPhoto = texture2D(uPhoto, clamp(vec2(uv.x, sourceY), 0.001, 0.999)).rgb;
      vec3 photo = mix(extendedSky, originalPhoto, smoothstep(imageTop - 0.055, imageTop + 0.055, uv.y));
      float sky = 1.0 - smoothstep(0.18, max(0.38, uHorizon - 0.12), uv.y);
      // Preserve the warm lamps. Only the naturally bright photographic sky is graded down.
      photo *= mix(0.57, 0.13, sky);
      photo *= mix(vec3(1.0), vec3(0.70, 0.87, 1.12), sky);
      return photo;
    }
    vec2 lakeReprojection(vec2 uv, vec2 camera) {
      // Different distances for the low far bank and nearer trees at the right.
      float land = smoothstep(0.12, 0.55, uv.y);
      float distance = mix(1250.0, 570.0, smoothstep(0.12, 0.92, uv.x));
      float advance = camera.y / distance * land;
      vec2 pivot = vec2(0.48, uHorizon);
      vec2 p = pivot + (uv - pivot) * (1.0 - advance);
      p.x += camera.x / distance * 0.88 / (uResolution.x / uResolution.y) * land;
      return p;
    }
    vec3 lakeLandscape(vec2 uv, vec2 camera) {
      vec3 color = lakePhotograph(lakeReprojection(uv, camera));
      // Low contrast cloud shadow changes both the light and texture of the photographed sky.
      float skyMask = 1.0 - smoothstep(uHorizon - 0.37, uHorizon - 0.03, uv.y);
      vec2 cloudUV = uv * vec2(3.1, 5.2) + vec2(uTime * 0.015, -uTime * 0.003);
      float clouds = cloudNoise(cloudUV);
      color *= 1.0 - skyMask * smoothstep(0.34, 0.75, clouds) * 0.24;
      color += vec3(0.021, 0.028, 0.038) * skyMask * smoothstep(0.43, 0.77, clouds);
      return color;
    }

    // Analytic derivatives of several travelling waves. All phases are anchored
    // in metres, so forward camera travel changes the observed surface continuously.
    void wave(in vec2 p, in vec2 direction, in float frequency, in float amplitude,
              in float rate, in float distance, inout float height, inout vec2 slope) {
      float detail = 1.0 / (1.0 + distance * frequency * frequency * 0.006);
      float phase = dot(p, direction) * frequency + uTime * rate;
      float a = amplitude * detail;
      height += sin(phase) * a;
      slope += direction * (cos(phase) * a * frequency);
    }
    vec3 waterSurface(vec2 p, float distance, vec2 camera) {
      float height = 0.0;
      vec2 slope = vec2(0.0);
      wave(p, vec2(0.92, 0.39), 0.72, 0.056, -0.72, distance, height, slope);
      wave(p, vec2(-0.38, 0.925), 1.43, 0.026, 0.87, distance, height, slope);
      wave(p, vec2(0.68, -0.733), 4.6, 0.010, -1.7, distance, height, slope);
      wave(p, vec2(-0.94, -0.341), 12.8, 0.0031, 2.2, distance, height, slope);
      wave(p, vec2(0.14, 0.990), 23.0, 0.0011, -2.5, distance, height, slope);
      if (uTheme > 0.5) {
        vec2 local = p - camera;
        float bowOffset = (local.y - 2.2) * 0.7;
        float front = exp(-bowOffset * bowOffset);
        float side = abs(local.x);
        float bowPhase = side * 14.0 - local.y * 3.8 - uTime * 1.4;
        float envelope = front * exp(-side * 0.85) * 0.015;
        height += sin(bowPhase) * envelope;
        slope.x += sign(local.x) * cos(bowPhase) * 14.0 * envelope;
        slope.y -= cos(bowPhase) * 3.8 * envelope;
      }
      return vec3(height, slope);
    }
    vec3 renderLake(vec2 uv) {
      bool boat = uTheme > 0.5;
      float aspect = uResolution.x / uResolution.y;
      float eye = boat ? 1.08 : 3.35;
      float focal = 0.88;
      vec2 camera = boat ? vec2(sin(uTime * 0.029) * 1.7, uTime * 1.7)
                         : vec2(sin(uTime * 0.035) * 3.8, uTime * 0.045);
      // A slight physical roll moves the horizon and landscape together; the bow stays in the foreground layer.
      float roll = boat ? sin(uTime * 0.51) * 0.0035 + sin(uTime * 0.19) * 0.0015
                        : sin(uTime * 0.13) * 0.00045;
      vec2 centered = uv - vec2(0.5, uHorizon);
      uv = vec2(centered.x * cos(roll) - centered.y * sin(roll),
                centered.x * sin(roll) + centered.y * cos(roll)) + vec2(0.5, uHorizon);
      float bob = boat ? sin(uTime * 0.74) * 0.0013 : sin(uTime * 0.17) * 0.00035;
      uv.y += bob;
      vec3 backdrop = lakeLandscape(uv, camera);
      if (uv.y <= uHorizon) return backdrop;
      vec3 ray = normalize(vec3((uv.x - 0.5) * aspect, uHorizon - uv.y, focal));
      float distance = min(1800.0, eye / max(0.0004, -ray.y));
      vec2 p = camera + ray.xz * distance;
      vec3 surface = waterSurface(p, distance, camera);
      distance = min(1800.0, max(0.0, eye - surface.x) / max(0.0004, -ray.y));
      p = camera + ray.xz * distance;
      surface = waterSurface(p, distance, camera);
      vec3 normal = normalize(vec3(-surface.y, 1.0, -surface.z));
      vec3 reflected = reflect(ray, normal);
      float horizonFade = smoothstep(0.0, 0.012, uv.y - uHorizon);
      float reflectionZ = max(0.16, reflected.z);
      vec2 reflectedUV = vec2(0.5 + reflected.x / reflectionZ * focal / aspect,
                              uHorizon - max(0.0, reflected.y) / reflectionZ * focal);
      vec3 reflectedColor = lakeLandscape(reflectedUV, camera);
      float fresnel = 0.025 + 0.975 * pow(1.0 - saturate(dot(normal, -ray)), 5.0);
      vec3 waterBody = vec3(0.005, 0.014, 0.022);
      vec3 color = mix(waterBody, reflectedColor * 0.91, 0.23 + fresnel * 0.77);
      // A little rough photographic reflected light survives, sampled through the same moving normal field.
      vec2 roughUV = uv + surface.yz * vec2(0.045, 0.018);
      color += lakePhotograph(lakeReprojection(roughUV, camera)) * 0.10;
      float grain = mix(0.72, 0.45 + noise(p * 18.0) * 0.55, 1.0 / (1.0 + distance * 0.08));
      for (int i = 0; i < 8; i++) {
        vec3 light = uLightPosition[i];
        vec3 direction = normalize(vec3((light.x - 0.5) * aspect,
                                       max(0.025, uHorizon - light.y), focal));
        float alignment = max(0.0, dot(reflected, direction));
        float specular = pow(alignment, 220.0) * grain;
        float scattering = pow(alignment, 25.0) * 0.026;
        color += uLightColor[i] * light.z * (specular * (0.38 + fresnel * 1.8) + scattering);
      }
      // Distance haze joins the physical surface to the photographed far bank without a hard seam.
      float haze = 1.0 - exp(-distance * 0.0009);
      color = mix(color, lakeLandscape(vec2(uv.x, uHorizon - 0.006), camera) * 0.58, haze * 0.36);
      return mix(backdrop, color, horizonFade);
    }

    vec2 cityFit(vec2 uv) {
      float scale = max(uResolution.x / uCitySize.x,
                        uResolution.y / (uCitySize.y * 0.94));
      vec2 size = uCitySize * vec2(1.0, 0.94) * scale / uResolution;
      vec2 fitUV = (uv - (1.0 - size) * 0.5) / size;
      return fitUV * vec2(1.0, 0.94) + vec2(0.0, 0.06);
    }
    vec3 renderCity(vec2 uv) {
      float aspect = uResolution.x / uResolution.y;
      const float skyline = 0.27;
      float land = smoothstep(skyline - 0.04, skyline + 0.14, uv.y);
      // Row depth approximates a ground plane seen from a descending aircraft.
      // Near districts magnify and slip beneath the window more quickly than the far skyline.
      float distance = 950.0 + 3100.0 * pow(1.0 - saturate((uv.y - skyline) / (1.0 - skyline)), 1.6);
      float forward = uTime * 3.25;
      float lateral = uTime * 0.48 + sin(uTime * 0.014) * 19.0;
      vec2 pivot = vec2(0.53, skyline);
      vec2 projected = pivot + (uv - pivot) * (1.0 - forward / distance * land);
      projected.x += lateral / distance * 0.88 / aspect * land;
      projected.y += sin(uTime * 0.035) * 0.0013;
      vec2 sourceUV = cityFit(projected);
      vec3 photo = texture2D(uCity, clamp(sourceUV, 0.001, 0.999)).rgb;
      float luma = dot(photo, vec3(0.2126, 0.7152, 0.0722));
      float lamp = smoothstep(0.28, 0.78, luma) * land;
      float lampPhase = hash(floor(sourceUV * uCitySize / 6.0));
      // Lamps remain tied to their buildings, with a restrained independent fluctuation.
      photo *= 0.91 + lamp * sin(uTime * (0.55 + lampPhase) + lampPhase * 32.0) * 0.06;
      vec2 cloudPlane = vec2((uv.x - 0.5) * aspect, uv.y - skyline) * vec2(2.7, 4.7);
      cloudPlane += vec2(lateral * 0.0017 + uTime * 0.018, forward * 0.0025 - uTime * 0.006);
      float nearCloud = smoothstep(0.48, 0.78, cloudNoise(cloudPlane));
      float farCloud = smoothstep(0.54, 0.79, cloudNoise(cloudPlane * 0.54 + vec2(9.0, uTime * 0.006)));
      float veil = (nearCloud * 0.18 + farCloud * 0.10) * smoothstep(0.04, 0.28, uv.y);
      vec3 mist = vec3(0.058, 0.067, 0.079) + photo * 0.13;
      photo = mix(photo, mist, veil);
      // City light softly lights the underside of passing cloud, preserving the lamp cores.
      photo += vec3(0.032, 0.022, 0.010) * nearCloud * land * 0.19;
      return photo;
    }
    void main() {
      vec2 uv = vec2(vUV.x, 1.0 - vUV.y);
      vec3 color = uTheme > 1.5 ? renderCity(uv) : renderLake(uv);
      gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
    }
  `;

const ENVIRONMENT_SHADER_CONTRACT = Object.freeze({
  uPhoto: 'sampler2D, texture unit 0, unflipped HTML lake photo, CLAMP_TO_EDGE/LINEAR',
  uCity: 'sampler2D, texture unit 1, unflipped HTML city photo, CLAMP_TO_EDGE/LINEAR',
  uResolution: 'vec2, output framebuffer width/height in pixels',
  uPhotoSize: 'vec2, original lake image width/height in pixels',
  uCitySize: 'vec2, original city image width/height in pixels',
  uTime: 'float, show elapsed seconds in [0,180]',
  uHorizon: 'float, waterline y from top divided by viewport height',
  uTheme: 'float, shore=0, boat=1, flight=2',
  'uLightPosition[8]': 'vec3 array, x/viewportWidth, y/viewportHeight, remaining radiance power',
  'uLightColor[8]': 'vec3 array, matching light RGB values in [0,1]'
});

const photographicEnvironmentGL = (() => {
  let canvas, gl, program, vertices, lakeTexture, cityTexture;
  let lakeImage, cityImage, failed = false, lost = false;
  const uniforms = Object.create(null);
  const vertexSource = ENVIRONMENT_VERTEX_SHADER;
  const fragmentSource = ENVIRONMENT_FRAGMENT_SHADER;

  function hide() {
    if (canvas) canvas.style.display = 'none';
    return false;
  }
  function compile(type, source) {
    const shader = gl.createShader(type);
    if (!shader) throw new Error('No shader');
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      gl.deleteShader(shader);
      throw new Error('Environment shader unavailable');
    }
    return shader;
  }
  function createTexture() {
    const texture = gl.createTexture();
    if (!texture) throw new Error('No environment texture');
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
      new Uint8Array([3, 8, 14, 255]));
    return texture;
  }
  function initialize() {
    if (failed || lost) return false;
    if (gl) return true;
    try {
      canvas = document.createElement('canvas');
      canvas.id = 'environment-gl';
      canvas.setAttribute('aria-hidden', 'true');
      Object.assign(canvas.style, {
        position: 'fixed', inset: '0', width: '100%', height: '100%',
        pointerEvents: 'none', display: 'none', transform: 'none'
      });
      const worldCanvas = document.querySelector('#world');
      if (!worldCanvas?.parentNode) throw new Error('Environment not mounted');
      worldCanvas.parentNode.insertBefore(canvas, worldCanvas.nextSibling);
      gl = canvas.getContext('webgl', {
        alpha: false, antialias: false, depth: false, stencil: false,
        preserveDrawingBuffer: false, powerPreference: 'high-performance'
      });
      if (!gl) throw new Error('WebGL unavailable');
      const precision = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT);
      const fs = precision && precision.precision > 0 ? fragmentSource
        : fragmentSource.replace('precision highp float;', 'precision mediump float;');
      const vertex = compile(gl.VERTEX_SHADER, vertexSource);
      const fragment = compile(gl.FRAGMENT_SHADER, fs);
      program = gl.createProgram();
      gl.attachShader(program, vertex);
      gl.attachShader(program, fragment);
      gl.linkProgram(program);
      gl.deleteShader(vertex);
      gl.deleteShader(fragment);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('Environment link unavailable');
      gl.useProgram(program);
      vertices = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, vertices);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
      const position = gl.getAttribLocation(program, 'aPosition');
      gl.enableVertexAttribArray(position);
      gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
      for (const name of ['uPhoto', 'uCity', 'uResolution', 'uPhotoSize', 'uCitySize',
        'uTime', 'uHorizon', 'uTheme', 'uLightPosition[0]', 'uLightColor[0]']) {
        uniforms[name] = gl.getUniformLocation(program, name);
      }
      lakeTexture = createTexture();
      cityTexture = createTexture();
      gl.uniform1i(uniforms.uPhoto, 0);
      gl.uniform1i(uniforms.uCity, 1);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.disable(gl.DEPTH_TEST);
      gl.disable(gl.BLEND);
      canvas.addEventListener('webglcontextlost', event => {
        event.preventDefault();
        lost = true;
        hide();
      });
      canvas.addEventListener('webglcontextrestored', () => {
        const old = canvas;
        canvas = gl = program = vertices = lakeTexture = cityTexture = undefined;
        lakeImage = cityImage = undefined;
        lost = false;
        old.remove();
      });
      return true;
    } catch {
      failed = true;
      return hide();
    }
  }
  function ready(image) {
    return image && image.complete && (image.naturalWidth || image.width) > 0;
  }
  function upload(texture, image, unit) {
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    if (gl.getError() !== gl.NO_ERROR) throw new Error('Environment texture unavailable');
  }
  function draw(options = {}) {
    try {
      const theme = options.pov ?? (typeof pov === 'undefined' ? 'shore' : pov);
      const currentMode = options.mode ?? (typeof mode === 'undefined' ? 'symphony' : mode);
      if (currentMode !== 'symphony' || !['shore', 'boat', 'flight'].includes(theme)) return hide();
      const source = options.photos ?? (typeof photos === 'undefined' ? {} : photos);
      if (!ready(source[theme === 'flight' ? 'flight' : 'lake'])) return hide();
      if (!initialize()) return false;
      const width = Math.max(1, options.width ?? (typeof W === 'undefined' ? innerWidth : W));
      const height = Math.max(1, options.height ?? (typeof H === 'undefined' ? innerHeight : H));
      // Keep a full-HD surface sharp; cap only very large background buffers.
      const scale = Math.min(1, Math.sqrt(5760000 / (width * height)));
      const rw = Math.max(1, Math.round(width * scale));
      const rh = Math.max(1, Math.round(height * scale));
      if (canvas.width !== rw || canvas.height !== rh) {
        canvas.width = rw;
        canvas.height = rh;
        gl.viewport(0, 0, rw, rh);
      }
      gl.useProgram(program);
      if (ready(source.lake) && lakeImage !== source.lake) {
        upload(lakeTexture, source.lake, 0);
        lakeImage = source.lake;
      }
      if (ready(source.flight) && cityImage !== source.flight) {
        upload(cityTexture, source.flight, 1);
        cityImage = source.flight;
      }
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, lakeTexture);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, cityTexture);
      gl.uniform2f(uniforms.uResolution, rw, rh);
      gl.uniform2f(uniforms.uPhotoSize, source.lake?.naturalWidth || source.lake?.width || 1,
        source.lake?.naturalHeight || source.lake?.height || 1);
      gl.uniform2f(uniforms.uCitySize, source.flight?.naturalWidth || source.flight?.width || 1,
        source.flight?.naturalHeight || source.flight?.height || 1);
      const time = options.time ?? (typeof showTime === 'undefined' ? 0 : showTime);
      gl.uniform1f(uniforms.uTime, Math.max(0, Math.min(180, time)));
      const waterline = options.horizon ?? (typeof horizon === 'undefined' ? height * 0.79 : horizon);
      gl.uniform1f(uniforms.uHorizon, waterline / height);
      gl.uniform1f(uniforms.uTheme, theme === 'flight' ? 2 : theme === 'boat' ? 1 : 0);
      const lights = options.lights ?? (typeof shellLights === 'undefined' ? [] : shellLights);
      const colors = options.colors ?? (typeof RGB === 'undefined' ? [[255, 190, 100]] : RGB);
      const selected = lights.slice().sort((a, b) =>
        Math.max(0, 1 - b.age / b.life) * b.size - Math.max(0, 1 - a.age / a.life) * a.size).slice(0, 8);
      const positions = new Float32Array(24), radiance = new Float32Array(24);
      selected.forEach((light, i) => {
        const power = Math.max(0, 1 - light.age / light.life) * light.size;
        positions.set([light.x / width, light.y / height, power], i * 3);
        const rgb = colors[((light.col || 0) % colors.length + colors.length) % colors.length];
        radiance.set(rgb.map(value => value / 255), i * 3);
      });
      gl.uniform3fv(uniforms['uLightPosition[0]'], positions);
      gl.uniform3fv(uniforms['uLightColor[0]'], radiance);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      canvas.style.display = 'block';
      return true;
    } catch {
      // CORS uploads and context failures must leave the existing 2D experience usable.
      failed = true;
      return hide();
    }
  }
  return {draw, hide};
})();

function renderEnvironmentGL(options) {
  return photographicEnvironmentGL.draw(options);
}

// Project a point from the original Canvas photo fit into the moving GL view.
// Both input and output use normalized screen coordinates with their origin at
// the top left. The shoreline matte can therefore share the photographic motion.
function projectEnvironmentLandscapePoint(xNorm, yNorm, theme = 'shore', time = 0,
  horizonNorm = 0.79, aspect = 16 / 9) {
  const original = {x: xNorm, y: yNorm};
  if (theme === 'flight' || theme === 2) return original;
  if (![xNorm, yNorm, time, horizonNorm, aspect].every(Number.isFinite) || aspect <= 0) return original;
  const boat = theme === 'boat' || theme === 1;
  const t = Math.max(0, Math.min(180, time));
  const cameraX = boat ? Math.sin(t * 0.029) * 1.7 : Math.sin(t * 0.035) * 3.8;
  const cameraZ = boat ? t * 1.7 : t * 0.045;
  const lateral = cameraX * 0.88 / aspect;
  function smoothWithDerivative(low, high, value) {
    const u = Math.max(0, Math.min(1, (value - low) / (high - low)));
    return [u * u * (3 - 2 * u), 6 * u * (1 - u) / (high - low)];
  }
  let x = xNorm, y = yNorm;
  // Solve lakeReprojection(uv,camera)=originalPoint. Its analytic Jacobian avoids
  // finite-difference drift at the smooth transitions between sky and shoreline.
  for (let iteration = 0; iteration < 5; iteration++) {
    const [land, landDY] = smoothWithDerivative(0.12, 0.55, y);
    const [nearBank, nearBankDX] = smoothWithDerivative(0.12, 0.92, x);
    const distance = 1250 - 680 * nearBank;
    const distanceDX = -680 * nearBankDX;
    const a = land / distance;
    const aDX = -land * distanceDX / (distance * distance);
    const aDY = landDY / distance;
    const scale = 1 - cameraZ * a;
    const scaleDX = -cameraZ * aDX;
    const scaleDY = -cameraZ * aDY;
    const errorX = 0.48 + (x - 0.48) * scale + lateral * a - xNorm;
    const errorY = horizonNorm + (y - horizonNorm) * scale - yNorm;
    if (Math.max(Math.abs(errorX), Math.abs(errorY)) < 1e-8) break;
    const xx = scale + (x - 0.48) * scaleDX + lateral * aDX;
    const xy = (x - 0.48) * scaleDY + lateral * aDY;
    const yx = (y - horizonNorm) * scaleDX;
    const yy = scale + (y - horizonNorm) * scaleDY;
    const determinant = xx * yy - xy * yx;
    if (Math.abs(determinant) < 1e-9) return original;
    x -= Math.max(-0.5, Math.min(0.5, (yy * errorX - xy * errorY) / determinant));
    y -= Math.max(-0.5, Math.min(0.5, (-yx * errorX + xx * errorY) / determinant));
  }
  const roll = boat ? Math.sin(t * 0.51) * 0.0035 + Math.sin(t * 0.19) * 0.0015
    : Math.sin(t * 0.13) * 0.00045;
  const bob = boat ? Math.sin(t * 0.74) * 0.0013 : Math.sin(t * 0.17) * 0.00035;
  const dx = x - 0.5, dy = y - horizonNorm - bob;
  const projected = {
    x: Math.cos(roll) * dx + Math.sin(roll) * dy + 0.5,
    y: -Math.sin(roll) * dx + Math.cos(roll) * dy + horizonNorm
  };
  return Number.isFinite(projected.x + projected.y) ? projected : original;
}
