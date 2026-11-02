// Beam engine: parse a solved level, scramble its settings for play, trace the
// light, and decide whether every buoy is lit with the colour it needs while
// every forbidden reef stays dark.

export const DIRS = ['N', 'E', 'S', 'W']
export const STEPS = { N: [-1, 0], E: [0, 1], S: [1, 0], W: [0, -1] }
export const LENS_CYCLE = ['r', 'g', 'b']

export const COLOR_HEX = {
  w: '#f8fafc',
  r: '#fb7185',
  g: '#4ade80',
  b: '#38bdf8',
}

export const COLOR_NAMES = { w: 'white', r: 'red', g: 'green', b: 'blue' }

export const COLOR_NUMBER = { w: 0xf8fafc, r: 0xfb7185, g: 0x4ade80, b: 0x38bdf8 }

const HEADINGS = { '^': 'N', '>': 'E', v: 'S', '<': 'W' }
const BUOY_NEEDS = { W: 'w', R: 'r', G: 'g', B: 'b' }

// Incoming direction -> outgoing direction.
const MIRROR_TURNS = {
  '/': { N: 'E', E: 'N', S: 'W', W: 'S' },
  '\\': { N: 'W', W: 'N', S: 'E', E: 'S' },
}

export const rotateDir = (dir, steps = 1) => DIRS[(DIRS.indexOf(dir) + steps + 4) % 4]
export const flipMirror = (mirror) => (mirror === '/' ? '\\' : '/')
export const nextLens = (color) => LENS_CYCLE[(LENS_CYCLE.indexOf(color) + 1) % LENS_CYCLE.length]

export function reflect(mirror, dir) {
  return MIRROR_TURNS[mirror]?.[dir] ?? dir
}

const key = (r, c) => `${r}:${c}`

export function tileAt(board, r, c) {
  if (r < 0 || c < 0 || r >= board.rows || c >= board.cols) return null
  return board.tiles[r][c]
}

export function isOpenWater(board, r, c) {
  const tile = tileAt(board, r, c)
  return Boolean(tile) && tile.kind === 'water'
}

export function parseLevel(level) {
  const rows = level.art.length
  const cols = level.art[0].length
  const tiles = []

  for (let r = 0; r < rows; r += 1) {
    const line = level.art[r]
    if (line.length !== cols) throw new Error(`level ${level.id} row ${r} is the wrong width`)
    const row = []
    for (let c = 0; c < cols; c += 1) {
      const ch = line[c]
      const base = { r, c, ch }

      if (ch === '.') row.push({ ...base, kind: 'water' })
      else if (ch === '#') row.push({ ...base, kind: 'rock' })
      else if (ch === 'x') row.push({ ...base, kind: 'forbidden' })
      else if (ch === '/' || ch === '\\') row.push({ ...base, kind: 'mirror', mirror: ch, solution: { mirror: ch } })
      else if (HEADINGS[ch]) row.push({ ...base, kind: 'lighthouse', dir: HEADINGS[ch], solution: { dir: HEADINGS[ch] } })
      else if (LENS_CYCLE.includes(ch)) row.push({ ...base, kind: 'lens', color: ch, solution: { color: ch } })
      else if (BUOY_NEEDS[ch]) row.push({ ...base, kind: 'buoy', need: BUOY_NEEDS[ch] })
      else throw new Error(`level ${level.id} has an unknown symbol '${ch}'`)
    }
    tiles.push(row)
  }

  return { ...level, rows, cols, tiles, buoys: tiles.flat().filter((tile) => tile.kind === 'buoy') }
}

// How many taps it takes to put a tile back the way the art drew it.
export function tapsFor(tile) {
  if (tile.kind === 'lighthouse') {
    return (DIRS.indexOf(tile.solution.dir) - DIRS.indexOf(tile.dir) + 4) % 4
  }
  if (tile.kind === 'mirror') return tile.mirror === tile.solution.mirror ? 0 : 1
  if (tile.kind === 'lens') {
    return (LENS_CYCLE.indexOf(tile.solution.color) - LENS_CYCLE.indexOf(tile.color) + 3) % 3
  }
  return 0
}

// Deterministic scramble: each level's settings are turned away from the
// solution so the board always starts unsolved.
export function createBoard(level) {
  const board = parseLevel(level)
  const turn = 1 + (level.id % 3)

  for (const row of board.tiles) {
    for (const tile of row) {
      if (tile.kind === 'lighthouse') {
        tile.dir = rotateDir(tile.solution.dir, turn)
        tile.start = { dir: tile.dir }
      } else if (tile.kind === 'mirror') {
        tile.mirror = flipMirror(tile.solution.mirror)
        tile.start = { mirror: tile.mirror }
      } else if (tile.kind === 'lens') {
        tile.color = nextLens(tile.solution.color)
        tile.start = { color: tile.color }
      }
    }
  }

  board.par = board.tiles.flat().reduce((sum, tile) => sum + tapsFor(tile), 0)
  return board
}

export function resetBoard(board) {
  for (const tile of board.tiles.flat()) {
    if (tile.start?.dir) tile.dir = tile.start.dir
    if (tile.start?.mirror) tile.mirror = tile.start.mirror
    if (tile.start?.color) tile.color = tile.start.color
    if ('movedFrom' in tile) delete tile.movedFrom
  }
}

export function rotateTile(board, r, c) {
  const tile = tileAt(board, r, c)
  if (!tile) return false
  if (tile.kind === 'lighthouse') {
    tile.dir = rotateDir(tile.dir, 1)
    return true
  }
  return false
}

export function flipTile(board, r, c) {
  const tile = tileAt(board, r, c)
  if (!tile || tile.kind !== 'mirror') return false
  tile.mirror = flipMirror(tile.mirror)
  return true
}

export function cycleTile(board, r, c) {
  const tile = tileAt(board, r, c)
  if (!tile || tile.kind !== 'lens') return false
  tile.color = nextLens(tile.color)
  return true
}

export function moveTile(board, from, to) {
  const source = tileAt(board, from.r, from.c)
  const target = tileAt(board, to.r, to.c)
  if (!source || source.kind !== 'mirror') return false
  if (!target || target.kind !== 'water') return false

  board.tiles[to.r][to.c] = { ...source, r: to.r, c: to.c, movedFrom: { r: from.r, c: from.c } }
  board.tiles[from.r][from.c] = { ...target, r: from.r, c: from.c }
  return true
}

export function trace(board) {
  const beams = []
  const lit = new Map()
  const violations = new Set()

  for (const row of board.tiles) {
    for (const source of row) {
      if (source.kind !== 'lighthouse') continue

      let r = source.r
      let c = source.c
      let dir = source.dir
      let color = 'w'
      const path = [{ r, c, dir, color }]
      const seen = new Set()
      let guard = 0

      while (guard++ < 800) {
        const [dr, dc] = STEPS[dir]
        r += dr
        c += dc
        if (r < 0 || c < 0 || r >= board.rows || c >= board.cols) break

        const tile = board.tiles[r][c]

        if (tile.kind === 'lens') color = tile.color
        path.push({ r, c, dir, color })

        if (tile.kind === 'rock') break
        if (tile.kind === 'lighthouse') break
        if (tile.kind === 'forbidden') violations.add(key(r, c))
        if (tile.kind === 'buoy') {
          const bucket = lit.get(key(r, c)) ?? new Set()
          bucket.add(color)
          lit.set(key(r, c), bucket)
        }

        const state = `${r}:${c}:${dir}:${color}`
        if (seen.has(state)) break
        seen.add(state)

        if (tile.kind === 'mirror') dir = reflect(tile.mirror, dir)
      }

      beams.push({ path, source })
    }
  }

  return { beams, lit, violations }
}

export function buoyLit(result, buoy) {
  return result.lit.get(key(buoy.r, buoy.c))?.has(buoy.need) ?? false
}

export function buoyWrongColour(result, buoy) {
  const colours = result.lit.get(key(buoy.r, buoy.c))
  if (!colours || !colours.size) return false
  return !colours.has(buoy.need)
}

export function isSolved(board, result = trace(board)) {
  const litCount = board.buoys.filter((buoy) => buoyLit(result, buoy)).length
  return litCount === board.buoys.length && board.buoys.length > 0 && result.violations.size === 0
}

export function progressOf(board, result) {
  const litCount = board.buoys.filter((buoy) => buoyLit(result, buoy)).length
  return { lit: litCount, total: board.buoys.length, violations: result.violations.size }
}

export function starsFor({ actions = 0, hints = 0, par = 1 } = {}) {
  if (hints > 0) return 1
  if (actions <= par) return 3
  if (actions <= Math.ceil(par * 1.8)) return 2
  return 1
}

// First tile whose setting differs from the solved board, for the hint button.
export function nextFix(board) {
  for (const row of board.tiles) {
    for (const tile of row) {
      if (tapsFor(tile) > 0) return tile
    }
  }
  return null
}

export function applyHint(board, tile) {
  if (!tile) return false
  if (tile.kind === 'lighthouse') tile.dir = tile.solution.dir
  else if (tile.kind === 'mirror') tile.mirror = tile.solution.mirror
  else if (tile.kind === 'lens') tile.color = tile.solution.color
  else return false
  return true
}
