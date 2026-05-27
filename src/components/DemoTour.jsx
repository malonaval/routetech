import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import DEMO_STEPS from '../utils/demoSteps'

const TOOLTIP_W  = 280   // px — matches CSS
const TARGET_PAD = 8     // px padding around spotlight target
const GAP        = 12    // px gap between spotlight edge and tooltip

function computePositions(el, position) {
  const rect = el.getBoundingClientRect()
  const sr = {
    top:    rect.top    - TARGET_PAD,
    left:   rect.left   - TARGET_PAD,
    width:  rect.width  + TARGET_PAD * 2,
    height: rect.height + TARGET_PAD * 2,
  }

  // Estimate tooltip height before paint — refined after first render
  const tooltipH = 180
  const vw = window.innerWidth
  const vh = window.innerHeight
  let tp = { top: 0, left: 0 }

  if (position === 'top')    tp = { top: sr.top - tooltipH - GAP,             left: sr.left + sr.width / 2 - TOOLTIP_W / 2 }
  if (position === 'bottom') tp = { top: sr.top + sr.height + GAP,            left: sr.left + sr.width / 2 - TOOLTIP_W / 2 }
  if (position === 'left')   tp = { top: sr.top + sr.height / 2 - tooltipH / 2, left: sr.left - TOOLTIP_W - GAP }
  if (position === 'right')  tp = { top: sr.top + sr.height / 2 - tooltipH / 2, left: sr.left + sr.width + GAP }

  // Clamp to viewport
  tp.top  = Math.max(16, Math.min(tp.top,  vh - tooltipH - 16))
  tp.left = Math.max(16, Math.min(tp.left, vw - TOOLTIP_W - 16))

  return { spotlight: sr, tooltip: tp }
}

export default function DemoTour({ step, onNext, onPrev, onClose }) {
  const [spotStyle,   setSpotStyle]   = useState(null)
  const [tipStyle,    setTipStyle]    = useState(null)
  const [tipVisible,  setTipVisible]  = useState(false)
  const tooltipRef = useRef(null)

  const current   = DEMO_STEPS[step]
  const isWelcome = !current?.selector
  const isFirst   = step === 0
  const isLast    = step === DEMO_STEPS.length - 1
  const total     = DEMO_STEPS.length - 1  // exclude welcome step from counter

  useEffect(() => {
    if (step == null || !current) return
    setTipVisible(false)

    if (isWelcome) {
      setSpotStyle(null)
      setTipStyle({ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' })
      setTipVisible(true)
      return
    }

    const el = document.querySelector(current.selector)
    if (!el) {
      // Element not in DOM — centered fallback
      setSpotStyle(null)
      setTipStyle({ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' })
      setTipVisible(true)
      return
    }

    const { spotlight, tooltip } = computePositions(el, current.position)
    setSpotStyle(spotlight)
    setTipStyle({ position: 'fixed', top: tooltip.top, left: tooltip.left })
    setTipVisible(true)
  }, [step, current, isWelcome])

  // Refine tooltip position after it renders (real height known)
  useEffect(() => {
    if (!tipVisible || isWelcome || !spotStyle) return
    const el = document.querySelector(current?.selector)
    if (!el || !tooltipRef.current) return
    const { tooltip } = computePositions(el, current.position)
    const actualH = tooltipRef.current.offsetHeight
    const vw = window.innerWidth
    const vh = window.innerHeight
    let { top, left } = tooltip
    if (current.position === 'top')  top = spotStyle.top - actualH - GAP
    if (current.position === 'left') top = spotStyle.top + spotStyle.height / 2 - actualH / 2
    if (current.position === 'right') top = spotStyle.top + spotStyle.height / 2 - actualH / 2
    top  = Math.max(16, Math.min(top,  vh - actualH - 16))
    left = Math.max(16, Math.min(left, vw - TOOLTIP_W - 16))
    setTipStyle({ position: 'fixed', top, left })
  }, [tipVisible, isWelcome, spotStyle, current])

  if (step == null || !current) return null

  return createPortal(
    <>
      {/* Overlay — blocks interaction with the rest of the UI */}
      <div className="demo-overlay" />

      {/* Spotlight — only when targeting a specific element */}
      {spotStyle && (
        <div
          className="demo-spotlight"
          style={{
            top:    spotStyle.top,
            left:   spotStyle.left,
            width:  spotStyle.width,
            height: spotStyle.height,
          }}
        />
      )}

      {/* Tooltip / welcome modal */}
      {tipStyle && (
        <div
          ref={tooltipRef}
          className={`demo-tooltip${isWelcome ? ' demo-welcome-modal' : ''}`}
          style={tipStyle}
          onClick={e => e.stopPropagation()}
        >
          {!isWelcome && (
            <div className="demo-tooltip-step">{step} / {total}</div>
          )}
          <div className="demo-tooltip-title">{current.title}</div>
          <div className="demo-tooltip-body">{current.body}</div>
          <div className="demo-tooltip-actions">
            {!isFirst && (
              <button className="demo-btn-prev" onClick={onPrev}>← Anterior</button>
            )}
            <button className="demo-btn-next" onClick={isLast ? onClose : onNext}>
              {isLast ? 'Finalizar' : isWelcome ? 'Empezar →' : 'Siguiente →'}
            </button>
            {!isLast && !isWelcome && (
              <button className="demo-btn-skip" onClick={onClose}>✕ Saltar</button>
            )}
          </div>
        </div>
      )}
    </>,
    document.body
  )
}
