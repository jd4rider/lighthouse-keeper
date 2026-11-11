import Phaser from 'phaser'
import { openTipJar } from './support.js'
import { W, H, background, button, text, fade } from './common.js'
import { confetti, flashAt, popText, ring, sparkle } from './fx.js'
import { audioState, sfx } from '../sound.js'
import { data, persist, recordSolve } from './save.js'
import {
  COLOR_HEX,
  COLOR_NAMES,
  COLOR_NUMBER,
  LENS_CYCLE,
  applyHint,
  buoyLit,
  buoyWrongColour,
  createBoard,
  cycleTile,
  flipTile,
  isOpenWater,
  isSolved,
  moveTile,
  nextFix,
  progressOf,
  resetBoard,
  rotateTile,
  starsFor,
  tileAt,
  trace,
} from '../game.js'
import { CHAPTERS, CHAPTER_OF, LEVELS } from '../levels.js'

const BOARD_TOP = 148
const BOARD_SPACE = 552
const ARROWS = { N: -90, E: 0, S: 90, W: 180 }

export default class GameScene extends Phaser.Scene {
  constructor() {
    super('game')
  }

  init(payload = {}) {
    this.level = LEVELS.find((entry) => entry.id === payload.level) ?? LEVELS[0]
    this.board = createBoard(this.level)
    this.chapter = CHAPTER_OF(this.level.chapter)
    this.result = trace(this.board)
    this.actions = 0
    this.hintsUsed = 0
    this.over = false
    this.pick = null
    this.lastLit = new Set()
    this.wasViolating = false
  }

  create() {
    background(this, this.chapter.bg, this.chapter.accent)
    this.cameras.main.fadeIn(220, 2, 10, 18)

    this.add.rectangle(W / 2, 62, W, 124, 0x020c15, 0.92).setDepth(30)
    this.add.rectangle(W / 2, 124, W, 2, this.chapter.accent, 0.75).setDepth(31)

    text(this, 20, 14, this.level.name, 25, '#e0f2fe', { fontStyle: 'bold' }).setDepth(32)
    text(this, 20, 48, `${this.chapter.name} · station ${LEVELS.indexOf(this.level) + 1}`, 13, '#7dd3fc').setDepth(32)
    this.actionsText = text(this, 20, 76, '', 14, '#93c5fd').setDepth(32)
    this.buoyText = text(this, W - 20, 76, '', 14, '#fde68a').setOrigin(1, 0).setDepth(32)
    this.reefText = text(this, W - 20, 48, '', 14, '#fca5a5').setOrigin(1, 0).setDepth(32).setAlpha(0)

    button(this, W - 58, 20, 'Coasts', () => this.leave(), { w: 92, h: 32, size: 13, color: 0x0f3b52 }).setDepth(32)

    this.layout()
    this.beams = this.add.graphics().setDepth(6)
    this.views = []

    this.buildFooter()
    this.input.on('pointerdown', (pointer) => this.onDown(pointer))
    this.input.on('pointerup', (pointer) => this.onUp(pointer))
    this.input.keyboard?.on('keydown-R', () => this.resetBoard())

    this.renderTiles()
    this.renderBeams()
    this.refreshHud()
  }

  layout() {
    const { rows, cols } = this.board
    const cell = Math.min(Math.floor((W - 64) / cols), Math.floor(BOARD_SPACE / rows), 62)
    this.cell = cell
    this.ox = (W - cell * cols) / 2
    this.oy = BOARD_TOP + (BOARD_SPACE - cell * rows) / 2

    const frame = this.add.graphics().setDepth(2)
    const m = 14
    frame.fillStyle(0x03202f, 0.72)
    frame.fillRoundedRect(this.ox - m, this.oy - m, cell * cols + m * 2, cell * rows + m * 2, 22)
    frame.lineStyle(2, this.chapter.accent, 0.32)
    frame.strokeRoundedRect(this.ox - m, this.oy - m, cell * cols + m * 2, cell * rows + m * 2, 22)

    // Slow swell across the whole board.
    const sea = this.add.graphics().setDepth(3)
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        const x = this.ox + c * cell + cell / 2
        const y = this.oy + r * cell + cell * 0.68
        sea.lineStyle(1, 0x7dd3fc, 0.09)
        sea.beginPath()
        sea.moveTo(x - cell * 0.26, y)
        sea.lineTo(x - cell * 0.08, y - cell * 0.06)
        sea.lineTo(x + cell * 0.1, y + cell * 0.03)
        sea.lineTo(x + cell * 0.26, y - cell * 0.04)
        sea.strokePath()
      }
    }

    const grid = this.add.graphics().setDepth(4)
    for (let c = 0; c <= cols; c += 1) {
      grid.lineStyle(1, 0xffffff, 0.05)
      grid.lineBetween(this.ox + c * cell, this.oy, this.ox + c * cell, this.oy + rows * cell)
    }
    for (let r = 0; r <= rows; r += 1) {
      grid.lineStyle(1, 0xffffff, 0.05)
      grid.lineBetween(this.ox, this.oy + r * cell, this.ox + cols * cell, this.oy + r * cell)
    }
  }

  buildFooter() {
    const y = 786
    button(this, 78, y, '💡 Hint', () => this.useHint(), { w: 118, h: 44, size: 15, color: 0xb45309 }).setDepth(31)
    button(this, 210, y, '↺ Reset', () => this.resetBoard(), { w: 118, h: 44, size: 15, color: 0x0369a1 }).setDepth(31)
    this.soundButton = button(this, 342, y, audioState.muted ? 'Sound off' : 'Sound on', () => this.toggleSound(), {
      w: 118,
      h: 44,
      size: 15,
      color: 0x0f3b52,
    }).setDepth(31)
    button(this, 484, y, 'All coasts', () => this.leave(), { w: 132, h: 44, size: 15, color: 0x0f3b52 }).setDepth(31)
  }

  // ---------- drawing ----------

  centre(r, c) {
    return {
      x: this.ox + c * this.cell + this.cell / 2,
      y: this.oy + r * this.cell + this.cell / 2,
    }
  }

  renderTiles() {
    for (const row of this.views) {
      for (const view of row) {
        if (!view) continue
        view.each((child) => this.tweens.killTweensOf(child))
        view.destroy()
      }
    }
    this.views = []
    for (let r = 0; r < this.board.rows; r += 1) {
      const row = []
      for (let c = 0; c < this.board.cols; c += 1) row.push(this.drawTile(r, c))
      this.views.push(row)
    }
  }

  drawTile(r, c) {
    const tile = tileAt(this.board, r, c)
    const { x, y } = this.centre(r, c)
    const size = this.cell
    const box = this.add.container(x, y).setDepth(8)

    if (tile.kind === 'rock') {
      const g = this.add.graphics()
      g.fillStyle(0x0a1c26, 1)
      g.fillCircle(-size * 0.16, size * 0.1, size * 0.26)
      g.fillCircle(size * 0.18, size * 0.06, size * 0.22)
      g.fillCircle(size * 0.02, -size * 0.16, size * 0.24)
      g.fillStyle(0x14313f, 1)
      g.fillCircle(-size * 0.1, -size * 0.02, size * 0.14)
      box.add(g)
    }

    if (tile.kind === 'forbidden') {
      const lit = this.result.violations.has(`${r}:${c}`)
      const g = this.add.graphics()
      g.lineStyle(3, 0xef4444, lit ? 0.95 : 0.5)
      g.strokeCircle(0, 0, size * 0.32)
      g.lineStyle(2, 0xef4444, lit ? 0.8 : 0.3)
      g.lineBetween(-size * 0.18, -size * 0.18, size * 0.18, size * 0.18)
      g.lineBetween(size * 0.18, -size * 0.18, -size * 0.18, size * 0.18)
      g.fillStyle(0x7f1d1d, lit ? 0.55 : 0.22)
      g.fillCircle(0, 0, size * 0.32)
      box.add(g)
      if (lit) {
        const glow = this.add.image(0, 0, 'glow').setTint(0xef4444).setBlendMode('ADD').setScale(size / 90)
        box.add(glow)
        this.tweens.add({ targets: glow, alpha: 0.3, duration: 600, yoyo: true, repeat: -1 })
      }
    }

    if (tile.kind === 'mirror') {
      const g = this.add.graphics()
      const s = size * 0.34
      const slash = tile.mirror === '/'
      const x1 = slash ? -s : -s
      const y1 = slash ? s : -s
      const x2 = slash ? s : s
      const y2 = slash ? -s : s
      g.lineStyle(9, 0x94a3b8, 0.85)
      g.lineBetween(x1, y1, x2, y2)
      g.lineStyle(4, 0xf1f5f9, 1)
      g.lineBetween(x1, y1, x2, y2)
      g.fillStyle(0x64748b, 1)
      g.fillCircle(x1, y1, 4)
      g.fillCircle(x2, y2, 4)
      box.add(g)
      box.add(this.add.text(0, size * 0.3, '↔', 11, '#94a3b8').setOrigin(0.5).setAlpha(0.5))
    }

    if (tile.kind === 'lens') {
      const g = this.add.graphics()
      g.fillStyle(COLOR_NUMBER[tile.color], 0.5)
      g.fillCircle(0, 0, size * 0.3)
      g.lineStyle(3, COLOR_NUMBER[tile.color], 0.95)
      g.strokeCircle(0, 0, size * 0.3)
      g.fillStyle(0xffffff, 0.55)
      g.fillCircle(-size * 0.1, -size * 0.11, size * 0.07)
      box.add(g)
    }

    if (tile.kind === 'buoy') {
      const lit = buoyLit(this.result, tile)
      const wrong = buoyWrongColour(this.result, tile)
      const color = COLOR_NUMBER[tile.need]
      const g = this.add.graphics()
      g.lineStyle(4, color, lit ? 1 : 0.55)
      g.strokeCircle(0, 0, size * 0.3)
      g.fillStyle(lit ? color : 0x08222f, lit ? 0.9 : 1)
      g.fillCircle(0, 0, size * 0.22)
      if (lit) {
        g.fillStyle(0xffffff, 0.9)
        g.fillCircle(0, 0, size * 0.07)
      }
      box.add(g)
      if (lit) {
        const glow = this.add.image(0, 0, 'glow').setTint(color).setBlendMode('ADD').setScale(size / 70).setAlpha(0.65)
        box.add(glow)
        this.tweens.add({ targets: glow, alpha: 0.25, scale: size / 90, duration: 900, yoyo: true, repeat: -1 })
        box.add(this.add.text(0, size * 0.34, COLOR_NAMES[tile.need], 10, COLOR_HEX[tile.need]).setOrigin(0.5))
      } else if (wrong) {
        box.add(this.add.text(0, size * 0.34, 'wrong tint', 10, '#fca5a5').setOrigin(0.5))
      }
    }

    if (tile.kind === 'lighthouse') {
      const g = this.add.graphics()
      const towerW = size * 0.3
      g.fillStyle(0xdfe7ef, 1)
      g.fillTriangle(-towerW, size * 0.34, towerW, size * 0.34, towerW * 0.6, -size * 0.06)
      g.fillStyle(0xef4444, 1)
      g.fillRect(-towerW * 0.78, size * 0.16, towerW * 0.62, size * 0.08)
      g.fillRect(-towerW * 0.62, -size * 0.02, towerW * 0.5, size * 0.07)
      g.fillStyle(0x0f172a, 1)
      g.fillRoundedRect(-towerW * 0.78, -size * 0.16, towerW * 1.56, size * 0.12, 3)
      g.fillStyle(0xfde68a, 1)
      g.fillCircle(0, -size * 0.2, size * 0.1)
      box.add(g)

      const lamp = this.add.image(0, -size * 0.2, 'glow').setTint(0xfde68a).setBlendMode('ADD').setScale(size / 95).setAlpha(0.8)
      box.add(lamp)
      this.tweens.add({ targets: lamp, alpha: 0.4, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.InOut' })

      const arrow = this.add.triangle(0, 0, 0, -7, 12, 0, 0, 7, this.chapter.accent)
      arrow.setPosition(0, -size * 0.2)
      arrow.setAngle(ARROWS[tile.dir] ?? 0)
      box.add(arrow)
    }

    return box
  }

  renderBeams() {
    const g = this.beams
    g.clear()
    const glow = new Set()

    for (const beam of this.result.beams) {
      const path = beam.path
      for (let i = 0; i < path.length - 1; i += 1) {
        const from = path[i]
        const to = path[i + 1]
        const a = this.centre(from.r, from.c)
        const b = this.centre(to.r, to.c)
        const color = COLOR_NUMBER[from.color]
        g.lineStyle(this.cell * 0.72, color, 0.07)
        g.lineBetween(a.x, a.y, b.x, b.y)
        g.lineStyle(this.cell * 0.32, color, 0.2)
        g.lineBetween(a.x, a.y, b.x, b.y)
        g.lineStyle(this.cell * 0.11, color, 0.92)
        g.lineBetween(a.x, a.y, b.x, b.y)
        glow.add(`${from.r}:${from.c}:${from.color}`)
      }
      const source = this.centre(beam.source.r, beam.source.c)
      g.fillStyle(0xffffff, 0.5)
      g.fillCircle(source.x, source.y - this.cell * 0.2, this.cell * 0.12)
    }

    this.glowKeys = glow
  }

  refreshHud() {
    const progress = progressOf(this.board, this.result)
    this.actionsText.setText(`Actions ${this.actions} · par ${this.board.par}`)
    this.buoyText.setText(`Buoys ${progress.lit}/${progress.total}`)
    if (progress.violations) {
      this.reefText.setText('⚠ reef lit').setAlpha(1)
    } else {
      this.reefText.setAlpha(0)
    }
  }

  // ---------- input ----------

  cellAt(pointer) {
    const c = Math.floor((pointer.x - this.ox) / this.cell)
    const r = Math.floor((pointer.y - this.oy) / this.cell)
    if (r < 0 || c < 0 || r >= this.board.rows || c >= this.board.cols) return null
    return { r, c }
  }

  onDown(pointer) {
    if (this.over) return
    this.pick = this.cellAt(pointer)
  }

  onUp(pointer) {
    const from = this.pick
    this.pick = null
    if (this.over || !from) return
    const to = this.cellAt(pointer)
    if (!to) return

    const tile = tileAt(this.board, from.r, from.c)
    if (!tile) return

    if (to.r !== from.r || to.c !== from.c) {
      if (tile.kind === 'mirror' && isOpenWater(this.board, to.r, to.c)) {
        moveTile(this.board, from, to)
        this.actions += 1
        sfx.move()
        this.afterAction()
      }
      return
    }

    if (tile.kind === 'lighthouse') {
      rotateTile(this.board, from.r, from.c)
      this.actions += 1
      sfx.rotate()
    } else if (tile.kind === 'mirror') {
      flipTile(this.board, from.r, from.c)
      this.actions += 1
      sfx.mirror()
    } else if (tile.kind === 'lens') {
      cycleTile(this.board, from.r, from.c)
      this.actions += 1
      sfx.lens(LENS_CYCLE.indexOf(tile.color))
    } else {
      sfx.click()
      return
    }
    this.afterAction()
  }

  afterAction() {
    const previousLit = this.lastLit
    this.result = trace(this.board)
    const newlyLit = []
    for (const buoy of this.board.buoys) {
      const key = `${buoy.r}:${buoy.c}`
      if (buoyLit(this.result, buoy) && !previousLit.has(key)) newlyLit.push(buoy)
    }
    this.lastLit = new Set(this.board.buoys.filter((buoy) => buoyLit(this.result, buoy)).map((b) => `${b.r}:${b.c}`))

    this.renderBeams()
    this.renderTiles()
    this.refreshHud()

    for (const buoy of newlyLit) {
      const { x, y } = this.centre(buoy.r, buoy.c)
      sparkle(this, x, y, COLOR_NUMBER[buoy.need], 8)
      ring(this, x, y, COLOR_NUMBER[buoy.need], this.cell * 0.8)
    }
    if (newlyLit.length) sfx.buoy()

    const violating = this.result.violations.size > 0
    if (violating && !this.wasViolating) {
      sfx.reef()
      this.cameras.main.shake(140, 0.003)
      for (const key of this.result.violations) {
        const [r, c] = key.split(':').map(Number)
        const { x, y } = this.centre(r, c)
        flashAt(this, x, y, this.cell, 0xef4444)
      }
    }
    this.wasViolating = violating

    if (this.board.buoys.some((buoy) => buoyWrongColour(this.result, buoy))) sfx.wrongColour()
    if (isSolved(this.board, this.result)) this.finish()
  }

  useHint() {
    if (this.over) return
    const moved = this.board.tiles.flat().find((tile) => tile.kind === 'mirror' && tile.movedFrom)
    if (moved) {
      const from = { r: moved.r, c: moved.c }
      moveTile(this.board, from, moved.movedFrom)
      this.hintsUsed += 1
      sfx.hint()
      popText(this, this.centre(moved.movedFrom.r, moved.movedFrom.c).x, this.centre(moved.movedFrom.r, moved.movedFrom.c).y, 'back here', '#fde047', 16)
      this.afterAction()
      return
    }

    const tile = nextFix(this.board)
    if (!tile) return
    this.hintsUsed += 1
    applyHint(this.board, tile)
    sfx.hint()
    const { x, y } = this.centre(tile.r, tile.c)
    flashAt(this, x, y, this.cell, 0xfde047)
    popText(this, x, y, 'fixed', '#fde047', 16)
    this.afterAction()
  }

  resetBoard() {
    if (this.over) return
    resetBoard(this.board)
    this.actions = 0
    this.hintsUsed = 0
    this.lastLit = new Set()
    this.wasViolating = false
    sfx.click()
    this.afterAction()
  }

  toggleSound() {
    audioState.muted = !audioState.muted
    data.muted = audioState.muted
    persist()
    this.soundButton.setLabel(audioState.muted ? 'Sound off' : 'Sound on')
    if (!audioState.muted) sfx.click()
  }

  leave() {
    const index = CHAPTERS.findIndex((chapter) => chapter.id === this.level.chapter)
    fade(this, 'levels', { chapter: Math.max(0, index) })
  }

  // ---------- completion ----------

  finish() {
    if (this.over) return
    this.over = true
    const stars = starsFor({ actions: this.actions, hints: this.hintsUsed, par: this.board.par })
    recordSolve(this.level.id, stars)

    const index = LEVELS.indexOf(this.level) + 1
    if (index === data.unlocked && index < LEVELS.length) {
      data.unlocked = index + 1
      persist()
    }

    sfx.win()
    for (let i = 0; i < 5; i += 1) {
      this.time.delayedCall(i * 110, () =>
        confetti(this, Phaser.Math.Between(80, W - 80), Phaser.Math.Between(200, 460), this.chapter.accent, 9, 280),
      )
    }
    this.time.delayedCall(420, () => this.overlay(stars))
  }

  overlay(stars) {
    const layer = this.add.container(0, 0).setDepth(70)
    const dim = this.add.rectangle(W / 2, H / 2, W, H, 0x01070c, 0.9)
    const card = this.add.rectangle(W / 2, H / 2, 400, 520, 0x08222f, 1).setStrokeStyle(2, this.chapter.accent, 0.55)
    layer.add([dim, card])

    layer.add(text(this, W / 2, H / 2 - 186, 'Station lit', 15, '#7dd3fc', { fontStyle: 'bold' }).setOrigin(0.5))
    layer.add(text(this, W / 2, H / 2 - 146, this.level.name, 30, '#e0f2fe', { fontStyle: 'bold' }).setOrigin(0.5))

    for (let i = 0; i < 3; i += 1) {
      const star = text(this, W / 2 + (i - 1) * 54, H / 2 - 62, '★', 42, i < stars ? '#fde047' : '#14384a', {
        fontStyle: 'bold',
      })
        .setOrigin(0.5)
        .setScale(0)
      layer.add(star)
      this.tweens.add({ targets: star, scale: i < stars ? 1 : 0.8, duration: 240, delay: 220 + i * 120, ease: 'Back.Out' })
    }

    const detail =
      this.hintsUsed > 0
        ? `${this.actions} actions · ${this.hintsUsed} hint${this.hintsUsed === 1 ? '' : 's'}`
        : `${this.actions} actions · par ${this.board.par}`
    layer.add(text(this, W / 2, H / 2 + 10, detail, 15, '#93c5fd').setOrigin(0.5))

    const next = LEVELS[LEVELS.indexOf(this.level) + 1]
    if (next) {
      button(this, W / 2, H / 2 + 82, `Next: ${next.name}`, () => this.scene.restart({ level: next.id }), {
        w: 308,
        h: 50,
        size: 17,
        color: 0x0284c7,
      }).setDepth(80)
    }
    button(this, W / 2, H / 2 + (next ? 138 : 82), 'Replay', () => this.scene.restart({ level: this.level.id }), {
      w: 308,
      h: 44,
      size: 15,
      color: 0x0f3b52,
    }).setDepth(80)
    button(this, W / 2, H / 2 + (next ? 186 : 130), 'All coasts', () => this.leave(), {
      w: 308,
      h: 44,
      size: 15,
      color: 0x0f3b52,
    }).setDepth(80)
    // Quiet support link: results panel only, under the actions inside the card.
    button(this, W / 2, H / 2 + 232, '☕ Buy me a coffee', () => openTipJar(), {
      w: 308,
      h: 30,
      size: 14,
      color: 0x0b3340,
      textColor: '#7dd3fc',
    }).setDepth(80)
  }
}
