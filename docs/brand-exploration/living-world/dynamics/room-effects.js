/**
 * Local, decorative room effects. Geometry is normalized in detail.vibe;
 * time is caller-owned elapsed seconds, so paused/reduced-motion frames freeze.
 * No actor positions, observations, clocks or animation loops are owned here.
 */
export function createRoomEffects({ width = 1536, height = 1024 } = {}) {
  const tau = Math.PI * 2
  const clamp = (value, low, high) => Math.max(low, Math.min(high, value))
  const number = (value, fallback) =>
    Number.isFinite(value) ? value : fallback
  const phase = (time, seconds) => (((number(time, 0) / seconds) % 1) + 1) % 1
  const seeded = (index) => {
    const value = Math.sin(index * 127.1 + 311.7) * 43758.5453
    return value - Math.floor(value)
  }
  const canvas = (w, h) => {
    const node = document.createElement('canvas')
    node.width = Math.max(1, Math.ceil(w))
    node.height = Math.max(1, Math.ceil(h))
    return node
  }
  const point = (value) =>
    Array.isArray(value) &&
    value.length >= 2 &&
    value.slice(0, 2).every(Number.isFinite)
  const polygon = (points) =>
    Array.isArray(points) && points.length >= 3 && points.every(point)
  const rgb = (hex = '#d7b4ee') => {
    const match = /^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(hex)
    return match
      ? match.slice(1).map((channel) => parseInt(channel, 16) / 255)
      : [0.84, 0.71, 0.93]
  }
  let intensity = 1
  let bathhouseWaterfalls = 3.15
  let bathhouseWaves = 1.5
  const alpha = (value) => clamp(number(value, 0) * intensity, 0, 1)
  const amplitude = (gain = 0.35) => 1 + (intensity - 1) * gain
  function setIntensity(value) {
    intensity = clamp(number(value, 1), 0, 5)
  }
  function setBathhouseStrengths({
    waterfalls = bathhouseWaterfalls,
    waves = bathhouseWaves
  } = {}) {
    bathhouseWaterfalls = clamp(number(waterfalls, 3.15), 0, 5)
    bathhouseWaves = clamp(number(waves, 1.5), 0, 5)
  }

  let scene = null
  let image = null
  let detail = null
  let beams = []
  let curtains = []
  let glazes = []
  let motes = []
  let spores = []
  let flows = []
  let water = []
  let waterReflectionTexture = null
  let waterfalls = []
  let waterfallTexture = null
  let mist = []
  let mistTexture = null
  let paint = []
  let mobiles = []
  let flecks = []
  let fire = null
  let fireShader = null
  let fireFrames = []
  let spill = []
  let embers = []
  let constellations = []
  let templeLight = []
  let stars = []
  let warmth = null
  let warmGlowsLeft = 0
  let frameScenery = true
  let shader = null
  let frameEnabled = true
  let disposed = false

  function maskGeometry(points) {
    if (!polygon(points)) return null
    const pixels = points.map(([x, y]) => [
      clamp(x, 0, 1) * width,
      clamp(y, 0, 1) * height
    ])
    const x = Math.floor(Math.min(...pixels.map((p) => p[0])))
    const y = Math.floor(Math.min(...pixels.map((p) => p[1])))
    const w = Math.ceil(Math.max(...pixels.map((p) => p[0]))) - x
    const h = Math.ceil(Math.max(...pixels.map((p) => p[1]))) - y
    if (w < 2 || h < 2) return null
    const path = new Path2D()
    pixels.forEach(([px, py], index) =>
      index ? path.lineTo(px, py) : path.moveTo(px, py)
    )
    path.closePath()
    return { x, y, w, h, path, pixels }
  }

  function crop(bounds, maxDimension = 512) {
    const scale = Math.min(1, maxDimension / Math.max(bounds.w, bounds.h))
    const node = canvas(bounds.w * scale, bounds.h * scale)
    const context = node.getContext('2d')
    if (!context || !image) return null
    context.drawImage(
      image,
      bounds.x,
      bounds.y,
      bounds.w,
      bounds.h,
      0,
      0,
      node.width,
      node.height
    )
    return node
  }

  function glow(color, size = 64) {
    const node = canvas(size, size)
    const context = node.getContext('2d')
    if (!context) return null
    const gradient = context.createRadialGradient(
      size / 2,
      size / 2,
      0,
      size / 2,
      size / 2,
      size / 2
    )
    gradient.addColorStop(0, color)
    gradient.addColorStop(0.24, color)
    gradient.addColorStop(1, 'transparent')
    context.fillStyle = gradient
    context.fillRect(0, 0, size, size)
    return node
  }

  function prepareBeams(config) {
    return (config ?? []).slice(0, 3).flatMap((beam, index) => {
      const bounds = maskGeometry(beam.polygon)
      if (!bounds) return []
      const node = canvas(bounds.w, bounds.h)
      const context = node.getContext('2d')
      if (!context) return []
      context.translate(-bounds.x, -bounds.y)
      context.clip(bounds.path)
      const from = point(beam.from) ? beam.from : beam.polygon[0]
      const to = point(beam.to) ? beam.to : beam.polygon.at(-1)
      const gradient = context.createLinearGradient(
        from[0] * width,
        from[1] * height,
        to[0] * width,
        to[1] * height
      )
      gradient.addColorStop(0, beam.color ?? '#ccdcf6')
      gradient.addColorStop(1, 'transparent')
      context.fillStyle = gradient
      context.fillRect(bounds.x, bounds.y, bounds.w, bounds.h)
      return [
        {
          ...bounds,
          node,
          opacity: clamp(number(beam.opacity, 0.09), 0, 0.16),
          phase: index * 1.7
        }
      ]
    })
  }

  function prepareParticles(emitters, budget, baseColor) {
    const particles = []
    for (const [index, emitter] of (emitters ?? []).slice(0, 4).entries()) {
      if (
        ![emitter.x, emitter.y, emitter.rx, emitter.ry].every(Number.isFinite)
      )
        continue
      const count = Math.min(
        budget - particles.length,
        Math.max(0, Math.floor(number(emitter.count, 8)))
      )
      for (let i = 0; i < count; i++) {
        const seed = index * 43 + i * 7 + 1
        particles.push({
          x: clamp(emitter.x, 0, 1) * width,
          y: clamp(emitter.y, 0, 1) * height,
          rx: clamp(emitter.rx, 0, 0.3) * width,
          ry: clamp(emitter.ry, 0, 0.4) * height,
          seed: seeded(seed),
          drift: seeded(seed + 19) * 2 - 1,
          radius: 0.8 + seeded(seed + 5) * 1.5,
          seconds: 20 + seeded(seed + 3) * 12,
          color: emitter.color ?? baseColor
        })
      }
      if (particles.length === budget) break
    }
    return particles
  }

  function prepareFlows(config) {
    let budget = 24
    return (config ?? []).slice(0, 6).flatMap((flow, index) => {
      if (
        !Array.isArray(flow.points) ||
        flow.points.length !== 4 ||
        !flow.points.every(point)
      )
        return []
      const points = flow.points.map(([x, y]) => [
        clamp(x, 0, 1) * width,
        clamp(y, 0, 1) * height
      ])
      const samples = Array.from({ length: 65 }, (_, sample) => {
        const t = sample / 64,
          u = 1 - t
        return [0, 1].map(
          (axis) =>
            u ** 3 * points[0][axis] +
            3 * u ** 2 * t * points[1][axis] +
            3 * u * t ** 2 * points[2][axis] +
            t ** 3 * points[3][axis]
        )
      })
      const count = Math.min(
        budget,
        clamp(Math.floor(number(flow.count, 4)), 0, 8)
      )
      budget -= count
      const path = new Path2D()
      path.moveTo(...points[0])
      path.bezierCurveTo(...points[1], ...points[2], ...points[3])
      const color = flow.color ?? '#ffd899'
      return [
        {
          samples,
          path,
          count,
          color,
          sprite: glow(color),
          seconds: clamp(number(flow.seconds, 12), 6, 30),
          phase: index * 0.173
        }
      ]
    })
  }

  // Three shared, soft alpha textures serve all authored water/fall regions.
  // Their periodic vertical fields can scroll without seams or per-frame pixels.
  function prepareWaterTexture(kind) {
    const w = kind === 'falls' ? 64 : 384
    const h = kind === 'mist' ? 64 : 192
    const node = canvas(w, h)
    const context = node.getContext('2d')
    if (!context) return null
    const pixels = context.createImageData(w, h)
    for (let y = 0; y < h; y++) {
      const ny = y / h
      for (let x = 0; x < w; x++) {
        const nx = x / (w - 1)
        let light = 0
        if (kind === 'reflection') {
          for (let band = 0; band < 3; band++) {
            const center =
              (0.12 +
                band * 0.32 +
                Math.sin(nx * 4.5 + band * 1.8) * 0.045 +
                nx * 0.09) %
              1
            const separation = Math.abs(ny - center)
            const distance = Math.min(separation, 1 - separation)
            const softness = band === 1 ? 0.078 : 0.042
            light +=
              Math.exp(-((distance / softness) ** 2)) *
              (band === 1 ? 0.65 : 0.85)
          }
          light *= 0.8 + Math.sin(nx * Math.PI) * 0.2
        } else if (kind === 'falls') {
          for (let stream = 0; stream < 5; stream++) {
            const center = 0.1 + stream * 0.2 + Math.sin(stream * 2.4) * 0.035
            const width = 0.016 + (stream % 2) * 0.009
            const vertical = Math.max(
              0,
              Math.sin((ny * 2 + stream * 0.31) * tau)
            )
            light +=
              Math.exp(-(((nx - center) / width) ** 2)) * (0.1 + vertical * 0.9)
          }
        } else {
          const center = 0.52 + Math.sin(nx * 6.5) * 0.13
          const shoulder = 0.33 + Math.sin(nx * 5.2 + 1.5) * 0.1
          light =
            (Math.exp(-(((ny - center) / 0.09) ** 2)) * 0.72 +
              Math.exp(-(((ny - shoulder) / 0.05) ** 2)) * 0.22) *
            Math.sin(nx * Math.PI) ** 1.4
        }
        const offset = (y * w + x) * 4
        pixels.data[offset] = kind === 'reflection' ? 205 : 225
        pixels.data[offset + 1] = kind === 'mist' ? 241 : 255
        pixels.data[offset + 2] = kind === 'reflection' ? 241 : 247
        pixels.data[offset + 3] = clamp(light, 0, 1) * 255
      }
    }
    context.putImageData(pixels, 0, 0)
    return node
  }

  function prepareMist(config) {
    return (config ?? []).slice(0, 3).flatMap((field) => {
      if (
        ![field.x, field.y, field.rx, field.ry].every(Number.isFinite) ||
        field.rx <= 0 ||
        field.ry <= 0
      )
        return []
      const rx = clamp(field.rx, 0, 0.25),
        ry = clamp(field.ry, 0, 0.08)
      const bounds = maskGeometry([
        [field.x - rx, field.y - ry],
        [field.x + rx, field.y - ry],
        [field.x + rx, field.y + ry],
        [field.x - rx, field.y + ry]
      ])
      return bounds
        ? [{ ...bounds, opacity: clamp(number(field.opacity, 0.12), 0, 0.25) }]
        : []
    })
  }

  function curveSamples(points, steps = 40) {
    return Array.from({ length: steps + 1 }, (_, index) => {
      const t = index / steps,
        u = 1 - t
      return [0, 1].map(
        (axis) =>
          u ** 3 * points[0][axis] +
          3 * u ** 2 * t * points[1][axis] +
          3 * u * t ** 2 * points[2][axis] +
          t ** 3 * points[3][axis]
      )
    })
  }

  function preparePaint(config) {
    return (config ?? []).slice(0, 4).flatMap((surface, index) => {
      const bounds = maskGeometry(surface.polygon)
      if (!bounds) return []
      const strokes = (surface.strokes ?? []).slice(0, 5).flatMap((stroke) => {
        if (
          !Array.isArray(stroke.points) ||
          stroke.points.length !== 4 ||
          !stroke.points.every(point)
        )
          return []
        return [
          {
            samples: curveSamples(
              stroke.points.map(([x, y]) => [
                clamp(x, 0, 1) * width,
                clamp(y, 0, 1) * height
              ])
            ),
            color: stroke.color ?? '#447bc9',
            width: clamp(number(stroke.width, 0.004), 0.001, 0.014) * width
          }
        ]
      })
      return [
        {
          ...bounds,
          strokes,
          seconds: clamp(number(surface.seconds, 28), 18, 45),
          seed: seeded(index + 271)
        }
      ]
    })
  }

  function prepareConstellations(config) {
    let remaining = 24
    return (config ?? []).slice(0, 6).flatMap((group, index) => {
      if (!Array.isArray(group.points)) return []
      const points = group.points
        .filter(point)
        .slice(0, Math.min(remaining, 8))
        .map(([x, y]) => [clamp(x, 0, 1) * width, clamp(y, 0, 1) * height])
      if (points.length < 2) return []
      remaining -= points.length
      return [
        {
          points,
          color: group.color ?? '#f4dba4',
          seed: seeded(index + 619),
          mask: maskGeometry(group.polygon)
        }
      ]
    })
  }

  function createGlazeShader(patches) {
    const output = canvas(384, 384)
    let gl
    try {
      gl = output.getContext('webgl', {
        alpha: false,
        antialias: false,
        depth: false,
        stencil: false,
        preserveDrawingBuffer: false,
        powerPreference: 'low-power'
      })
    } catch {
      return null
    }
    if (!gl) return null
    let program = null
    let buffer = null
    let lost = false
    const shaders = []
    const textures = []
    const onLost = () => {
      lost = true
    }
    output.addEventListener('webglcontextlost', onLost)
    function release() {
      output.removeEventListener('webglcontextlost', onLost)
      for (const texture of textures) gl.deleteTexture(texture)
      for (const compiled of shaders) gl.deleteShader(compiled)
      if (buffer) gl.deleteBuffer(buffer)
      if (program) gl.deleteProgram(program)
      gl.getExtension('WEBGL_lose_context')?.loseContext()
      output.width = 1
      output.height = 1
    }
    function compile(type, source) {
      const compiled = gl.createShader(type)
      if (!compiled) throw new Error('Shader unavailable')
      shaders.push(compiled)
      gl.shaderSource(compiled, source)
      gl.compileShader(compiled)
      if (!gl.getShaderParameter(compiled, gl.COMPILE_STATUS))
        throw new Error('Shader could not compile')
      return compiled
    }
    try {
      const vertex = compile(
        gl.VERTEX_SHADER,
        `
        attribute vec2 aPosition;
        varying vec2 vUV;
        void main() { vUV = aPosition * 0.5 + 0.5; gl_Position = vec4(aPosition, 0.0, 1.0); }
      `
      )
      const fragment = compile(
        gl.FRAGMENT_SHADER,
        `
        precision mediump float;
        uniform sampler2D uImage;
        uniform vec2 uPixel;
        uniform float uPhase;
        uniform float uStrength;
        uniform vec3 uTint;
        varying vec2 vUV;
        void main() {
          float edge = smoothstep(0.0, 0.12, vUV.x) * smoothstep(0.0, 0.12, vUV.y)
            * smoothstep(0.0, 0.12, 1.0 - vUV.x) * smoothstep(0.0, 0.12, 1.0 - vUV.y);
          vec2 wave = vec2(sin(vUV.y * 14.0 + uPhase), cos(vUV.x * 12.0 - uPhase));
          vec2 uv = clamp(vUV + wave * uPixel * uStrength * 5.0 * edge, vec2(0.001), vec2(0.999));
          vec3 base = texture2D(uImage, uv).rgb;
          float sheen = (0.5 + 0.5 * sin((vUV.x + vUV.y) * 7.0 - uPhase)) * edge;
          vec3 glaze = base * (vec3(0.92) + uTint * 0.17);
          gl_FragColor = vec4(mix(base, glaze, clamp(sheen * uStrength * 0.6, 0.0, 1.0)), 1.0);
        }
      `
      )
      program = gl.createProgram()
      if (!program) throw new Error('Program unavailable')
      gl.attachShader(program, vertex)
      gl.attachShader(program, fragment)
      gl.linkProgram(program)
      if (!gl.getProgramParameter(program, gl.LINK_STATUS))
        throw new Error('Shader could not link')
      buffer = gl.createBuffer()
      if (!buffer) throw new Error('Buffer unavailable')
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
        gl.STATIC_DRAW
      )
      gl.useProgram(program)
      const position = gl.getAttribLocation(program, 'aPosition')
      gl.enableVertexAttribArray(position)
      gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0)
      const locations = Object.fromEntries(
        ['uImage', 'uPixel', 'uPhase', 'uStrength', 'uTint'].map((key) => [
          key,
          gl.getUniformLocation(program, key)
        ])
      )
      gl.activeTexture(gl.TEXTURE0)
      gl.uniform1i(locations.uImage, 0)
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
      for (const patch of patches) {
        const texture = gl.createTexture()
        if (!texture) throw new Error('Texture unavailable')
        textures.push(texture)
        gl.bindTexture(gl.TEXTURE_2D, texture)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
        gl.texImage2D(
          gl.TEXTURE_2D,
          0,
          gl.RGBA,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          patch.node
        )
      }
      gl.viewport(0, 0, 384, 384)
      return {
        get available() {
          return !lost && !gl.isContextLost()
        },
        draw(index, time) {
          if (lost || gl.isContextLost()) return null
          const patch = patches[index]
          gl.bindTexture(gl.TEXTURE_2D, textures[index])
          gl.uniform2f(locations.uPixel, 1 / patch.w, 1 / patch.h)
          gl.uniform1f(locations.uPhase, phase(time, 24) * tau)
          gl.uniform1f(locations.uStrength, patch.strength * intensity)
          gl.uniform3fv(locations.uTint, patch.tint)
          gl.drawArrays(gl.TRIANGLES, 0, 6)
          return output
        },
        dispose: release
      }
    } catch {
      release()
      return null
    }
  }

  function createFireShader() {
    const output = canvas(192, 256)
    let gl
    try {
      gl = output.getContext('webgl', {
        alpha: true,
        premultipliedAlpha: false,
        antialias: false,
        depth: false,
        stencil: false,
        powerPreference: 'low-power'
      })
    } catch {
      return null
    }
    if (!gl) return null
    let program = null,
      buffer = null,
      lost = false
    const shaders = []
    const onLost = () => {
      lost = true
    }
    output.addEventListener('webglcontextlost', onLost)
    function release() {
      output.removeEventListener('webglcontextlost', onLost)
      for (const compiled of shaders) gl.deleteShader(compiled)
      if (buffer) gl.deleteBuffer(buffer)
      if (program) gl.deleteProgram(program)
      gl.getExtension('WEBGL_lose_context')?.loseContext()
      output.width = 1
      output.height = 1
    }
    function compile(type, source) {
      const compiled = gl.createShader(type)
      if (!compiled) throw new Error('Shader unavailable')
      shaders.push(compiled)
      gl.shaderSource(compiled, source)
      gl.compileShader(compiled)
      if (!gl.getShaderParameter(compiled, gl.COMPILE_STATUS))
        throw new Error('Flame shader could not compile')
      return compiled
    }
    try {
      const vertex = compile(
        gl.VERTEX_SHADER,
        `
        attribute vec2 aPosition;
        varying vec2 vUV;
        void main() { vUV = aPosition * 0.5 + 0.5; gl_Position = vec4(aPosition, 0.0, 1.0); }
      `
      )
      const fragment = compile(
        gl.FRAGMENT_SHADER,
        `
        precision highp float;
        varying vec2 vUV;
        uniform float uTime;
        float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float noise(vec2 p) {
          vec2 i = floor(p), f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
            mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
        }
        float fbm(vec2 p) {
          float value = 0.0, weight = 0.5;
          for (int i = 0; i < 4; i++) {
            value += weight * noise(p);
            p = mat2(1.6, -1.2, 1.2, 1.6) * p + vec2(7.1, 3.4);
            weight *= 0.5;
          }
          return value;
        }
        float plume(vec2 p, float root, float height, float t) {
          float h = clamp(p.y / height, 0.0, 1.0);
          float rising = fbm(vec2((p.x - root) * 5.0, h * 5.2 - t * 0.68));
          float bend = sin(h * 5.0 - t * 0.52 + root * 8.0) * 0.06 * h;
          float warp = (rising - 0.45) * (0.09 + h * 0.3) + bend;
          float radius = 0.245 * pow(max(0.0, 1.0 - h), 0.7) + 0.015;
          float edge = radius - abs(p.x - root + warp);
          float body = smoothstep(-0.08, 0.07, edge);
          float tip = 1.0 - smoothstep(0.64, 1.0, h + (0.45 - rising) * 0.36);
          return body * tip * (0.55 + rising * 0.5);
        }
        void main() {
          vec2 p = vec2((vUV.x - 0.5) * 2.25, (vUV.y - 0.025) / 0.96);
          float a = plume(p, -0.19, 0.73, uTime + 3.2);
          float b = plume(p, 0.015, 0.98, uTime);
          float c = plume(p, 0.21, 0.79, uTime + 7.3);
          float density = max(b, max(a, c) * 0.86);
          float core = exp(-pow(p.x * 4.8, 2.0)) * pow(max(0.0, 1.0 - p.y), 2.2);
          vec3 color = mix(vec3(0.96, 0.28, 0.15), vec3(1.0, 0.67, 0.29), smoothstep(0.1, 0.7, density));
          color = mix(color, vec3(1.0, 0.94, 0.7), clamp(core * 1.1, 0.0, 1.0));
          float alpha = density * 0.83 * smoothstep(0.0, 0.055, p.y);
          gl_FragColor = vec4(color, clamp(alpha, 0.0, 0.88));
        }
      `
      )
      program = gl.createProgram()
      if (!program) throw new Error('Program unavailable')
      gl.attachShader(program, vertex)
      gl.attachShader(program, fragment)
      gl.linkProgram(program)
      if (!gl.getProgramParameter(program, gl.LINK_STATUS))
        throw new Error('Flame shader could not link')
      buffer = gl.createBuffer()
      if (!buffer) throw new Error('Buffer unavailable')
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
        gl.STATIC_DRAW
      )
      gl.useProgram(program)
      const position = gl.getAttribLocation(program, 'aPosition')
      gl.enableVertexAttribArray(position)
      gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0)
      const timeLocation = gl.getUniformLocation(program, 'uTime')
      gl.viewport(0, 0, 192, 256)
      return {
        get available() {
          return !lost && !gl.isContextLost()
        },
        draw(time) {
          if (lost || gl.isContextLost()) return null
          gl.uniform1f(timeLocation, number(time, 0))
          gl.drawArrays(gl.TRIANGLES, 0, 6)
          return output
        },
        dispose: release
      }
    } catch {
      release()
      return null
    }
  }

  // A small translucent flame atlas keeps context loss graceful without per-frame
  // pixel work. The analytic field is periodic and adjacent frames crossfade.
  function prepareFireFrames() {
    const smooth = (low, high, value) => {
      const amount = clamp((value - low) / (high - low), 0, 1)
      return amount * amount * (3 - 2 * amount)
    }
    return Array.from({ length: 12 }, (_, index) => {
      const node = canvas(96, 128)
      const context = node.getContext('2d')
      if (!context) return null
      const pixels = context.createImageData(96, 128)
      const t = (index / 12) * tau
      for (let y = 0; y < 128; y++) {
        const h = (1 - y / 127 - 0.025) / 0.96
        const taper = Math.pow(Math.max(0, 1 - h), 0.7)
        for (let x = 0; x < 96; x++) {
          const px = (x / 95 - 0.5) * 2.25
          const wave =
            Math.sin(h * 9 - t) * 0.5 +
            Math.sin(h * 16 - t * 2 + px * 10) * 0.25
          const bend = Math.sin(h * 6 - t) * 0.08 * h
          const radius = 0.39 * taper + 0.01
          const edge = radius - Math.abs(px + bend + wave * 0.1 * h)
          const density =
            smooth(-0.085, 0.09, edge) *
            (1 - smooth(0.63, 1.04, h + wave * 0.14))
          const core = Math.exp(-((px * 4.8) ** 2)) * Math.max(0, 1 - h) ** 2.2
          const heat = smooth(0.1, 0.75, density)
          const white = clamp(core * 1.1, 0, 1)
          const offset = (y * 96 + x) * 4
          pixels.data[offset] = 250 + heat * 5
          pixels.data[offset + 1] = (72 + heat * 99) * (1 - white) + 240 * white
          pixels.data[offset + 2] = (38 + heat * 36) * (1 - white) + 178 * white
          pixels.data[offset + 3] = density * smooth(0, 0.055, h) * 208
        }
      }
      context.putImageData(pixels, 0, 0)
      return node
    }).filter(Boolean)
  }

  function setScene(nextScene, nextImage, nextDetail) {
    if (
      disposed ||
      (scene === nextScene && image === nextImage && detail === nextDetail)
    )
      return
    shader?.dispose()
    shader = null
    fireShader?.dispose()
    fireShader = null
    fireFrames = []
    scene = nextScene
    image = nextImage
    detail = nextDetail
    beams = []
    curtains = []
    glazes = []
    motes = []
    spores = []
    flows = []
    water = []
    waterReflectionTexture = null
    waterfalls = []
    waterfallTexture = null
    mist = []
    mistTexture = null
    paint = []
    mobiles = []
    flecks = []
    fire = null
    spill = []
    embers = []
    constellations = []
    templeLight = []
    stars = []
    warmth = null
    warmGlowsLeft = 0
    frameScenery = true
    frameEnabled = true
    const vibe = detail?.vibe ?? {}
    if (scene === 'quiet-house') {
      beams = prepareBeams(vibe.beams)
      curtains = (vibe.curtains ?? []).slice(0, 2).flatMap((curtain) => {
        const bounds = maskGeometry(curtain.polygon)
        const node = bounds && crop(bounds)
        return node
          ? [
              {
                ...bounds,
                node,
                amplitude:
                  clamp(number(curtain.amplitude, 0.0015), 0, 0.002) * width,
                phase: number(curtain.phase, 0)
              }
            ]
          : []
      })
      motes = prepareParticles(vibe.motes, 32, '#dce7f6')
    } else if (scene === 'dream-garden') {
      glazes = (vibe.glaze ?? []).slice(0, 4).flatMap((glaze) => {
        const bounds = maskGeometry(glaze.polygon)
        const node = bounds && crop(bounds)
        return node
          ? [
              {
                ...bounds,
                node,
                strength: clamp(number(glaze.strength, 0.55), 0, 1),
                tint: rgb(glaze.tint)
              }
            ]
          : []
      })
      if (glazes.length) shader = createGlazeShader(glazes)
      spores = prepareParticles(vibe.spores, 24, '#ebd4b3')
    } else if (scene === 'source') {
      flows = prepareFlows(vibe.flows)
    } else if (scene === 'bathhouse') {
      water = (vibe.water ?? []).slice(0, 5).flatMap((pool) => {
        const bounds = maskGeometry(pool.polygon)
        return bounds
          ? [{ ...bounds, opacity: clamp(number(pool.opacity, 0.14), 0, 0.24) }]
          : []
      })
      if (water.length)
        waterReflectionTexture = prepareWaterTexture('reflection')
      waterfalls = (vibe.falls ?? []).slice(0, 6).flatMap((fall) => {
        const bounds = maskGeometry(fall.polygon)
        return bounds
          ? [{ ...bounds, opacity: clamp(number(fall.opacity, 0.25), 0, 0.5) }]
          : []
      })
      if (waterfalls.length) waterfallTexture = prepareWaterTexture('falls')
      mist = prepareMist(vibe.mist)
      if (mist.length) mistTexture = prepareWaterTexture('mist')
    } else if (scene === 'open-studio') {
      paint = preparePaint(vibe.paint)
      mobiles = (vibe.mobiles ?? []).slice(0, 2).flatMap((mobile, index) =>
        [mobile.x, mobile.y, mobile.rx, mobile.ry].every(Number.isFinite)
          ? [
              {
                x: clamp(mobile.x, 0, 1) * width,
                y: clamp(mobile.y, 0, 1) * height,
                rx: clamp(mobile.rx, 0, 0.08) * width,
                ry: clamp(mobile.ry, 0, 0.1) * height,
                color: mobile.color ?? '#88aba8',
                seed: seeded(index + 482)
              }
            ]
          : []
      )
      flecks = prepareParticles(vibe.flecks, 20, '#ecc989')
    } else if (scene === 'hearth') {
      if (
        vibe.fire &&
        [vibe.fire.x, vibe.fire.y, vibe.fire.rx, vibe.fire.ry].every(
          Number.isFinite
        )
      ) {
        fire = {
          x: clamp(vibe.fire.x, 0, 1) * width,
          y: clamp(vibe.fire.y, 0, 1) * height,
          rx: clamp(vibe.fire.rx, 0.001, 0.1) * width,
          ry: clamp(vibe.fire.ry, 0.001, 0.2) * height
        }
        warmth = glow(vibe.fire.color ?? '#ffad65', 128)
        fireShader = createFireShader()
        fireFrames = prepareFireFrames()
      }
      spill = prepareBeams(vibe.spill)
      embers = prepareParticles(vibe.embers, 20, '#ffd09a')
      for (const ember of embers) ember.seconds = 5 + ember.seed * 5
    } else if (scene === 'temple') {
      constellations = prepareConstellations(vibe.constellations)
      templeLight = prepareBeams(vibe.light)
      stars = prepareParticles(vibe.stars, 20, '#f8e7b7')
    }
  }

  function drawCurtains(ctx, time) {
    for (const curtain of curtains) {
      ctx.save()
      ctx.clip(curtain.path)
      ctx.globalAlpha = alpha(0.48)
      const strips = 24
      for (let strip = 0; strip < strips; strip++) {
        const amount = strip / strips
        const offset =
          Math.sin(phase(time, 18) * tau + amount * 1.6 + curtain.phase) *
          curtain.amplitude *
          intensity *
          amount ** 2
        const sy = amount * curtain.node.height
        const sh = Math.min(
          curtain.node.height - sy,
          curtain.node.height / strips + 0.5
        )
        ctx.drawImage(
          curtain.node,
          0,
          sy,
          curtain.node.width,
          sh,
          curtain.x + offset,
          curtain.y + amount * curtain.h,
          curtain.w,
          curtain.h / strips + 0.5
        )
      }
      ctx.restore()
    }
  }

  function drawGlaze(ctx, time) {
    for (const [index, patch] of glazes.entries()) {
      ctx.save()
      ctx.clip(patch.path)
      const rendered = shader?.draw(index, time)
      if (rendered) {
        ctx.globalAlpha = alpha(0.8)
        ctx.drawImage(rendered, patch.x, patch.y, patch.w, patch.h)
      } else {
        const angle = phase(time, 24) * tau
        ctx.globalAlpha = alpha(0.32)
        ctx.drawImage(
          patch.node,
          patch.x + Math.sin(angle + index) * patch.strength * intensity,
          patch.y + Math.cos(angle - index) * patch.strength * 0.6 * intensity,
          patch.w,
          patch.h
        )
        ctx.globalAlpha = alpha(0.035 * patch.strength)
        const tint = patch.tint.map((channel) => Math.round(channel * 255))
        ctx.fillStyle = `rgb(${tint.join(' ')})`
        ctx.fillRect(patch.x, patch.y, patch.w, patch.h)
      }
      ctx.restore()
    }
  }

  function drawParticles(ctx, time, particles, rising) {
    const drift = amplitude(0.5)
    const radiusScale = amplitude(0.2)
    for (const particle of particles) {
      const progress = (phase(time, particle.seconds) + particle.seed) % 1
      const angle = progress * tau
      const envelope = Math.sin(Math.PI * progress)
      const x =
        particle.x +
        Math.sin(angle + particle.seed * tau) *
          particle.rx *
          drift *
          (rising ? 0.4 : 0.65)
      const y = rising
        ? particle.y + (1 - progress * 2) * particle.ry * drift
        : particle.y +
          Math.cos(angle * 0.5 + particle.seed * tau) *
            particle.ry *
            0.6 *
            drift
      ctx.globalAlpha = alpha((rising ? 0.3 : 0.2) * envelope)
      ctx.fillStyle = particle.color
      ctx.beginPath()
      ctx.ellipse(
        x + particle.drift * particle.rx * 0.3 * drift,
        y,
        particle.radius * radiusScale,
        particle.radius * radiusScale,
        0,
        0,
        tau
      )
      ctx.fill()
    }
  }

  function drawFlows(ctx, time) {
    const size = amplitude(0.3)
    for (const flow of flows) {
      ctx.strokeStyle = flow.color
      ctx.lineWidth = 0.8 * amplitude(0.2)
      ctx.globalAlpha = alpha(0.055)
      ctx.stroke(flow.path)
      for (let index = 0; index < flow.count; index++) {
        const progress =
          (phase(time, flow.seconds) + index / flow.count + flow.phase) % 1
        const sample = progress * 64
        const lower = Math.floor(sample)
        const mix = sample - lower
        const a = flow.samples[lower],
          b = flow.samples[Math.min(64, lower + 1)]
        const x = a[0] + (b[0] - a[0]) * mix,
          y = a[1] + (b[1] - a[1]) * mix
        const envelope = Math.sin(Math.PI * progress)
        if (flow.sprite) {
          ctx.globalAlpha = alpha(envelope * 0.16)
          ctx.drawImage(
            flow.sprite,
            x - 10 * size,
            y - 10 * size,
            20 * size,
            20 * size
          )
        }
        ctx.globalAlpha = alpha(envelope * 0.7)
        ctx.fillStyle = flow.color
        ctx.beginPath()
        ctx.ellipse(x, y, 1.9 * size, 1.9 * size, 0, 0, tau)
        ctx.fill()
      }
    }
  }

  function drawWaterSurface(ctx, time) {
    const drift = 1 + (intensity * bathhouseWaves - 1) * 0.25
    if (waterReflectionTexture && bathhouseWaves > 0) {
      for (const [index, pool] of water.entries()) {
        ctx.save()
        ctx.clip(pool.path)
        const cycle = phase(time, 28 + index * 2) + index * 0.17
        const scroll = (cycle % 1) * pool.h
        const x = pool.x - 12 * drift + Math.sin(cycle * tau) * 8 * drift
        ctx.globalAlpha = alpha(pool.opacity * bathhouseWaves)
        ctx.drawImage(
          waterReflectionTexture,
          x,
          pool.y - scroll,
          pool.w + 24 * drift,
          pool.h
        )
        ctx.drawImage(
          waterReflectionTexture,
          x,
          pool.y - scroll + pool.h,
          pool.w + 24 * drift,
          pool.h
        )
        ctx.restore()
      }
    }
    if (waterfallTexture && bathhouseWaterfalls > 0) {
      for (const [index, fall] of waterfalls.entries()) {
        ctx.save()
        ctx.clip(fall.path)
        const scroll =
          ((phase(time, 2.4 + index * 0.23) + index * 0.13) % 1) * fall.h
        ctx.globalAlpha = alpha(fall.opacity * bathhouseWaterfalls)
        ctx.drawImage(
          waterfallTexture,
          fall.x,
          fall.y + scroll - fall.h,
          fall.w,
          fall.h
        )
        ctx.drawImage(waterfallTexture, fall.x, fall.y + scroll, fall.w, fall.h)
        ctx.restore()
      }
    }
  }

  function drawMist(ctx, time) {
    if (!mistTexture) return
    for (const [index, ribbon] of mist.entries()) {
      ctx.save()
      ctx.clip(ribbon.path)
      const angle = phase(time, 19 + index * 3) * tau + index * 1.4
      const drift =
        Math.sin(angle) * Math.min(3, ribbon.h * 0.08) * amplitude(0.25)
      ctx.globalAlpha = alpha(
        ribbon.opacity * (0.86 + Math.sin(angle + 0.8) * 0.14)
      )
      ctx.drawImage(mistTexture, ribbon.x, ribbon.y + drift, ribbon.w, ribbon.h)
      ctx.restore()
    }
  }

  function strokeSamples(ctx, samples, progress) {
    const count = Math.max(
      1,
      Math.min(samples.length - 1, Math.ceil(progress * (samples.length - 1)))
    )
    ctx.beginPath()
    ctx.moveTo(...samples[0])
    for (let i = 1; i < count; i++) ctx.lineTo(...samples[i])
    const sample = progress * (samples.length - 1),
      lower = Math.floor(sample),
      blend = sample - lower
    const a = samples[lower],
      b = samples[Math.min(samples.length - 1, lower + 1)]
    ctx.lineTo(a[0] + (b[0] - a[0]) * blend, a[1] + (b[1] - a[1]) * blend)
    ctx.stroke()
  }

  function drawPaint(ctx, time) {
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    for (const surface of paint) {
      ctx.save()
      ctx.clip(surface.path)
      const cycle = (phase(time, surface.seconds) + surface.seed) % 1
      for (const [index, stroke] of surface.strokes.entries()) {
        const progress = clamp((cycle - index * 0.1) / 0.4, 0, 1)
        if (progress <= 0) continue
        const fade = cycle > 0.85 ? (1 - cycle) / 0.15 : 1
        ctx.strokeStyle = stroke.color
        ctx.lineWidth = stroke.width * 1.35 * amplitude(0.16)
        ctx.globalAlpha = alpha(fade * 0.16)
        strokeSamples(ctx, stroke.samples, progress)
        ctx.lineWidth = stroke.width * amplitude(0.16)
        ctx.globalAlpha = alpha(fade * 0.66)
        strokeSamples(ctx, stroke.samples, progress)
        // Restrained wet edge: authored pigment, not an invented agent artifact.
        ctx.strokeStyle = '#fff4cd'
        ctx.lineWidth = Math.max(0.7, stroke.width * 0.15) * amplitude(0.16)
        ctx.globalAlpha = alpha(fade * 0.18 * (1 - progress * 0.6))
        strokeSamples(ctx, stroke.samples, progress)
      }
      ctx.restore()
    }
  }

  function drawMobiles(ctx, time) {
    for (const mobile of mobiles) {
      const angle = phase(time, 32) * tau + mobile.seed * tau
      const sway = Math.sin(angle) * mobile.rx * 0.08 * intensity
      ctx.strokeStyle = '#947f63'
      ctx.lineWidth = 0.9
      ctx.globalAlpha = alpha(0.48)
      ctx.beginPath()
      ctx.moveTo(mobile.x, mobile.y)
      ctx.lineTo(mobile.x + sway, mobile.y + mobile.ry * 0.65)
      ctx.stroke()
      for (let index = 0; index < 3; index++) {
        const turn = angle + (index * tau) / 3
        const x = mobile.x + sway + Math.cos(turn) * mobile.rx
        const y = mobile.y + mobile.ry * 0.8 + Math.sin(turn) * mobile.ry * 0.14
        ctx.globalAlpha = alpha(0.55 + Math.sin(turn) * 0.12)
        ctx.beginPath()
        ctx.moveTo(mobile.x + sway, mobile.y + mobile.ry * 0.65)
        ctx.lineTo(x, y)
        ctx.stroke()
        ctx.fillStyle = mobile.color
        ctx.beginPath()
        ctx.ellipse(
          x,
          y + 4,
          4 + Math.abs(Math.cos(turn)) * 3,
          7,
          Math.sin(turn) * 0.3,
          0,
          tau
        )
        ctx.fill()
      }
    }
  }

  function fireEnergy(time) {
    return (
      0.75 +
      Math.sin(time * 1.71) * 0.1 +
      Math.sin(time * 2.93 + 1.2) * 0.08 +
      Math.sin(time * 0.67 + 3) * 0.07
    )
  }

  function drawFire(ctx, time) {
    const energy = fireEnergy(time)
    for (const mask of spill) {
      ctx.globalAlpha = alpha(mask.opacity * energy)
      ctx.drawImage(mask.node, mask.x, mask.y)
    }
    if (!fire || !warmth) return
    ctx.globalAlpha = alpha(0.26 * energy)
    ctx.drawImage(
      warmth,
      fire.x - fire.rx * 3,
      fire.y - fire.ry * 1.15,
      fire.rx * 6,
      fire.ry * 2.1
    )
    const x = fire.x - fire.rx * 1.45 * amplitude(0.06)
    const y = fire.y - fire.ry * 1.05 * amplitude(0.12)
    const w = fire.rx * 2.9 * amplitude(0.06),
      h = fire.ry * 1.1 * amplitude(0.12)
    const rendered = fireShader?.draw(time)
    if (rendered) {
      ctx.globalAlpha = alpha(0.9)
      ctx.drawImage(rendered, x, y, w, h)
    } else if (fireFrames.length) {
      const at = phase(time, 7.2) * fireFrames.length
      const lower = Math.floor(at),
        blend = at - lower
      ctx.globalAlpha = alpha((1 - blend) * 0.9)
      ctx.drawImage(fireFrames[lower], x, y, w, h)
      ctx.globalAlpha = alpha(blend * 0.9)
      ctx.drawImage(fireFrames[(lower + 1) % fireFrames.length], x, y, w, h)
    }
  }

  function drawConstellations(ctx, time) {
    for (const beam of templeLight) {
      ctx.globalAlpha = alpha(
        beam.opacity *
          (0.65 + 0.35 * Math.sin(phase(time, 48) * tau + beam.phase))
      )
      ctx.drawImage(beam.node, beam.x, beam.y)
    }
    for (const group of constellations) {
      ctx.save()
      if (group.mask) ctx.clip(group.mask.path)
      const progress = (phase(time, 36) + group.seed) % 1
      const reveal = progress * (group.points.length - 1)
      ctx.strokeStyle = group.color
      ctx.fillStyle = group.color
      ctx.lineWidth = 1.4 * amplitude(0.2)
      for (let index = 1; index < group.points.length; index++) {
        const a = group.points[index - 1],
          b = group.points[index]
        ctx.globalAlpha = alpha(0.08)
        ctx.beginPath()
        ctx.moveTo(...a)
        ctx.lineTo(...b)
        ctx.stroke()
        const amount = clamp(reveal - (index - 1), 0, 1)
        if (amount > 0) {
          const fade = Math.sin(Math.PI * progress)
          ctx.globalAlpha = alpha(0.5 * fade)
          ctx.beginPath()
          ctx.moveTo(...a)
          ctx.lineTo(
            a[0] + (b[0] - a[0]) * amount,
            a[1] + (b[1] - a[1]) * amount
          )
          ctx.stroke()
          if (amount < 1) {
            ctx.globalAlpha = alpha(fade * 0.75)
            ctx.beginPath()
            ctx.ellipse(
              a[0] + (b[0] - a[0]) * amount,
              a[1] + (b[1] - a[1]) * amount,
              2.3 * amplitude(0.25),
              1.8 * amplitude(0.25),
              0,
              0,
              tau
            )
            ctx.fill()
          }
        }
      }
      for (const [index, [x, y]] of group.points.entries()) {
        ctx.globalAlpha = alpha(
          0.4 +
            Math.sin(phase(time, 29) * tau + index + group.seed * tau) * 0.15
        )
        ctx.beginPath()
        ctx.ellipse(
          x,
          y,
          2.2 * amplitude(0.25),
          1.55 * amplitude(0.25),
          0,
          0,
          tau
        )
        ctx.fill()
      }
      ctx.restore()
    }
  }

  function drawBack(ctx, time, { enabled = true, scenery = true } = {}) {
    frameEnabled = enabled && !disposed && intensity > 0
    frameScenery = scenery
    warmGlowsLeft = frameEnabled && scenery ? 12 : 0
    if (!frameEnabled) return
    ctx.save()
    if (scene === 'quiet-house' && scenery) {
      for (const beam of beams) {
        ctx.globalAlpha = alpha(
          beam.opacity *
            (0.92 + 0.08 * Math.sin(phase(time, 28) * tau + beam.phase))
        )
        ctx.drawImage(beam.node, beam.x, beam.y)
      }
      drawCurtains(ctx, time)
    } else if (scene === 'dream-garden' && scenery) drawGlaze(ctx, time)
    else if (scene === 'source') drawFlows(ctx, time)
    else if (scenery && scene === 'bathhouse') drawWaterSurface(ctx, time)
    else if (scenery && scene === 'open-studio') {
      drawPaint(ctx, time)
      drawMobiles(ctx, time)
    } else if (scenery && scene === 'hearth') drawFire(ctx, time)
    else if (scenery && scene === 'temple') drawConstellations(ctx, time)
    ctx.restore()
  }

  function drawFront(ctx, time, { enabled = true, scenery = true } = {}) {
    if (!enabled || disposed || intensity <= 0) return
    ctx.save()
    if (scene === 'quiet-house') drawParticles(ctx, time, motes, false)
    else if (scene === 'dream-garden') drawParticles(ctx, time, spores, true)
    else if (scenery && scene === 'bathhouse') drawMist(ctx, time)
    else if (scenery && scene === 'open-studio')
      drawParticles(ctx, time, flecks, false)
    else if (scenery && scene === 'hearth')
      drawParticles(ctx, time, embers, true)
    else if (scenery && scene === 'temple')
      drawParticles(ctx, time, stars, false)
    ctx.restore()
  }

  function drawActorBack(ctx, actor, size, _pose, time = 0) {
    if (intensity <= 0) return
    const aura = amplitude(0.15)
    if (scene === 'hearth') {
      if (
        !frameEnabled ||
        !frameScenery ||
        disposed ||
        !fire ||
        !warmth ||
        actor.held ||
        actor.landing ||
        warmGlowsLeft <= 0
      )
        return
      const x = actor.x * width,
        y = actor.y * height
      const distance = Math.hypot(
        (x - fire.x) / (width * 0.25),
        (y - fire.y) / (height * 0.22)
      )
      if (distance >= 1) return
      warmGlowsLeft--
      ctx.save()
      ctx.globalAlpha = alpha((1 - distance) * fireEnergy(time) * 0.19)
      ctx.drawImage(
        warmth,
        x - size * 0.65 * aura,
        y - size * 0.78 * aura,
        size * 1.3 * aura,
        size * aura
      )
      ctx.restore()
      return
    }
  }

  function dispose() {
    fireShader?.dispose()
    fireShader = null
    fireFrames = []
    shader?.dispose()
    shader = null
    beams = []
    curtains = []
    glazes = []
    motes = []
    spores = []
    flows = []
    water = []
    waterReflectionTexture = null
    waterfalls = []
    waterfallTexture = null
    mist = []
    mistTexture = null
    paint = []
    mobiles = []
    flecks = []
    fire = null
    spill = []
    embers = []
    constellations = []
    templeLight = []
    stars = []
    warmth = null
    warmGlowsLeft = 0
    image = null
    detail = null
    disposed = true
  }

  return {
    setScene,
    setIntensity,
    setBathhouseStrengths,
    drawBack,
    drawFront,
    drawActorBack,
    dispose,
    get status() {
      return Object.freeze({
        scene,
        disposed,
        intensity,
        bathhouseWaterfalls,
        bathhouseWaves,
        glazeRenderer: shader?.available
          ? 'webgl'
          : glazes.length
            ? 'canvas'
            : 'none',
        glazeMasks: glazes.length,
        curtainMasks: curtains.length,
        moonbeams: beams.length,
        motes: motes.length,
        spores: spores.length,
        sourceBeads: flows.reduce((total, flow) => total + flow.count, 0),
        waterMasks: water.length,
        waterReflections: waterReflectionTexture ? water.length : 0,
        waterfallStreams: waterfallTexture ? waterfalls.length : 0,
        mistRibbons: mistTexture ? mist.length : 0,
        paintSurfaces: paint.length,
        paintStrokes: paint.reduce(
          (total, surface) => total + surface.strokes.length,
          0
        ),
        mobiles: mobiles.length,
        glazeFlecks: flecks.length,
        fireLayers: fire ? 3 : 0,
        fireRenderer: fireShader?.available
          ? 'webgl'
          : fireFrames.length
            ? 'canvas'
            : 'none',
        fireFallbackFrames: fireFrames.length,
        fireSpills: spill.length,
        embers: embers.length,
        warmGlowLimit: 12,
        constellationPaths: constellations.length,
        constellationNodes: constellations.reduce(
          (total, group) => total + group.points.length,
          0
        ),
        templeLights: templeLight.length,
        stars: stars.length
      })
    }
  }
}
