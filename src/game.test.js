import test from 'node:test'
import assert from 'node:assert/strict'
import { CHAPTERS, LEVELS } from './levels.js'
import {
  COLOR_NAMES,
  DIRS,
  LENS_CYCLE,
  applyHint,
  buoyLit,
  buoyWrongColour,
  createBoard,
  cycleTile,
  flipMirror,
  flipTile,
  isOpenWater,
  isSolved,
  moveTile,
  nextFix,
  nextLens,
  parseLevel,
  progressOf,
  reflect,
  resetBoard,
  rotateDir,
  rotateTile,
  starsFor,
  tapsFor,
  trace,
} from './game.js'

const boardOf = (art) => parseLevel({ id: 0, name: 'test', art })
const solved = (board) => isSolved(board, trace(board))

test('the campaign is big enough and ids are unique', () => {
  assert.ok(LEVELS.length >= 24, `only ${LEVELS.length} levels`)
  assert.equal(new Set(LEVELS.map((level) => level.id)).size, LEVELS.length)
  assert.equal(new Set(LEVELS.map((level) => level.name)).size, LEVELS.length)
  for (const chapter of CHAPTERS) {
    const levels = LEVELS.filter((level) => level.chapter === chapter.id)
    assert.ok(levels.length >= 6, `${chapter.id} has ${levels.length} levels`)
  }
  assert.equal(LEVELS[0].chapter, 'harbor')
  assert.equal(LEVELS.at(-1).chapter, 'storm')
})

test('every level art is a genuine solution', () => {
  for (const level of LEVELS) {
    const board = parseLevel(level)
    const result = trace(board)
    assert.ok(board.buoys.length > 0, `level ${level.id} has no buoy`)
    assert.ok(isSolved(board, result), `level ${level.id} art does not light every buoy`)
    assert.equal(result.violations.size, 0, `level ${level.id} lights a forbidden reef`)
    for (const buoy of board.buoys) {
      assert.ok(buoyLit(result, buoy), `level ${level.id} buoy ${buoy.r},${buoy.c} is unlit`)
      assert.equal(buoyWrongColour(result, buoy), false, `level ${level.id} buoy has the wrong colour`)
    }
  }
})

test('every scramble starts unsolved and needs exactly par taps to fix', () => {
  for (const level of LEVELS) {
    const board = createBoard(level)
    assert.ok(board.par > 0, `level ${level.id} needs no taps`)
    assert.equal(solved(board), false, `level ${level.id} starts solved`)

    let taps = 0
    for (const row of board.tiles) {
      for (const tile of row) {
        if (tile.kind === 'lighthouse') {
          while (tile.dir !== tile.solution.dir) {
            rotateTile(board, tile.r, tile.c)
            taps += 1
            assert.ok(taps < 100, 'rotation guard')
          }
        } else if (tile.kind === 'mirror') {
          if (tile.mirror !== tile.solution.mirror) {
            flipTile(board, tile.r, tile.c)
            taps += 1
          }
        } else if (tile.kind === 'lens') {
          while (tile.color !== tile.solution.color) {
            cycleTile(board, tile.r, tile.c)
            taps += 1
            assert.ok(taps < 100, 'lens guard')
          }
        }
      }
    }
    assert.equal(taps, board.par, `level ${level.id} par mismatch`)
    assert.ok(solved(board), `level ${level.id} cannot be solved by its own settings`)
    assert.equal(progressOf(board, trace(board)).violations, 0)
  }
})

test('mirrors reflect on both diagonals', () => {
  assert.equal(reflect('/', 'E'), 'N')
  assert.equal(reflect('/', 'S'), 'W')
  assert.equal(reflect('/', 'W'), 'S')
  assert.equal(reflect('/', 'N'), 'E')
  assert.equal(reflect('\\', 'E'), 'S')
  assert.equal(reflect('\\', 'N'), 'W')
  assert.equal(reflect('\\', 'W'), 'N')
  assert.equal(reflect('\\', 'S'), 'E')
  assert.equal(flipMirror('/'), '\\')
})

test('directions and lens colours cycle', () => {
  assert.equal(rotateDir('N'), 'E')
  assert.equal(rotateDir('E', 3), 'N')
  assert.equal(rotateDir('W', -1), 'S')
  assert.equal(DIRS.length, 4)
  assert.equal(nextLens('r'), 'g')
  assert.equal(nextLens('b'), 'r')
  assert.equal(LENS_CYCLE.length, 3)
})

test('a coloured buoy needs exactly its colour', () => {
  const board = boardOf(['.>.r.R.'])
  assert.ok(solved(board), 'red lens lights the red buoy')

  const wrong = boardOf(['.>.g.R.'])
  const result = trace(wrong)
  assert.equal(buoyLit(result, wrong.buoys[0]), false)
  assert.equal(buoyWrongColour(result, wrong.buoys[0]), true)
  assert.equal(isSolved(wrong, result), false)

  const white = boardOf(['.>..R.'])
  assert.equal(isSolved(white, trace(white)), false, 'white light must not satisfy a red buoy')
})

test('white light passes through to a white buoy only before any lens', () => {
  const chain = boardOf(['.>..W.b.B.'])
  const result = trace(chain)
  assert.equal(buoyLit(result, chain.buoys[0]), true, 'white buoy before the lens')
  assert.equal(buoyLit(result, chain.buoys[1]), true, 'blue buoy after the lens')
  assert.ok(isSolved(chain, result))
})

test('forbidden reefs fail the level even when every buoy is lit', () => {
  const board = boardOf(['.>..x..W'])
  const result = trace(board)
  assert.equal(result.violations.size, 1)
  assert.equal(buoyLit(result, board.buoys[0]), true)
  assert.equal(isSolved(board, result), false)

  const safe = boardOf(['.>..W..', '...x...'])
  assert.ok(solved(safe))
})

test('rocks stop a beam dead', () => {
  const board = boardOf(['.>.#.W'])
  const result = trace(board)
  assert.equal(result.beams.length, 1)
  assert.equal(result.beams[0].path.at(-1).c, 3, 'beam ends on the rock')
  assert.equal(result.lit.size, 0)
  assert.equal(isSolved(board, result), false)
})

test('mirror loops terminate instead of hanging', () => {
  const board = boardOf(['.>.....', './\\....', '.\\/....', '.......'])
  const before = Date.now()
  const result = trace(board)
  assert.ok(Date.now() - before < 1000)
  assert.ok(result.beams.length >= 1)
})

test('two lighthouses each trace their own beam', () => {
  const board = boardOf(['.v.....v.', '.........', '.........', '.W.....W.'])
  const result = trace(board)
  assert.equal(result.beams.length, 2)
  assert.equal(board.buoys.filter((buoy) => buoyLit(result, buoy)).length, 2)
  assert.ok(isSolved(board, result))
})

test('mirrors only move into open water', () => {
  const board = boardOf(['/..#', '....', '..W.'])
  assert.equal(moveTile(board, { r: 0, c: 0 }, { r: 1, c: 1 }), true)
  assert.equal(board.tiles[0][0].kind, 'water')
  assert.equal(board.tiles[1][1].kind, 'mirror')
  assert.equal(board.tiles[1][1].mirror, '/')

  assert.equal(moveTile(board, { r: 1, c: 1 }, { r: 0, c: 3 }), false, 'cannot move onto rock')
  assert.equal(moveTile(board, { r: 1, c: 1 }, { r: 2, c: 2 }), false, 'cannot move onto a buoy')
  assert.equal(moveTile(board, { r: 1, c: 1 }, { r: 5, c: 5 }), false, 'cannot move off the board')
  assert.equal(moveTile(board, { r: 2, c: 2 }, { r: 0, c: 1 }), false, 'buoys are not movable')
  assert.equal(isOpenWater(board, 0, 1), true)
})

test('reset restores the scrambled start, hints fix one tile', () => {
  const level = LEVELS.find((entry) => entry.id === 6)
  const board = createBoard(level)
  const start = board.tiles.flat().map((tile) => [tile.dir, tile.mirror, tile.color].join())

  const fix = nextFix(board)
  assert.ok(fix, 'something needs fixing')
  assert.ok(applyHint(board, fix))
  assert.equal(tapsFor(fix), 0, 'the hinted tile now matches the solution')

  resetBoard(board)
  assert.deepEqual(
    board.tiles.flat().map((tile) => [tile.dir, tile.mirror, tile.color].join()),
    start,
    'reset returns every tile to its starting setting',
  )
  assert.equal(isSolved(board, trace(board)), false)
})

test('star ratings reward fewer actions', () => {
  assert.equal(starsFor({ actions: 6, par: 6 }), 3)
  assert.equal(starsFor({ actions: 8, par: 6 }), 2)
  assert.equal(starsFor({ actions: 30, par: 6 }), 1)
  assert.equal(starsFor({ actions: 6, par: 6, hints: 1 }), 1)
  assert.equal(COLOR_NAMES.r, 'red')
})
