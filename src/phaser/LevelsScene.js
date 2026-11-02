import Phaser from 'phaser'
import { W, background, button, text, fade, hint } from './common.js'
import { data, bestStars } from './save.js'
import { CHAPTERS, LEVELS } from '../levels.js'

export default class LevelsScene extends Phaser.Scene {
  constructor() {
    super('levels')
  }

  init(payload = {}) {
    const next = LEVELS[Math.min(LEVELS.length - 1, Math.max(0, data.unlocked - 1))]
    const fallback = CHAPTERS.findIndex((chapter) => chapter.id === next.chapter)
    this.chapterIndex = Phaser.Math.Clamp(payload.chapter ?? Math.max(0, fallback), 0, CHAPTERS.length - 1)
  }

  create() {
    const chapter = CHAPTERS[this.chapterIndex]
    background(this, chapter.bg, chapter.accent)
    this.cameras.main.fadeIn(220, 2, 10, 18)

    text(this, W / 2, 58, chapter.name, 34, '#e0f2fe', { fontStyle: 'bold' }).setOrigin(0.5)
    text(this, W / 2, 96, chapter.blurb, 15, '#93c5fd').setOrigin(0.5)
    button(this, 62, 34, '◀ Coasts', () => fade(this, 'chapters'), { w: 104, h: 38, size: 14, color: 0x0f3b52 })

    const levels = LEVELS.filter((level) => level.chapter === chapter.id)
    const cols = 2
    const cardW = 256
    const cardH = 152
    const gapX = 20
    const gapY = 18
    const left = (W - (cols * cardW + gapX)) / 2
    const top = 142

    levels.forEach((level, i) => {
      const index = LEVELS.indexOf(level) + 1
      const open = index <= data.unlocked
      const x = left + (i % cols) * (cardW + gapX) + cardW / 2
      const y = top + Math.floor(i / cols) * (cardH + gapY) + cardH / 2
      this.card(level, index, open, x, y, cardW, cardH, chapter)
    })

    const go = (delta) => this.scene.restart({ chapter: this.chapterIndex + delta })
    if (this.chapterIndex > 0) button(this, 90, 800, '◀ Prev', () => go(-1), { w: 136, h: 44, size: 15, color: 0x0e3a50 })
    if (this.chapterIndex < CHAPTERS.length - 1) {
      button(this, W - 90, 800, 'Next ▶', () => go(1), { w: 136, h: 44, size: 15, color: 0x0e3a50 })
    }
    const nextLevel = LEVELS[data.unlocked - 1]
    hint(this, W / 2, 800, nextLevel ? `Next station: ${nextLevel.name}` : 'Every station is lit — well kept!', 14, '#7dd3fc')
  }

  card(level, index, open, x, y, w, h, chapter) {
    const card = this.add.container(x, y)
    const bg = this.add.graphics()
    bg.fillStyle(open ? 0x0d2b3f : 0x081c28, 0.96).fillRoundedRect(-w / 2, -h / 2, w, h, 18)
    bg.lineStyle(2, open ? chapter.accent : 0x1b3a4d, open ? 0.5 : 0.6).strokeRoundedRect(-w / 2, -h / 2, w, h, 18)
    card.add(bg)

    card.add(text(this, -w / 2 + 16, -h / 2 + 14, level.name, 19, open ? '#e0f2fe' : '#4a7288', { fontStyle: 'bold' }))
    card.add(text(this, -w / 2 + 16, -h / 2 + 42, `Station ${index}`, 13, open ? '#7dd3fc' : '#3d6073'))

    if (!open) {
      card.add(text(this, w / 2 - 26, -h / 2 + 26, '🔒', 20).setOrigin(0.5))
      card.add(text(this, -w / 2 + 16, h / 2 - 32, 'Light the station before it', 12, '#3d6073'))
      return
    }

    const stars = bestStars(level.id)
    for (let s = 0; s < 3; s += 1) {
      card.add(text(this, -w / 2 + 20 + s * 26, h / 2 - 38, '★', 23, s < stars ? '#fde047' : '#00000055'))
    }

    const preview = this.add.graphics()
    const tile = 10
    const cols = level.art[0].length
    const offX = w / 2 - (cols * tile) / 2 - 14
    const offY = -2
    level.art.forEach((line, r) => {
      ;[...line].forEach((ch, c) => {
        if (ch === '.') return
        const color = ch === '#' ? 0x1f3b4d : ch === 'x' ? 0xef4444 : ch === 'W' || ch === 'R' || ch === 'G' || ch === 'B' ? 0xfde68a : 0x7dd3fc
        preview.fillStyle(color, 0.6).fillRect(offX + c * tile, offY + r * tile, tile - 2, tile - 2)
      })
    })
    card.add(preview)

    card.setSize(w, h).setInteractive({ useHandCursor: true })
    card.on('pointerdown', () => {
      this.tweens.add({ targets: card, scale: 0.96, duration: 70, yoyo: true })
      fade(this, 'game', { level: level.id })
    })
    if (index === data.unlocked) {
      this.tweens.add({ targets: card, scale: 1.02, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.InOut' })
    }
  }
}
