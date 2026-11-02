import Phaser from 'phaser'
import { W, H, background, button, text, fade, hint } from './common.js'
import { data, starTotal } from './save.js'
import { LEVELS } from '../levels.js'
import { sfx } from '../sound.js'

const RULES = [
  'Every lighthouse shines one beam in the direction it faces.',
  'Tap a lighthouse to turn it a quarter turn.',
  'Tap a mirror to flip it, or drag it onto open water.',
  'Tap a lens to cycle its colour: red, green, blue.',
  'Light every buoy with the colour it asks for —',
  'white buoys need an untinted beam.',
  'Never let a beam reach a red reef marker.',
]

export default class MenuScene extends Phaser.Scene {
  constructor() {
    super('menu')
  }

  create() {
    background(this, ['#0b2a3d', '#04121d'])
    this.cameras.main.fadeIn(260, 2, 10, 18)

    this.beacon(430)

    const title = text(this, W / 2, 214, 'Lighthouse Keeper', 54, '#e0f2fe', {
      fontStyle: 'bold',
      stroke: '#04121d',
      strokeThickness: 8,
    }).setOrigin(0.5)
    this.tweens.add({ targets: title, alpha: 0.92, duration: 2200, yoyo: true, repeat: -1, ease: 'Sine.InOut' })
    text(this, W / 2, 262, 'Turn the lights. Keep the reef dark.', 19, '#7dd3fc').setOrigin(0.5)

    const done = Object.keys(data.stars).length
    text(this, W / 2, 300, `${done}/${LEVELS.length} stations lit · ${starTotal()} ★`, 16, '#93c5fd').setOrigin(0.5)

    button(this, W / 2, 376, '▶  Take the watch', () => fade(this, 'chapters'), {
      w: 380,
      h: 60,
      size: 25,
      color: 0x0284c7,
    })
    button(this, W / 2, 448, 'How to play', () => this.rules(), { w: 380, h: 46, size: 18, color: 0x0f3b52 })

    hint(this, W / 2, H - 58, '24 stations across four coasts · three stars for a tidy solve', 14, '#7dd3fc')
    hint(this, W / 2, H - 34, 'A Freebuff game · play in the browser or on the desktop', 13, '#4f7d94')

    sfx.foghorn()
  }

  beacon(baseY) {
    const g = this.add.graphics()
    const cx = W / 2
    g.fillStyle(0x0b1c2b, 1)
    g.fillRoundedRect(cx - 120, baseY + 30, 240, 26, 10)
    g.fillStyle(0xe2e8f0, 1)
    g.fillTriangle(cx - 34, baseY + 34, cx + 34, baseY + 34, cx + 20, baseY - 44)
    g.fillStyle(0xf87171, 1)
    g.fillRect(cx - 27, baseY + 4, 54, 12)
    g.fillRect(cx - 22, baseY - 22, 44, 11)
    g.fillStyle(0x0f172a, 1)
    g.fillRect(cx - 26, baseY - 48, 52, 8)
    g.fillStyle(0xfde68a, 1)
    g.fillCircle(cx, baseY - 54, 11)

    const glow = this.add.image(cx, baseY - 54, 'glow').setTint(0xfde68a).setBlendMode('ADD').setScale(0.9).setAlpha(0.55)
    this.tweens.add({ targets: glow, alpha: 0.25, duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.InOut' })

    const sweep = this.add.container(cx, baseY - 54)
    const outer = this.add.triangle(0, 0, 0, 0, 330, -52, 330, 52, 0xfde68a, 0.16).setOrigin(0, 0.5)
    const inner = this.add.triangle(0, 0, 0, 0, 300, -20, 300, 20, 0xfef3c7, 0.3).setOrigin(0, 0.5)
    sweep.add([outer, inner])
    sweep.setBlendMode(Phaser.BlendModes.ADD)
    this.tweens.add({ targets: sweep, angle: 360, duration: 9000, repeat: -1, ease: 'Linear' })

    const sea = this.add.graphics().setDepth(3)
    for (let i = 0; i < 5; i += 1) {
      sea.lineStyle(2, 0x7dd3fc, 0.12)
      const y = baseY + 62 + i * 13
      sea.beginPath()
      sea.moveTo(60 + i * 14, y)
      for (let x = 60; x < W - 40; x += 40) sea.lineTo(x + (i % 2 ? 18 : 0), y + (i % 2 ? 2 : -2))
      sea.strokePath()
    }
  }

  rules() {
    if (this.rulesCard) {
      this.rulesCard.destroy()
      this.rulesCard = null
      return
    }
    const layer = this.add.container(0, 0).setDepth(60)
    const dim = this.add.rectangle(W / 2, H / 2, W, H, 0x01070c, 0.9).setInteractive()
    dim.on('pointerdown', () => {
      layer.destroy()
      this.rulesCard = null
    })
    const card = this.add.rectangle(W / 2, H / 2, 548, 486, 0x0b2334, 1).setStrokeStyle(2, 0x7dd3fc, 0.45)
    layer.add([dim, card])
    layer.add(text(this, W / 2, H / 2 - 196, 'How to play', 28, '#e0f2fe', { fontStyle: 'bold' }).setOrigin(0.5))
    RULES.forEach((line, i) => {
      layer.add(text(this, W / 2, H / 2 - 140 + i * 40, line, 16, i === RULES.length - 1 ? '#fca5a5' : '#bae6fd', {
        align: 'center',
        wordWrap: { width: 480 },
      }).setOrigin(0.5))
    })
    layer.add(text(this, W / 2, H / 2 + 196, 'Tap anywhere to close', 14, '#7dd3fc').setOrigin(0.5))
    sfx.click()
    this.rulesCard = layer
  }
}
