import Phaser from 'phaser'

export const W = 640
export const H = 860
export const FONT = 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif'

function canvas(scene, key, w, h, draw) {
  if (scene.textures.exists(key)) return
  const t = scene.textures.createCanvas(key, w, h)
  draw(t.getContext(), w, h)
  t.refresh()
}

export function makeTextures(scene) {
  canvas(scene, 'spark', 16, 16, (ctx) => {
    ctx.fillStyle = '#fff'
    ctx.beginPath()
    ctx.arc(8, 8, 8, 0, Math.PI * 2)
    ctx.fill()
  })
  canvas(scene, 'glow', 128, 128, (ctx) => {
    const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64)
    grad.addColorStop(0, 'rgba(255,255,255,1)')
    grad.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, 128, 128)
  })
}

// Night sky, sea haze and a scatter of stars.
export function background(scene, [top, bottom], accent = 0x7dd3fc) {
  const key = `bg${top}${bottom}`
  canvas(scene, key, 64, H, (ctx) => {
    const grad = ctx.createLinearGradient(0, 0, 0, H)
    grad.addColorStop(0, top)
    grad.addColorStop(0.62, bottom)
    grad.addColorStop(1, '#01070c')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, 64, H)
  })
  scene.add.image(W / 2, H / 2, key).setDisplaySize(W, H).setDepth(-100)

  const stars = scene.add.graphics().setDepth(-95)
  for (let i = 0; i < 90; i += 1) {
    const x = Phaser.Math.Between(0, W)
    const y = Phaser.Math.Between(0, H * 0.55)
    const size = Phaser.Math.FloatBetween(0.7, 1.9)
    stars.fillStyle(0xffffff, Phaser.Math.FloatBetween(0.15, 0.75))
    stars.fillCircle(x, y, size)
  }
  scene.tweens.add({ targets: stars, alpha: 0.55, duration: 3200, yoyo: true, repeat: -1, ease: 'Sine.InOut' })

  // Moonlight on the water.
  const moon = scene.add.circle(W - 92, 74, 22, 0xf8fafc, 0.9).setDepth(-94)
  scene.add.circle(W - 100, 68, 20, top, 1).setDepth(-93)
  scene.tweens.add({ targets: moon, alpha: 0.7, duration: 2600, yoyo: true, repeat: -1, ease: 'Sine.InOut' })

  scene.add
    .particles(0, 0, 'spark', {
      x: { min: 0, max: W },
      y: { min: H * 0.55, max: H },
      speedY: { min: -16, max: -4 },
      speedX: { min: -6, max: 6 },
      lifespan: 9000,
      scale: { start: 0.2, end: 0 },
      alpha: { start: 0.14, end: 0 },
      frequency: 420,
      tint: accent,
    })
    .setDepth(-90)
}

export function button(scene, x, y, label, fn, { w = 200, h = 54, size = 22, color = 0x0ea5e9, textColor = '#fff' } = {}) {
  const box = scene.add.container(x, y)
  const bg = scene.add.graphics()
  const draw = (fill, alpha) => {
    bg.clear()
    bg.fillStyle(fill, alpha).fillRoundedRect(-w / 2, -h / 2, w, h, 14)
    bg.lineStyle(2, 0xffffff, 0.26).strokeRoundedRect(-w / 2, -h / 2, w, h, 14)
  }
  draw(color, 0.94)
  const t = scene.add
    .text(0, 0, label, { fontFamily: FONT, fontSize: `${size}px`, fontStyle: 'bold', color: textColor })
    .setOrigin(0.5)
  box.add([bg, t])
  box.setSize(w, h).setInteractive({ useHandCursor: true })
  box.on('pointerover', () => draw(color, 1))
  box.on('pointerout', () => draw(color, 0.94))
  box.on('pointerdown', () => {
    scene.tweens.add({ targets: box, scale: 0.94, duration: 70, yoyo: true })
    fn()
  })
  box.setLabel = (s) => t.setText(s)
  return box
}

export const text = (scene, x, y, str, size = 22, color = '#fff', extra = {}) =>
  scene.add.text(x, y, str, { fontFamily: FONT, fontSize: `${size}px`, color, ...extra })

export function fade(scene, to, payload) {
  scene.input.enabled = false
  scene.cameras.main.fadeOut(200, 2, 10, 18)
  scene.cameras.main.once('camerafadeoutcomplete', () => scene.scene.start(to, payload))
}

export const hint = (scene, x, y, str, size = 15, color = '#93c5fd') =>
  text(scene, x, y, str, size, color).setOrigin(0.5)
