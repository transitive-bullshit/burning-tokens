import assert from 'node:assert/strict'

import { createRoomEffects } from './room-effects.js'

// Exercise the deterministic paint contract and the WebGL-unavailable fallback.
// This deliberately makes no claim about shader pixels or device performance.
let allocated = 0
let mockWebGL = null
class TestPath {
  points = []
  moveTo(...args) {
    this.points.push(['move', ...args])
  }
  lineTo(...args) {
    this.points.push(['line', ...args])
  }
  bezierCurveTo(...args) {
    this.points.push(['curve', ...args])
  }
  closePath() {
    this.points.push(['close'])
  }
}
const serial = (value) =>
  value?.canvasId ? { canvasId: value.canvasId } : value
const context = () => {
  const output = {
    ops: [],
    globalAlpha: 1,
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    lineCap: 'butt',
    lineJoin: 'miter'
  }
  let currentAlpha = 1
  Object.defineProperty(output, 'globalAlpha', {
    get: () => currentAlpha,
    set(value) {
      assert.ok(
        Number.isFinite(value) && value >= 0 && value <= 1,
        'every Canvas alpha assignment is finite and within0–1'
      )
      currentAlpha = value
    }
  })
  const stack = []
  for (const name of [
    'translate',
    'moveTo',
    'lineTo',
    'bezierCurveTo',
    'closePath',
    'clip',
    'fillRect',
    'drawImage',
    'stroke',
    'beginPath',
    'ellipse',
    'fill'
  ])
    output[name] = (...args) => {
      for (const arg of args)
        if (typeof arg === 'number')
          assert.ok(Number.isFinite(arg), `${name} uses finite coordinates`)
      output.ops.push([
        name,
        ...args.map(serial),
        { alpha: output.globalAlpha, lineWidth: output.lineWidth }
      ])
    }
  output.createImageData = (width, height) => ({
    data: new Uint8ClampedArray(width * height * 4)
  })
  output.putImageData = () => {}
  output.save = () =>
    stack.push({
      globalAlpha: output.globalAlpha,
      fillStyle: output.fillStyle,
      strokeStyle: output.strokeStyle,
      lineWidth: output.lineWidth,
      lineCap: output.lineCap,
      lineJoin: output.lineJoin
    })
  output.restore = () => Object.assign(output, stack.pop())
  for (const name of ['createRadialGradient', 'createLinearGradient'])
    output[name] = (...args) => ({
      args,
      stops: [],
      addColorStop(position, color) {
        this.stops.push([position, color])
      }
    })
  return output
}
const previousDocument = globalThis.document
const previousPath = globalThis.Path2D
try {
  globalThis.Path2D = TestPath
  globalThis.document = {
    createElement(name) {
      assert.equal(name, 'canvas')
      const node = {
        canvasId: ++allocated,
        width: 1,
        height: 1,
        addEventListener() {},
        removeEventListener() {}
      }
      const ctx = context()
      node.getContext = (kind) =>
        kind === '2d' ? ctx : (mockWebGL?.(node) ?? null)
      return node
    }
  }
  const effects = createRoomEffects()
  const image = { width: 1536, height: 1024 }
  const mask = [
    [0.25, 0.2],
    [0.45, 0.22],
    [0.42, 0.6],
    [0.26, 0.55]
  ]
  const emitter = { x: 0.5, y: 0.5, rx: 0.1, ry: 0.2, count: 1000 }
  const main = context()
  function frame(time, opts) {
    main.ops = []
    effects.drawBack(main, time, opts)
    effects.drawFront(main, time, opts)
    assert.equal(main.globalAlpha, 1, 'room effects restore caller paint state')
    assert.equal(
      main.lineCap,
      'butt',
      'paint leaves the caller line cap unchanged'
    )
    assert.equal(
      main.lineJoin,
      'miter',
      'paint leaves the caller line join unchanged'
    )
    return JSON.stringify(main.ops)
  }
  effects.setScene('quiet-house', image, {
    vibe: {
      beams: Array(10).fill({
        polygon: mask,
        from: [0.3, 0.2],
        to: [0.35, 0.6]
      }),
      curtains: Array(10).fill({ polygon: mask }),
      motes: Array(10).fill(emitter)
    }
  })
  assert.equal(effects.status.moonbeams, 3)
  assert.equal(effects.status.curtainMasks, 2)
  assert.equal(effects.status.motes, 32)
  let before = allocated
  const pausedQuiet = frame(9)
  assert.equal(
    frame(9),
    pausedQuiet,
    'unchanged elapsed time freezes quiet effects'
  )
  assert.notEqual(
    frame(15),
    pausedQuiet,
    'quiet effects use only supplied time'
  )
  assert.equal(
    allocated,
    before,
    'quiet frames allocate no offscreen resources'
  )
  assert.equal(
    frame(15, { enabled: false }),
    '[]',
    'disabled effects draw nothing'
  )

  effects.setScene('dream-garden', image, {
    vibe: {
      glaze: Array(10).fill({ polygon: mask }),
      spores: Array(10).fill(emitter)
    }
  })
  assert.equal(
    effects.status.glazeRenderer,
    'canvas',
    'missing WebGL uses Canvas fallback'
  )
  assert.equal(effects.status.glazeMasks, 4)
  assert.equal(effects.status.spores, 24)
  before = allocated
  const pausedGarden = frame(4)
  assert.equal(
    frame(4),
    pausedGarden,
    'garden fallback freezes with caller time'
  )
  assert.equal(allocated, before, 'garden redraws reuse prepared crops')
  main.ops = []
  effects.drawBack(main, 4, { scenery: false })
  assert.equal(
    main.ops.length,
    0,
    'garden artwork treatment is omitted with scenery hidden'
  )

  effects.setScene('source', image, {
    vibe: {
      flows: Array(20).fill({
        points: [
          [0.5, 0.2],
          [0.6, 0.3],
          [0.4, 0.6],
          [0.5, 0.7]
        ],
        count: 20
      })
    }
  })
  assert.equal(effects.status.sourceBeads, 24)
  const actor = { x: 0.5, y: 0.5, visitor: { id: 'example' } }
  const untouched = structuredClone(actor)
  before = allocated
  const pausedSource = frame(12)
  assert.equal(frame(12), pausedSource, 'source beads freeze with caller time')
  for (const strength of [0, 0.5, 1, 2.25, 5]) {
    effects.setIntensity(strength)
    frame(12)
    main.ops = []
    effects.drawActorBack(
      main,
      { ...actor, held: true },
      80,
      { receive: 1 },
      12
    )
    for (let i = 0; i < 1000; i++)
      effects.drawActorBack(main, actor, 80, { receive: 1 }, 12)
    assert.equal(
      main.ops.length,
      0,
      'Source creatures have no halo paint at any strength, including the225% default'
    )
  }
  effects.setIntensity(1)
  assert.deepEqual(
    actor,
    untouched,
    'painting never changes actor position or session data'
  )
  assert.equal(allocated, before, 'source frames reuse cached conduit sprites')
  assert.equal(main.globalAlpha, 1)
  // The four remaining rooms use the same paused clock and strict effect budgets.
  const curve = [
    [0.28, 0.25],
    [0.4, 0.3],
    [0.3, 0.5],
    [0.4, 0.55]
  ]
  const beam = { polygon: mask, from: [0.3, 0.2], to: [0.35, 0.6] }
  const bathDetail = {
    vibe: {
      water: Array(20).fill({ polygon: mask }),
      falls: Array(20).fill({ polygon: mask, opacity: 0.22 }),
      mist: Array(20).fill({
        x: 0.36,
        y: 0.6,
        rx: 0.08,
        ry: 0.012,
        opacity: 0.07
      })
    }
  }
  const bathers = Array.from({ length: 1000 }, (_, index) => ({
    x: 0.33,
    y: 0.4,
    moving: true,
    zone: { wet: true },
    visitor: { seed: index / 1000 }
  }))
  before = allocated
  effects.setScene('bathhouse', image, bathDetail)
  assert.equal(
    allocated - before,
    3,
    'all pool reflections, waterfall glints and mist ribbons share three tiny textures'
  )
  assert.equal(effects.status.waterMasks, 5)
  assert.equal(effects.status.waterReflections, 5)
  assert.equal(effects.status.waterfallStreams, 6)
  assert.equal(effects.status.mistRibbons, 3)
  assert.equal(
    effects.status.glazeMasks,
    0,
    'switching removes the previous room resources'
  )
  before = allocated
  effects.setScene('bathhouse', image, bathDetail)
  assert.equal(
    allocated,
    before,
    'repeated scene selection reuses existing resources'
  )
  const pausedBath = frame(5, { actors: bathers })
  assert.equal(
    frame(5, { actors: bathers }),
    pausedBath,
    'silky reflections, downward glints and anchored ribbon mist freeze at the supplied time'
  )
  assert.notEqual(frame(11, { actors: bathers }), pausedBath)
  frame(5, { actors: bathers })
  assert.equal(
    main.ops.filter(([name]) => name === 'ellipse').length,
    0,
    'the replacement Bathhouse effect has no expanding rings or circular steam particles'
  )
  assert.equal(
    main.ops.filter(([name]) => name === 'stroke').length,
    0,
    'Bathhouse has no outlined caustic or ripple path'
  )
  assert.equal(
    main.ops.filter(([name]) => name === 'drawImage').length,
    25,
    'five pools, six falls and three mist ribbons have a fixed draw budget'
  )
  assert.equal(
    main.ops.filter(([name]) => name === 'clip').length,
    14,
    'each pool, fall and mist field uses its authored clip'
  )
  const occupiedBath = frame(5, { actors: bathers })
  assert.equal(
    frame(5, { actors: [] }),
    occupiedBath,
    'water treatment is independent of creature count and motion'
  )
  assert.equal(
    frame(5, { actors: bathers.map((bather) => ({ ...bather, held: true })) }),
    occupiedBath,
    'holding creatures cannot spawn or move water effects'
  )
  main.ops = []
  effects.drawBack(main, 0)
  const firstFallY = main.ops.filter(([name]) => name === 'drawImage')[10][3]
  main.ops = []
  effects.drawBack(main, 0.1)
  const nextFallY = main.ops.filter(([name]) => name === 'drawImage')[10][3]
  assert.ok(
    nextFallY > firstFallY,
    'authored waterfall highlights travel downward'
  )
  assert.equal(
    frame(5, { scenery: false, actors: bathers }),
    '[]',
    'water surfaces, falls and mist follow scenery visibility'
  )
  assert.equal(
    allocated,
    before,
    'Bathhouse redraws reuse the three shared textures'
  )

  assert.equal(
    effects.status.bathhouseWaterfalls,
    3.15,
    'waterfall strength defaults to315%'
  )
  assert.equal(
    effects.status.bathhouseWaves,
    1.5,
    'wave strength defaults to150%'
  )
  const waterChannels = () =>
    JSON.parse(frame(5)).filter(([name]) => name === 'drawImage')
  const channelBaseline = waterChannels()
  const reflectionId = channelBaseline[0][1].canvasId
  const fallId = channelBaseline[10][1].canvasId
  const mistId = channelBaseline[22][1].canvasId
  const textureDraws = (draws, id) =>
    draws.filter((draw) => draw[1].canvasId === id)
  const channelBudgets = [
    effects.status.waterReflections,
    effects.status.waterfallStreams,
    effects.status.mistRibbons
  ]
  effects.setBathhouseStrengths({ waterfalls: 0 })
  let channelFrame = waterChannels()
  assert.equal(
    textureDraws(channelFrame, fallId).length,
    0,
    'zero waterfalls omits only the falling highlights'
  )
  assert.deepEqual(
    textureDraws(channelFrame, reflectionId),
    textureDraws(channelBaseline, reflectionId),
    'waterfall strength leaves the wave layer unchanged'
  )
  assert.deepEqual(
    textureDraws(channelFrame, mistId),
    textureDraws(channelBaseline, mistId),
    'waterfall strength leaves mist unchanged'
  )
  effects.setBathhouseStrengths({ waterfalls: 3.15, waves: 0 })
  channelFrame = waterChannels()
  assert.equal(
    textureDraws(channelFrame, reflectionId).length,
    0,
    'zero waves omits only the pool reflections'
  )
  assert.deepEqual(
    textureDraws(channelFrame, fallId),
    textureDraws(channelBaseline, fallId),
    'wave strength leaves waterfall coordinates, timing and alpha unchanged'
  )
  assert.deepEqual(
    textureDraws(channelFrame, mistId),
    textureDraws(channelBaseline, mistId),
    'wave strength leaves mist unchanged'
  )
  effects.setBathhouseStrengths({ waves: 1.5 })
  assert.deepEqual(
    waterChannels(),
    channelBaseline,
    'restoring both channels exactly restores a paused frame'
  )
  effects.setIntensity(2)
  channelFrame = waterChannels()
  assert.equal(
    textureDraws(channelFrame, reflectionId)[0].at(-1).alpha,
    Math.min(
      1,
      textureDraws(channelBaseline, reflectionId)[0].at(-1).alpha * 2
    ),
    'waves multiply master strength'
  )
  assert.equal(
    textureDraws(channelFrame, fallId)[0].at(-1).alpha,
    1,
    'waterfalls multiply master strength with safe alpha saturation'
  )
  effects.setIntensity(1)
  effects.setBathhouseStrengths({ waves: 3 })
  channelFrame = waterChannels()
  assert.notEqual(
    textureDraws(channelFrame, reflectionId)[0][2],
    textureDraws(channelBaseline, reflectionId)[0][2],
    'wave strength amplifies reflection drift'
  )
  assert.equal(
    textureDraws(channelFrame, reflectionId)[0][3],
    textureDraws(channelBaseline, reflectionId)[0][3],
    'wave strength does not advance the paused scroll phase'
  )
  assert.deepEqual(
    waterChannels(),
    channelFrame,
    'independent channel controls remain deterministic while paused'
  )
  effects.setBathhouseStrengths({ waterfalls: 99, waves: -2 })
  assert.equal(effects.status.bathhouseWaterfalls, 5)
  assert.equal(effects.status.bathhouseWaves, 0)
  effects.setBathhouseStrengths({ waterfalls: Infinity, waves: NaN })
  assert.equal(effects.status.bathhouseWaterfalls, 3.15)
  assert.equal(effects.status.bathhouseWaves, 1.5)
  assert.deepEqual(
    [
      effects.status.waterReflections,
      effects.status.waterfallStreams,
      effects.status.mistRibbons
    ],
    channelBudgets,
    'channel controls do not change surface budgets'
  )
  assert.equal(
    allocated,
    before,
    'independent waterfall and wave controls reuse all textures'
  )

  const studioDetail = {
    vibe: {
      paint: Array(20).fill({
        polygon: mask,
        strokes: Array(20).fill({ points: curve, color: '#335dcc' })
      }),
      mobiles: Array(20).fill({ x: 0.5, y: 0.25, rx: 0.02, ry: 0.04 }),
      flecks: Array(20).fill(emitter)
    }
  }
  effects.setScene('open-studio', image, studioDetail)
  assert.equal(effects.status.paintSurfaces, 4)
  assert.equal(effects.status.paintStrokes, 20)
  assert.equal(effects.status.mobiles, 2)
  assert.equal(effects.status.glazeFlecks, 20)
  assert.equal(effects.status.waterMasks, 0)
  assert.equal(effects.status.waterReflections, 0)
  assert.equal(effects.status.waterfallStreams, 0)
  assert.equal(effects.status.mistRibbons, 0)
  before = allocated
  const pausedStudio = frame(17)
  assert.equal(
    frame(17),
    pausedStudio,
    'studio reveal loops and mobiles freeze with the caller clock'
  )
  assert.notEqual(frame(27), pausedStudio)
  assert.equal(
    frame(17, { scenery: false }),
    '[]',
    'decorative painted works disappear with the scenery'
  )
  assert.equal(frame(17, { enabled: false }), '[]')
  assert.equal(
    allocated,
    before,
    'studio strokes do not allocate an offscreen surface per frame'
  )

  effects.setScene('hearth', image, {
    vibe: {
      fire: { x: 0.5, y: 0.5, rx: 0.045, ry: 0.07 },
      spill: Array(20).fill(beam),
      embers: Array(20).fill(emitter)
    }
  })
  assert.equal(effects.status.fireLayers, 3)
  assert.equal(
    effects.status.fireRenderer,
    'canvas',
    'missing WebGL uses the translucent flame atlas'
  )
  assert.equal(
    effects.status.fireFallbackFrames,
    12,
    'the fallback atlas has a fixed memory budget'
  )
  assert.equal(effects.status.fireSpills, 3)
  assert.equal(effects.status.embers, 20)
  before = allocated
  const pausedHearth = frame(13)
  assert.equal(
    frame(13),
    pausedHearth,
    'fire curves, spill and embers freeze rather than consulting a wall clock'
  )
  assert.notEqual(frame(23), pausedHearth)
  main.ops = []
  effects.drawActorBack(main, { ...actor, held: true }, 80, null, 23)
  effects.drawActorBack(main, { ...actor, x: 0.02 }, 80, null, 23)
  assert.equal(
    main.ops.length,
    0,
    'held or distant creatures do not receive hearth glow'
  )
  for (let index = 0; index < 1000; index++)
    effects.drawActorBack(main, actor, 80, null, 23)
  assert.equal(
    main.ops.filter(([name]) => name === 'drawImage').length,
    12,
    'near-fire actor glows are capped independently of population'
  )
  frame(23, { scenery: false })
  effects.drawActorBack(main, actor, 80, null, 23)
  assert.equal(
    main.ops.length,
    0,
    'hidden hearth scenery also hides actor firelight'
  )
  frame(23, { enabled: false })
  effects.drawActorBack(main, actor, 80, null, 23)
  assert.equal(
    main.ops.length,
    0,
    'disabled effects cannot leave a stale actor glow'
  )
  assert.equal(
    allocated,
    before,
    'hearth frames reuse prepared spill masks and glow'
  )

  effects.setScene('temple', image, {
    vibe: {
      constellations: Array(20).fill({ points: curve, polygon: mask }),
      light: Array(20).fill(beam),
      stars: Array(20).fill(emitter)
    }
  })
  assert.equal(effects.status.constellationPaths, 6)
  assert.equal(effects.status.constellationNodes, 24)
  assert.equal(effects.status.templeLights, 3)
  assert.equal(effects.status.stars, 20)
  assert.equal(effects.status.fireLayers, 0)
  assert.equal(
    effects.status.fireRenderer,
    'none',
    'switching away releases the flame surface'
  )
  assert.equal(effects.status.fireFallbackFrames, 0)
  before = allocated
  const pausedTemple = frame(19)
  assert.equal(
    frame(19),
    pausedTemple,
    'constellations and light cycles freeze with the supplied time'
  )
  assert.notEqual(frame(31), pausedTemple)
  assert.equal(
    frame(19, { scenery: false }),
    '[]',
    'temple lights and linework follow scenery visibility'
  )
  assert.equal(allocated, before, 'temple frames reuse prepared masks')
  effects.setScene('temple', image, {
    vibe: {
      constellations: [{ points: [[NaN, 1]] }],
      light: [{ polygon: null }]
    }
  })
  assert.equal(
    frame(19),
    '[]',
    'malformed authored geometry does not draw nonfinite coordinates'
  )
  const intensityCases = {
    'quiet-house': {
      beams: [beam],
      curtains: [{ polygon: mask }],
      motes: [emitter]
    },
    'dream-garden': {
      glaze: [{ polygon: mask, strength: 0.55 }],
      spores: [emitter]
    },
    source: { flows: [{ points: curve, count: 4 }] },
    bathhouse: bathDetail.vibe,
    'open-studio': studioDetail.vibe,
    hearth: {
      fire: { x: 0.5, y: 0.5, rx: 0.04, ry: 0.1 },
      spill: [beam],
      embers: [emitter]
    },
    temple: {
      constellations: [{ points: curve }],
      light: [beam],
      stars: [emitter]
    }
  }
  const sampleActor = {
    x: 0.33,
    y: 0.4,
    moving: true,
    zone: { wet: true },
    visitor: { seed: 0.2, id: 'intensity-check' }
  }
  const actorBeforeIntensity = structuredClone(sampleActor)
  const intensityFrame = (time = 17) => {
    main.ops = []
    effects.drawBack(main, time, { actors: [sampleActor] })
    effects.drawActorBack(main, sampleActor, 80, { receive: 1 }, time)
    effects.drawFront(main, time)
    assert.equal(main.globalAlpha, 1)
    return JSON.stringify(main.ops)
  }
  const geometry = (serialized) =>
    JSON.parse(serialized).map((op) => {
      const paint = op.at(-1)
      return [...op.slice(0, -1), { lineWidth: paint.lineWidth }]
    })
  const opacity = (serialized) =>
    JSON.parse(serialized).reduce((total, op) => total + op.at(-1).alpha, 0)
  for (const [room, vibe] of Object.entries(intensityCases)) {
    effects.setIntensity(2.5)
    effects.setScene(room, image, { vibe })
    assert.equal(
      effects.status.intensity,
      2.5,
      `${room}: scene changes preserve chosen strength`
    )
    effects.setIntensity(1)
    const baseline = intensityFrame()
    const budgets = { ...effects.status, intensity: null }
    before = allocated
    for (const value of [0, 0.25, 1, 2.5, 5]) {
      effects.setIntensity(value)
      assert.equal(effects.status.intensity, value)
      assert.deepEqual(
        { ...effects.status, intensity: null },
        budgets,
        `${room}: strength leaves every emitter and surface budget unchanged`
      )
      const painted = intensityFrame()
      assert.equal(
        intensityFrame(),
        painted,
        `${room}: paused effect strength${value} is deterministic`
      )
      if (value === 0)
        assert.equal(
          painted,
          '[]',
          `${room}: zero suppresses all scenery and creature effects`
        )
      if (value === 1)
        assert.equal(
          painted,
          baseline,
          `${room}: strength1 preserves the exact baseline paint contract`
        )
      if (value === 5) {
        assert.ok(
          opacity(painted) > opacity(baseline),
          `${room}: strength5 visibly increases opacity`
        )
        assert.notDeepEqual(
          geometry(painted),
          geometry(baseline),
          `${room}: strength5 also increases local amplitude or stroke/particle size`
        )
      }
    }
    effects.setIntensity(1)
    assert.equal(
      intensityFrame(),
      baseline,
      `${room}: restoring1 while paused exactly restores the original frame`
    )
    effects.setIntensity(0)
    main.ops = []
    effects.drawActorBack(main, sampleActor, 80, { receive: 1 }, 17)
    assert.equal(
      main.ops.length,
      0,
      `${room}: zero immediately suppresses actor effects even before the next drawBack`
    )
    assert.equal(
      allocated,
      before,
      `${room}: the slider allocates no surfaces or atlases`
    )
  }
  assert.deepEqual(
    sampleActor,
    actorBeforeIntensity,
    'effect strength never changes actor geometry or observations'
  )
  for (const [value, expected] of [
    [-4, 0],
    [19, 5],
    [NaN, 1],
    [Infinity, 1],
    [undefined, 1]
  ]) {
    effects.setIntensity(value)
    assert.equal(
      effects.status.intensity,
      expected,
      'intensity sanitizes input to a finite0–5 value'
    )
  }
  effects.dispose()
  assert.equal(effects.status.disposed, true)
  assert.equal(effects.status.glazeRenderer, 'none')
  assert.equal(effects.status.sourceBeads, 0)
  assert.equal(effects.status.constellationNodes, 0)
  assert.equal(effects.status.templeLights, 0)
  assert.equal(effects.status.stars, 0)
  assert.equal(frame(50), '[]', 'disposed painter stays inactive')
  // Exercise the GL lifecycle separately. This mock checks orchestration and
  // context-loss recovery, not GLSL compilation or visual flame quality.
  const gpu = {
    draws: 0,
    deletedShaders: 0,
    deletedBuffers: 0,
    deletedPrograms: 0,
    released: 0,
    lost: false,
    times: [],
    uniforms: [],
    textureUploads: 0,
    deletedTextures: 0
  }
  let expectedGLSize = [192, 256]
  mockWebGL = (node) => {
    assert.deepEqual(
      [node.width, node.height],
      expectedGLSize,
      'effect GL resolution stays bounded'
    )
    const gl = {
      VERTEX_SHADER: 1,
      FRAGMENT_SHADER: 2,
      COMPILE_STATUS: 3,
      LINK_STATUS: 4,
      ARRAY_BUFFER: 5,
      STATIC_DRAW: 6,
      FLOAT: 7,
      TRIANGLES: 8,
      TEXTURE0: 9,
      TEXTURE_2D: 10,
      UNPACK_FLIP_Y_WEBGL: 11,
      TEXTURE_WRAP_S: 12,
      TEXTURE_WRAP_T: 13,
      CLAMP_TO_EDGE: 14,
      TEXTURE_MIN_FILTER: 15,
      TEXTURE_MAG_FILTER: 16,
      LINEAR: 17,
      RGBA: 18,
      UNSIGNED_BYTE: 19,
      createTexture: () => ({}),
      texImage2D: () => gpu.textureUploads++,
      deleteTexture: () => gpu.deletedTextures++,
      createShader: () => ({}),
      createProgram: () => ({}),
      createBuffer: () => ({}),
      getShaderParameter: () => true,
      getProgramParameter: () => true,
      getAttribLocation: () => 0,
      getUniformLocation: (_program, name) => name,
      uniform1f: (name, value) => {
        gpu.uniforms.push([name, value])
        if (name === 'uTime') gpu.times.push(value)
      },
      drawArrays: () => gpu.draws++,
      deleteShader: () => gpu.deletedShaders++,
      deleteBuffer: () => gpu.deletedBuffers++,
      deleteProgram: () => gpu.deletedPrograms++,
      isContextLost: () => gpu.lost,
      getExtension: () => ({ loseContext: () => gpu.released++ })
    }
    for (const name of [
      'shaderSource',
      'compileShader',
      'attachShader',
      'linkProgram',
      'bindBuffer',
      'bufferData',
      'useProgram',
      'enableVertexAttribArray',
      'vertexAttribPointer',
      'viewport',
      'uniform1i',
      'uniform2f',
      'uniform3fv',
      'activeTexture',
      'pixelStorei',
      'bindTexture',
      'texParameteri'
    ])
      gl[name] = () => {}
    return gl
  }
  const fireEffects = createRoomEffects()
  fireEffects.setScene('hearth', image, {
    vibe: { fire: { x: 0.5, y: 0.5, rx: 0.04, ry: 0.1 } }
  })
  assert.equal(fireEffects.status.fireRenderer, 'webgl')
  before = allocated
  fireEffects.drawBack(main, 8)
  fireEffects.drawBack(main, 8)
  assert.deepEqual(
    gpu.times,
    [8, 8],
    'GL receives exactly the caller clock, including paused redraws'
  )
  assert.equal(gpu.draws, 2)
  fireEffects.drawBack(main, 9, { enabled: false })
  assert.equal(gpu.draws, 2, 'hidden effects do not render the flame shader')
  fireEffects.setIntensity(0)
  fireEffects.drawBack(main, 9)
  assert.equal(gpu.draws, 2, 'zero strength submits no flame shader work')
  fireEffects.setIntensity(5)
  gpu.lost = true
  fireEffects.drawBack(main, 10)
  assert.equal(
    fireEffects.status.fireRenderer,
    'canvas',
    'lost flame context switches to the ready Canvas atlas'
  )
  assert.equal(gpu.draws, 2, 'context loss does not keep submitting GL work')
  assert.equal(
    allocated,
    before,
    'flame context loss needs no new offscreen allocation'
  )
  fireEffects.setScene('camp', image, null)
  assert.equal(gpu.deletedShaders, 2)
  assert.equal(gpu.deletedBuffers, 1)
  assert.equal(gpu.deletedPrograms, 1)
  assert.equal(gpu.released, 1, 'switching rooms releases the flame context')
  assert.equal(fireEffects.status.fireFallbackFrames, 0)
  fireEffects.dispose()
  assert.equal(
    gpu.released,
    1,
    'disposal does not double-release an old flame context'
  )
  expectedGLSize = [384, 384]
  gpu.lost = false
  gpu.uniforms = []
  const gardenEffects = createRoomEffects()
  gardenEffects.setScene('dream-garden', image, {
    vibe: { glaze: [{ polygon: mask, strength: 0.55 }] }
  })
  assert.equal(gardenEffects.status.glazeRenderer, 'webgl')
  before = allocated
  const uploads = gpu.textureUploads
  const draws = gpu.draws
  gardenEffects.drawBack(main, 11)
  gardenEffects.setIntensity(0)
  gardenEffects.drawBack(main, 11)
  assert.equal(
    gpu.draws,
    draws + 1,
    'zero intensity submits no Garden shader work'
  )
  gardenEffects.setIntensity(5)
  gardenEffects.drawBack(main, 11)
  assert.deepEqual(
    gpu.uniforms
      .filter(([name]) => name === 'uStrength')
      .map(([, value]) => value),
    [0.55, 2.75],
    'Garden distortion and glaze receive the chosen strength uniform'
  )
  const phases = gpu.uniforms
    .filter(([name]) => name === 'uPhase')
    .map(([, value]) => value)
  assert.equal(
    phases[0],
    phases[1],
    'a paused strength change does not advance the shader phase'
  )
  assert.equal(
    gpu.textureUploads,
    uploads,
    'strength input never reuploads a Garden texture'
  )
  gpu.lost = true
  gardenEffects.drawBack(main, 11)
  assert.equal(gardenEffects.status.glazeRenderer, 'canvas')
  assert.equal(
    gardenEffects.status.intensity,
    5,
    'context-loss fallback retains the chosen strength'
  )
  assert.equal(
    allocated,
    before,
    'Garden slider and fallback allocate no new surfaces'
  )
  gardenEffects.dispose()
  assert.equal(
    gpu.deletedTextures,
    1,
    'Garden lifecycle releases the reused texture'
  )
  mockWebGL = null
  console.log(
    'Seven-room effect checks passed:0–5 intensity with exact baseline restoration, bounded emitters and actor effects, deterministic paused frames, GPU strength and fallback, safe alpha, scenery gating, actor immutability, resource reuse and disposal. Shader appearance still needs browser review.'
  )
} finally {
  if (previousDocument === undefined) delete globalThis.document
  else globalThis.document = previousDocument
  if (previousPath === undefined) delete globalThis.Path2D
  else globalThis.Path2D = previousPath
}
