import { execFileSync } from 'node:child_process'
for (const name of [
  'crowd',
  'physics',
  'room-acting',
  'room-effects',
  'sound-engine',
  'scene-sound',
  'review-preferences'
]) {
  execFileSync(process.execPath, [`lib/world/check-${name}.mjs`], {
    stdio: 'inherit'
  })
}
