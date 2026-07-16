import { createClient } from '@supabase/supabase-js'
import './style.css'
import { ROUND_COUNT, createRound, scoreForElapsedMs } from './gameLogic'

const app = document.querySelector('#app')
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

const state = {
  email: '',
  password: '',
  statusMessage: '',
  currentRound: createRound(),
  roundStartedAt: Date.now(),
  roundNumber: 1,
  totalScore: 0,
  gameFinished: false,
  lastAnswerSummary: '',
  leaderboard: [],
  session: null,
}

const supabase =
  SUPABASE_URL && SUPABASE_ANON_KEY ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function graphToSvg(graph, label) {
  const count = graph.length
  const safeLabel = escapeHtml(label)
  const points = Array.from({ length: count }, (_, index) => {
    const angle = (2 * Math.PI * index) / count - Math.PI / 2
    return {
      x: 80 + 60 * Math.cos(angle),
      y: 80 + 60 * Math.sin(angle),
    }
  })

  const edges = []
  for (let i = 0; i < count; i += 1) {
    for (let j = i + 1; j < count; j += 1) {
      if (graph[i][j]) {
        edges.push(
          `<line x1="${points[i].x}" y1="${points[i].y}" x2="${points[j].x}" y2="${points[j].y}" />`,
        )
      }
    }
  }

  const nodes = points.map(
    (point, index) => `
      <g>
        <circle cx="${point.x}" cy="${point.y}" r="15"></circle>
        <text x="${point.x}" y="${point.y + 5}" text-anchor="middle">${index + 1}</text>
      </g>`,
  )

  return `<figure class="graph-card">
    <figcaption>${safeLabel}</figcaption>
    <svg viewBox="0 0 160 160" role="img" aria-label="${safeLabel}">
      ${edges.join('')}
      ${nodes.join('')}
    </svg>
  </figure>`
}

async function loadLeaderboard() {
  if (!supabase) return
  const { data, error } = await supabase
    .from('scores')
    .select('display_name, score')
    .order('score', { ascending: false })
    .limit(10)

  if (error) {
    state.statusMessage = `Leaderboard unavailable: ${error.message}`
    return
  }

  state.leaderboard = data
}

async function saveScore() {
  if (!supabase || !state.session) return
  const { error } = await supabase.from('scores').insert({
    user_id: state.session.user.id,
    display_name: state.session.user.email ?? 'player',
    score: state.totalScore,
  })

  if (error) {
    state.statusMessage = `Failed to save score: ${error.message}`
    return
  }

  state.statusMessage = 'Score saved to leaderboard.'
  await loadLeaderboard()
}

function startGame() {
  state.roundNumber = 1
  state.totalScore = 0
  state.currentRound = createRound()
  state.roundStartedAt = Date.now()
  state.gameFinished = false
  state.lastAnswerSummary = ''
}

async function handleAnswer(guessIsomorphic) {
  if (state.gameFinished) return
  const isCorrect = guessIsomorphic === state.currentRound.isIsomorphic
  const elapsedMs = Date.now() - state.roundStartedAt
  const roundPoints = isCorrect ? scoreForElapsedMs(elapsedMs) : 0
  state.totalScore += roundPoints
  state.lastAnswerSummary = isCorrect ? `Correct +${roundPoints}` : 'Incorrect +0'

  if (state.roundNumber >= ROUND_COUNT) {
    state.gameFinished = true
    await saveScore()
    render()
    return
  }

  state.roundNumber += 1
  state.currentRound = createRound()
  state.roundStartedAt = Date.now()
  render()
}

async function handleAuthSubmit(mode, event) {
  event.preventDefault()
  if (!supabase) {
    state.statusMessage = 'Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to enable login.'
    render()
    return
  }

  if (mode === 'signup') {
    const { error } = await supabase.auth.signUp({
      email: state.email,
      password: state.password,
    })
    state.statusMessage = error ? error.message : 'Sign-up successful. Check your inbox if email confirmation is on.'
  } else {
    const { error } = await supabase.auth.signInWithPassword({
      email: state.email,
      password: state.password,
    })
    state.statusMessage = error ? error.message : 'Logged in.'
  }

  render()
}

async function handleLogout() {
  if (!supabase) return
  await supabase.auth.signOut()
  state.statusMessage = 'Logged out.'
  render()
}

function leaderboardHtml() {
  if (!state.leaderboard.length) {
    return '<p class="muted">No scores yet.</p>'
  }

  const items = state.leaderboard
    .map(
      (entry, index) =>
        `<li><span>#${index + 1} ${escapeHtml(entry.display_name ?? 'player')}</span><strong>${entry.score}</strong></li>`,
    )
    .join('')
  return `<ol class="leaderboard">${items}</ol>`
}

function render() {
  const safeStatus = escapeHtml(state.statusMessage)
  const safeLastAnswer = escapeHtml(state.lastAnswerSummary)
  const safeEmail = escapeHtml(state.email)
  const safePassword = escapeHtml(state.password)
  const safeUserEmail = escapeHtml(state.session?.user.email ?? 'player')

  app.innerHTML = `
    <main>
      <h1>Graph Isomorphism Challenge</h1>
      <p class="muted">Answer 10 rounds. Correct answers score higher when answered faster.</p>
      ${
        supabase
          ? `<section class="panel">
              <h2>Account</h2>
              ${
                state.session
                  ? `<p>Signed in as <strong>${safeUserEmail}</strong></p>
                     <button id="logout" type="button">Log out</button>`
                  : `<form id="auth-form">
                      <label>Email <input id="email" type="email" required value="${safeEmail}" /></label>
                      <label>Password <input id="password" type="password" minlength="6" required value="${safePassword}" /></label>
                      <div class="actions">
                        <button id="signup" type="submit" data-mode="signup">Sign up</button>
                        <button id="login" type="submit" data-mode="login">Log in</button>
                      </div>
                    </form>`
              }
            </section>`
          : '<p class="warning">Supabase is not configured. You can still play, but auth and leaderboard are disabled.</p>'
      }
      <section class="panel">
        <h2>Round ${state.roundNumber}/${ROUND_COUNT}</h2>
        <p>Score: <strong>${state.totalScore}</strong></p>
        ${
          state.gameFinished
            ? `<p class="result">Game over! Final score: ${state.totalScore}</p>
               <button id="restart" type="button">Play again</button>`
            : `<div class="graphs">
                ${graphToSvg(state.currentRound.left, 'Graph A')}
                ${graphToSvg(state.currentRound.right, 'Graph B')}
              </div>
              <div class="actions">
                <button id="isomorphic" type="button">Isomorphic</button>
                <button id="not-isomorphic" type="button">Not isomorphic</button>
              </div>`
        }
        <p class="result">${safeLastAnswer}</p>
      </section>
      <section class="panel">
        <h2>Top 10 leaderboard</h2>
        ${leaderboardHtml()}
      </section>
      <p class="status">${safeStatus}</p>
    </main>
  `

  const authForm = document.querySelector('#auth-form')
  if (authForm) {
    authForm.addEventListener('submit', async (event) => {
      const submitter = event.submitter
      if (!submitter) return
      await handleAuthSubmit(submitter.dataset.mode, event)
    })

    const emailInput = document.querySelector('#email')
    emailInput?.addEventListener('input', (event) => {
      state.email = event.target.value
    })

    const passwordInput = document.querySelector('#password')
    passwordInput?.addEventListener('input', (event) => {
      state.password = event.target.value
    })
  }

  document.querySelector('#logout')?.addEventListener('click', handleLogout)
  document.querySelector('#restart')?.addEventListener('click', () => {
    startGame()
    render()
  })
  document.querySelector('#isomorphic')?.addEventListener('click', () => handleAnswer(true))
  document.querySelector('#not-isomorphic')?.addEventListener('click', () => handleAnswer(false))
}

async function init() {
  if (supabase) {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    state.session = session
    supabase.auth.onAuthStateChange((_event, sessionState) => {
      state.session = sessionState
      render()
    })
    await loadLeaderboard()
  }
  render()
}

init()
