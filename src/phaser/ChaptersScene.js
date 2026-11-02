import Phaser from 'phaser'
import { W, background, button, text, fade, hint } from './common.js'
import { bestStars, starTotal } from './save.js'
import { CHAPTERS, LEVELS } from '../levels.js'

export default class ChaptersScene extends Phaser.Scene {
  constructor() {
    super('chapters')
  }

  create() {
    background(this, ['#0b2a3d', '#04121d'])
    this.cameras.main.fadeIn(220, 2, 10, 18)

    text(this, W / 2, 66, 'Choose a coast', 34, '#e0f2fe', { fontStyle: 'bold' }).setOrigin(0.5)
    text(this, W / 2, 106, `${starTotal()} ★ earned so far`, 15, '#7dd3fc').setOrigin(0.5)
    button(this, 62, 34, '◀ Menu', () => fade(this, 'menu'), { w: 104, h: 38, size: 14, color: 0x0f3b52 })

    CHAPTERS.forEach((chapter, i) => {
      const levels = LEVELS.filter((level) => level.chapter === chapter.id)
      const done = levels.filter((level) => bestStars(level.id) > 0).length
      const stars = levels.reduce((sum, level) => sum + bestStars(level.id), 0)
      const y = 186 + i * 134
      const x = W / 2

      const card = this.add.container(x, y)
      const bg = this.add.graphics()
      bg.fillStyle(0x0d2b3f, 0.95).fillRoundedRect(-256, -52, 512, 108, 18)
      bg.lineStyle(2, chapter.accent, 0.5).strokeRoundedRect(-256, -52, 512, 108, 18)
      bg.fillStyle(chapter.accent, 0.16).fillRoundedRect(-256, -52, 6, 108, 3)
      card.add(bg)

      card.add(text(this, -232, -34, chapter.name, 23, '#e0f2fe', { fontStyle: 'bold' }))
      card.add(text(this, -232, -6, chapter.blurb, 14, '#93c5fd'))
      card.add(text(this, -232, 20, `${done}/${levels.length} lit · ${stars}/${levels.length * 3} ★`, 13, '#7dd3fc'))

      const barWidth = 190
      const bar = this.add.graphics()
      bar.fillStyle(0x04202e, 1).fillRoundedRect(24, 24, barWidth, 8, 4)
      bar.fillStyle(chapter.accent, 1).fillRoundedRect(24, 24, (barWidth * done) / levels.length, 8, 4)
      card.add(bar)

      const label = this.add
        .text(214, 0, '→', 30, '#e0f2fe')
        .setOrigin(0.5)
        .setAlpha(0.6)
      card.add(label)

      card.setSize(512, 108).setInteractive({ useHandCursor: true })
      card.on('pointerover', () => this.tweens.add({ targets: card, scale: 1.015, duration: 120 }))
      card.on('pointerout', () => this.tweens.add({ targets: card, scale: 1, duration: 120 }))
      card.on('pointerdown', () => {
        this.tweens.add({ targets: card, scale: 0.97, duration: 70, yoyo: true })
        fade(this, 'levels', { chapter: i })
      })
    })

    hint(this, W / 2, 790, 'Stations unlock in order — one tidy solve lights the next.', 14, '#7dd3fc')
  }
}
