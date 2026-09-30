import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject
} from 'react'
import SOUND_CATALOG from '@/lib/world/sound-catalog.json'

type Creature = {
  id: number
  family: number
  x: number
  y: number
  state: 'landed' | 'dragging' | 'falling' | 'returning'
}

const CONTOURS = [
  'M 89 465 C 18 409 20 327 54 256 C 100 161 169 94 249 87 C 297 82 337 96 342 132 C 353 177 306 218 262 248 C 297 253 340 270 364 313 C 390 355 378 406 343 437 C 306 476 245 488 183 487 C 144 488 111 482 89 465 Z',
  'M 132 477 C 105 475 103 444 106 424 C 79 441 48 426 54 398 L 73 348 C 41 354 23 336 30 313 C 38 294 60 294 79 281 C 39 264 22 236 32 219 C 40 195 74 205 107 220 C 120 199 136 191 154 185 C 136 143 153 106 178 96 C 202 85 222 104 215 127 C 208 147 236 148 232 192 C 275 184 322 203 330 232 C 344 238 371 265 366 287 C 361 309 340 315 326 311 C 332 333 347 359 332 378 C 317 395 291 387 282 378 C 282 404 307 425 296 455 C 286 480 254 478 225 462 C 202 468 168 472 151 463 C 149 475 140 479 132 477 Z',
  'M 190 104 C 191 87 211 88 221 106 C 235 127 233 156 236 175 C 251 215 299 226 337 241 C 361 244 372 259 356 274 C 339 292 295 292 272 304 C 252 321 248 345 238 375 C 235 397 220 411 206 391 C 190 363 186 335 172 317 C 144 302 112 296 87 291 C 62 286 15 272 21 251 C 25 235 62 237 84 227 C 124 211 159 179 176 145 C 187 127 193 117 190 104 Z M 326 302 A 18 19 0 1 0 327 341 A 18 19 0 1 0 326 302 Z M 210 419 A 18 18 0 1 0 211 455 A 18 18 0 1 0 210 419 Z',
  'M 71 450 C 31 420 27 378 38 347 C 28 329 21 311 38 289 C 16 267 25 239 44 224 C 26 201 41 172 64 165 C 60 136 82 125 103 120 C 112 94 138 91 157 102 C 175 80 204 82 216 98 C 242 97 260 119 249 145 C 262 158 257 183 239 195 C 259 226 302 238 312 269 C 330 303 317 347 296 365 C 327 361 353 372 359 401 C 371 434 353 467 326 475 C 299 487 278 474 257 461 C 231 471 216 475 199 463 C 169 475 149 482 134 468 C 111 480 93 468 71 450 Z',
  'M 37 346 C 36 322 52 302 69 292 L 73 262 L 103 233 C 86 215 97 188 121 176 L 133 146 L 164 140 L 175 90 L 204 66 L 233 27 L 267 24 L 284 55 L 287 96 L 311 112 L 325 144 L 312 181 C 343 190 368 232 367 260 C 364 292 331 322 301 337 L 297 366 C 320 377 326 394 311 402 L 269 405 C 248 401 250 383 252 370 L 218 358 L 177 371 L 157 388 C 145 411 119 411 91 402 C 68 391 96 371 108 360 L 75 365 Z',
  'M 138 403 C 85 392 35 348 40 294 C 36 263 59 234 55 209 C 38 169 61 127 85 100 C 118 52 172 21 223 28 C 266 29 294 48 280 80 C 265 109 221 119 197 137 C 225 136 254 155 266 182 C 285 217 267 244 260 266 C 287 250 305 211 326 201 C 348 185 378 207 376 230 C 377 260 350 271 337 282 C 344 321 326 358 291 382 C 252 409 188 416 138 403 Z',
  'M 83 395 C 58 380 23 351 22 322 C 18 294 38 276 40 253 C 7 230 26 196 57 197 C 74 178 92 168 119 162 C 100 139 116 116 138 116 C 163 128 187 115 201 95 C 215 74 230 20 252 21 C 284 22 280 51 266 69 C 280 90 274 118 257 139 C 272 164 288 197 286 223 C 280 256 262 286 246 309 C 275 297 291 283 309 279 C 330 271 351 287 348 307 C 346 327 321 335 316 351 C 314 375 289 397 267 403 C 203 419 128 410 83 395 Z',
  'M 95 399 C 77 391 82 372 87 361 C 65 343 41 320 39 289 C 33 255 48 225 68 205 C 53 191 40 175 46 157 C 54 141 74 148 77 166 L 96 178 C 110 157 132 144 148 137 C 131 117 115 86 100 73 C 80 76 68 57 79 43 C 94 29 111 43 107 56 C 120 87 137 109 164 115 C 169 82 172 61 168 47 C 150 35 153 14 170 14 C 191 10 197 35 185 47 C 180 78 184 105 196 117 C 215 108 227 89 232 67 C 217 51 228 35 245 39 C 267 44 262 66 248 73 L 238 123 C 261 127 281 145 293 165 C 309 164 321 155 331 141 C 332 123 350 119 355 135 C 361 151 347 163 334 160 L 309 181 C 327 207 340 241 331 276 C 320 313 296 344 268 358 C 290 373 277 394 260 396 C 240 400 230 387 228 376 C 182 389 140 382 121 372 C 117 390 110 402 95 399 Z'
]

const ALLOWED_VOICES = [
  'cartoon-trill',
  'kyoto',
  'minion',
  'furble',
  'xpoki-trill',
  'bright-giggles',
  'warm-laughter',
  'playful-snickers'
]
const DROP_SOUND = '/audio/foley-kenney-impact-footstep-carpet-003.mp3'

function play(src: string, enabled: boolean) {
  if (!enabled) return
  const audio = new Audio(src)
  audio.volume = 0.28
  void audio.play().catch(() => {})
}

function CreatureArt({ family }: { family: number }) {
  const column = family % 4
  const row = Math.floor(family / 4)
  const clipId = useId()
  return (
    <svg viewBox='0 0 384 512' aria-hidden='true'>
      <defs>
        <clipPath id={clipId}>
          <path d={CONTOURS[family]} />
        </clipPath>
      </defs>
      <image
        href='/world/creatures.webp'
        x={-column * 384}
        y={-row * 512}
        width='1536'
        height='1024'
        clipPath={`url(#${clipId})`}
      />
    </svg>
  )
}

const selectedFamilies = [0, 1, 7]

export default function CtaCreatures({
  fieldRef
}: {
  fieldRef: RefObject<HTMLDivElement | null>
}) {
  const movedCreatures = useRef(new Set<number>())
  const dragRef = useRef<{ id: number; dx: number; dy: number } | undefined>(
    undefined
  )
  const timers = useRef<Set<ReturnType<typeof setTimeout>>>(new Set())
  const sound = true
  const [voiceSelections] = useState(() => {
    const available = [...ALLOWED_VOICES]
    return selectedFamilies.map(
      () =>
        available.splice(Math.floor(Math.random() * available.length), 1)[0]!
    )
  })
  const lastVoice = useRef<Record<string, string>>({})
  const activeVoices = useRef(new Map<number, HTMLAudioElement>())

  useEffect(() => {
    const voices = activeVoices.current
    return () => {
      for (const audio of voices.values()) audio.pause()
      voices.clear()
    }
  }, [])
  const [creatures, setCreatures] = useState<Creature[]>([
    { id: 0, family: 0, x: 27, y: 63, state: 'landed' },
    { id: 1, family: 1, x: 50, y: 50, state: 'landed' },
    { id: 2, family: 7, x: 76, y: 64, state: 'landed' }
  ])

  useLayoutEffect(() => {
    const field = fieldRef.current
    const primary = field?.querySelector<HTMLElement>('[data-cta="primary"]')
    if (!field || !primary) return
    const positionCreatures = () => {
      const bounds = field.getBoundingClientRect()
      const button = primary.getBoundingClientRect()
      const narrow = bounds.width <= 720
      setCreatures((current) =>
        current.map((creature) =>
          !movedCreatures.current.has(creature.id) &&
          (creature.id === 1 || narrow)
            ? {
                ...creature,
                x:
                  ((button.left +
                    button.width / 2 -
                    bounds.left +
                    (narrow ? (creature.id - 1) * 84 : 0)) /
                    bounds.width) *
                  100,
                y: ((button.top - bounds.top) / bounds.height) * 100
              }
            : creature
        )
      )
    }
    positionCreatures()
    const observer = new ResizeObserver(positionCreatures)
    observer.observe(field)
    observer.observe(primary)
    return () => observer.disconnect()
  }, [fieldRef])

  useEffect(
    () => () => {
      for (const timer of timers.current) clearTimeout(timer)
    },
    []
  )

  const update = (id: number, next: Partial<Creature>) =>
    setCreatures((current) =>
      current.map((creature) =>
        creature.id === id ? { ...creature, ...next } : creature
      )
    )

  const auditionVoice = (slot: number) => {
    if (activeVoices.current.has(slot)) return
    const family = voiceSelections[slot]
    const clips = SOUND_CATALOG.clips.filter(
      (clip) => clip.kind === 'voice' && clip.family === family
    )
    const alternatives = clips.filter(
      (clip) => clip.id !== lastVoice.current[family!]
    )
    const choices = alternatives.length ? alternatives : clips
    const clip = choices[Math.floor(Math.random() * choices.length)]
    if (!clip) return
    const audio = new Audio(`/audio/${clip.src}`)
    audio.volume = 0.28
    const release = () => {
      if (activeVoices.current.get(slot) === audio)
        activeVoices.current.delete(slot)
    }
    audio.onended = release
    audio.onerror = release
    audio.onpause = release
    activeVoices.current.set(slot, audio)
    void audio
      .play()
      .then(() => {
        lastVoice.current[family!] = clip.id
      })
      .catch(release)
  }

  const returnCreature = (id: number) => {
    const field = fieldRef.current
    if (!field) return
    const buttons = [...field.querySelectorAll<HTMLElement>('[data-cta]')]
    const target = buttons[id % buttons.length]
    if (!target) return
    const fieldRect = field.getBoundingClientRect()
    const targetRect = target.getBoundingClientRect()
    update(id, {
      x:
        ((targetRect.left + targetRect.width / 2 - fieldRect.left) /
          fieldRect.width) *
        100,
      y: -18,
      state: 'returning'
    })
    const timer = setTimeout(() => {
      update(id, {
        y: ((targetRect.top - fieldRect.top) / fieldRect.height) * 100 - 3,
        state: 'landed'
      })
      play(DROP_SOUND, sound)
      auditionVoice(id)
      timers.current.delete(timer)
    }, 80)
    timers.current.add(timer)
  }

  const finishDrag = (event: PointerEvent) => {
    const drag = dragRef.current
    const field = fieldRef.current
    if (!drag || !field) return
    dragRef.current = undefined
    auditionVoice(drag.id)
    const fieldRect = field.getBoundingClientRect()
    const target = document
      .elementFromPoint(event.clientX, event.clientY)
      ?.closest<HTMLElement>('[data-cta]')
    if (target && field.contains(target)) {
      const rect = target.getBoundingClientRect()
      update(drag.id, {
        x: ((event.clientX - fieldRect.left) / fieldRect.width) * 100,
        y: ((rect.top - fieldRect.top) / fieldRect.height) * 100 - 3,
        state: 'landed'
      })
      play(DROP_SOUND, sound)
      return
    }
    if (
      event.clientX < fieldRect.left ||
      event.clientX > fieldRect.right ||
      event.clientY < fieldRect.top ||
      event.clientY > fieldRect.bottom
    ) {
      update(drag.id, { y: 125, state: 'falling' })
      const timer = setTimeout(() => {
        returnCreature(drag.id)
        timers.current.delete(timer)
      }, 2200)
      timers.current.add(timer)
      return
    }
    update(drag.id, { state: 'landed' })
  }

  useEffect(() => {
    const move = (event: PointerEvent) => {
      const drag = dragRef.current
      const field = fieldRef.current
      if (!drag || !field) return
      const rect = field.getBoundingClientRect()
      update(drag.id, {
        x: ((event.clientX - rect.left - drag.dx) / rect.width) * 100,
        y: ((event.clientY - rect.top - drag.dy) / rect.height) * 100
      })
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', finishDrag)
    window.addEventListener('pointercancel', finishDrag)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', finishDrag)
      window.removeEventListener('pointercancel', finishDrag)
    }
  })

  return (
    <>
      {creatures.map((creature) => (
        <button
          key={creature.id}
          type='button'
          className='cta-creature'
          data-state={creature.state}
          aria-label={`Creature ${creature.id + 1}. Drag it onto a button or off the edge.`}
          style={{ left: `${creature.x}%`, top: `${creature.y}%` }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              auditionVoice(creature.id)
            }
          }}
          onPointerEnter={() => {
            auditionVoice(creature.id)
          }}
          onPointerDown={(event) => {
            if (event.button !== 0) return
            movedCreatures.current.add(creature.id)
            const element = event.currentTarget
            const fieldRect = fieldRef.current!.getBoundingClientRect()
            dragRef.current = {
              id: creature.id,
              dx: event.clientX - fieldRect.left - element.offsetLeft,
              dy: event.clientY - fieldRect.top - element.offsetTop
            }
            update(creature.id, { state: 'dragging' })
            auditionVoice(creature.id)
            event.currentTarget.setPointerCapture(event.pointerId)
            event.preventDefault()
          }}
        >
          <CreatureArt
            family={selectedFamilies[creature.id] ?? creature.family}
          />
        </button>
      ))}
    </>
  )
}
