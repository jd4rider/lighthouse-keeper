let ctx = null
export const audioState = { muted: false }

function audio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return null
    ctx = new AC()
  }
  if (ctx.state === 'suspended') ctx.resume()
  return ctx
}

function tone(freq, { type = 'sine', dur = 0.2, gain = 0.12, delay = 0 } = {}) {
  if (audioState.muted || !Number.isFinite(freq)) return
  const a = audio()
  if (!a) return
  const t = a.currentTime + delay
  const osc = a.createOscillator()
  const amp = a.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t)
  amp.gain.setValueAtTime(0.0001, t)
  amp.gain.exponentialRampToValueAtTime(gain, t + 0.02)
  amp.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  osc.connect(amp).connect(a.destination)
  osc.start(t)
  osc.stop(t + dur + 0.02)
}

function noise({ dur = 0.5, gain = 0.14, freq = 700, delay = 0 } = {}) {
  if (audioState.muted) return
  const a = audio()
  if (!a) return
  const t = a.currentTime + delay
  const buf = a.createBuffer(1, Math.floor(a.sampleRate * dur), a.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length) ** 2
  const src = a.createBufferSource()
  src.buffer = buf
  const filter = a.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.setValueAtTime(freq * 3, t)
  filter.frequency.exponentialRampToValueAtTime(freq, t + dur)
  const amp = a.createGain()
  amp.gain.value = gain
  src.connect(filter).connect(amp).connect(a.destination)
  src.start(t)
}

export const sfx = {
  click: () => tone(520, { type: 'triangle', dur: 0.06, gain: 0.05 }),
  rotate: () => {
    tone(300, { type: 'triangle', dur: 0.08, gain: 0.06 })
    tone(420, { type: 'triangle', dur: 0.07, gain: 0.04, delay: 0.05 })
  },
  mirror: () => {
    tone(880, { type: 'triangle', dur: 0.07, gain: 0.05 })
    tone(1180, { type: 'sine', dur: 0.09, gain: 0.03, delay: 0.04 })
  },
  lens: (index = 0) => tone(523.25 * 2 ** ((index * 4) / 12), { type: 'sine', dur: 0.14, gain: 0.06 }),
  move: () => noise({ dur: 0.18, gain: 0.05, freq: 900 }),
  buoy: () => [12, 19].forEach((step, i) => tone(659.25 * 2 ** (step / 12), { dur: 0.18, gain: 0.06, delay: i * 0.09 })),
  wrongColour: () => {
    tone(220, { type: 'sawtooth', dur: 0.14, gain: 0.04 })
    tone(180, { type: 'sawtooth', dur: 0.16, gain: 0.04, delay: 0.08 })
  },
  reef: () => {
    noise({ dur: 0.4, gain: 0.1, freq: 260 })
    tone(90, { type: 'square', dur: 0.3, gain: 0.08 })
  },
  hint: () => [0, 4, 7].forEach((step, i) => tone(587.33 * 2 ** (step / 12), { type: 'triangle', dur: 0.14, delay: i * 0.06 })),
  win: () => {
    noise({ dur: 0.6, gain: 0.06, freq: 1200 })
    ;[0, 4, 7, 12, 16].forEach((step, i) => tone(523.25 * 2 ** (step / 12), { dur: 0.4, delay: i * 0.1 }))
  },
  foghorn: () => {
    tone(98, { type: 'sine', dur: 1.1, gain: 0.09 })
    tone(147, { type: 'sine', dur: 0.9, gain: 0.05, delay: 0.05 })
  },
}
