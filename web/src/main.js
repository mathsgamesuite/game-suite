import { createClient } from '@supabase/supabase-js'
import './style.css'
import { ROUND_COUNT, createRound, scoreForElapsedMs } from './gameLogic'
import { topUniqueScores } from './leaderboard'

const app = document.querySelector('#app')
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

const state = {
  screen: 'home',
  authMode: null,
  authPending: false,
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

function sessionDisplayName(session) {
  const username = session?.user?.user_metadata?.username
  if (username) return username

  const email = session?.user?.email ?? ''
  const localPart = email.split('@')[0]
  return localPart || 'player'
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
  const pageSize = 100
  const scores = []
  let offset = 0

  while (true) {
    const { data, error } = await supabase
      .from('scores')
      .select('user_id, display_name, score')
      .order('score', { ascending: false })
      .range(offset, offset + pageSize - 1)

    if (error) {
      state.statusMessage = `Leaderboard unavailable: ${error.message}`
      return
    }

    scores.push(...data)
    const leaders = topUniqueScores(scores)
    if (leaders.length === 10 || data.length < pageSize) {
      state.leaderboard = leaders
      return
    }

    offset += pageSize
  }
}

async function saveScore() {
  if (!supabase || !state.session) return
  const { error } = await supabase.from('scores').insert({
    user_id: state.session.user.id,
    display_name: sessionDisplayName(state.session),
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

function openGame() {
  startGame()
  state.screen = 'game'
  state.statusMessage = ''
  render()
}

function returnHome() {
  state.screen = 'home'
  state.statusMessage = ''
  render()
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

async function handleAuthSubmit(event) {
  event.preventDefault()
  if (!supabase) {
    state.statusMessage = 'Account access is not configured yet.'
    state.authMode = null
    render()
    return
  }

  const formData = new FormData(event.currentTarget)
  const username = String(formData.get('username') ?? '').trim()
  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  const password = String(formData.get('password') ?? '')

  if (!email || (state.authMode === 'signup' && !username)) {
    state.statusMessage = 'Complete all fields to continue.'
    render()
    return
  }

  state.authPending = true
  state.statusMessage = ''
  const submitButton = event.submitter
  submitButton.disabled = true
  submitButton.textContent = 'Please wait...'

  const result =
    state.authMode === 'signup'
      ? await supabase.auth.signUp({
          email,
          password,
          options: { data: { username } },
        })
      : await supabase.auth.signInWithPassword({ email, password })

  state.authPending = false

  if (result.error) {
    state.statusMessage = result.error.message.toLowerCase().includes('email rate limit')
      ? 'Too many confirmation emails were requested. Wait before retrying or configure custom SMTP in Supabase.'
      : result.error.message
  } else if (result.data.session) {
    state.session = result.data.session
    state.statusMessage = state.authMode === 'signup' ? 'Account created.' : 'Signed in.'
    state.authMode = null
  } else {
    state.statusMessage = 'Account created. Check your email to confirm it, then sign in.'
    state.authMode = null
  }

  render()
}

async function handleLogout() {
  if (!supabase) return
  await supabase.auth.signOut()
  state.statusMessage = 'Signed out.'
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

function accountActionsHtml() {
  if (state.session) {
    return `<div class="account-menu">
      <span class="account-name">${escapeHtml(sessionDisplayName(state.session))}</span>
      <button id="logout" class="text-button" type="button">Sign out</button>
    </div>`
  }

  return `<div class="account-menu">
    <button class="text-button" data-auth-mode="signin" type="button">Sign in</button>
    <button class="primary-button" data-auth-mode="signup" type="button">Create account</button>
  </div>`
}

function authDialogHtml() {
  if (!state.authMode) return ''

  const isSignup = state.authMode === 'signup'
  return `<dialog id="auth-dialog" aria-labelledby="auth-title">
    <div class="dialog-head">
      <h2 id="auth-title">${isSignup ? 'Create account' : 'Sign in'}</h2>
      <button id="close-auth" class="icon-button" type="button" aria-label="Close">&times;</button>
    </div>
    <form id="auth-form" class="auth-form">
      ${
        isSignup
          ? `<label>
              Username
              <input name="username" type="text" autocomplete="username" required autofocus />
            </label>`
          : ''
      }
      <label>
        Email
        <input name="email" type="email" autocomplete="email" required ${isSignup ? '' : 'autofocus'} />
      </label>
      <label>
        Password
        <input name="password" type="password" autocomplete="${isSignup ? 'new-password' : 'current-password'}" minlength="6" required />
      </label>
      <button class="primary-button submit-button" type="submit" ${state.authPending ? 'disabled' : ''}>
        ${state.authPending ? 'Please wait...' : isSignup ? 'Create account' : 'Sign in'}
      </button>
    </form>
    <p class="dialog-status" role="status">${escapeHtml(state.statusMessage)}</p>
  </dialog>`
}

function homeScreenHtml() {
  return `
    <main class="page shell">
      <header class="site-header">
        <a class="wordmark" href="#" aria-label="Game Suite home">Game Suite</a>
        ${accountActionsHtml()}
      </header>

      <section class="game-list" aria-labelledby="games-title">
        <h1 id="games-title">Games</h1>
        <button id="open-graph-game" class="game-widget" type="button">
          <h2>Graph Isomorphism</h2>
          <span class="widget-cta" aria-hidden="true">&rarr;</span>
        </button>
      </section>

      <p class="status" role="status">${escapeHtml(state.statusMessage)}</p>
      ${authDialogHtml()}
    </main>
  `
}

function gameScreenHtml() {
  return `
    <main class="page shell">
      <header class="site-header">
        <button id="back-home" class="wordmark wordmark-button" type="button">Game Suite</button>
        ${accountActionsHtml()}
      </header>

      <section class="game-intro">
        <h1>Graph Isomorphism</h1>
      </section>

      <section class="panel">
        <div class="panel-head">
          <h2>Round ${state.roundNumber}/${ROUND_COUNT}</h2>
          <div class="score-pill">Score ${state.totalScore}</div>
        </div>

        ${
          state.gameFinished
            ? `<p class="result">Game over! Final score: ${state.totalScore}</p>
               <div class="actions">
                 <button id="restart" type="button">Play again</button>
               </div>`
            : `<div class="graphs">
                ${graphToSvg(state.currentRound.left, 'Graph A')}
                ${graphToSvg(state.currentRound.right, 'Graph B')}
              </div>
              <div class="actions">
                <button id="isomorphic" class="answer-button" type="button" aria-keyshortcuts="1">
                  <span>Isomorphic</span><kbd>1</kbd>
                </button>
                <button id="not-isomorphic" class="answer-button" type="button" aria-keyshortcuts="2">
                  <span>Not isomorphic</span><kbd>2</kbd>
                </button>
              </div>`
        }

        <p class="result">${escapeHtml(state.lastAnswerSummary)}</p>
      </section>

      <section class="panel">
        <div class="panel-head">
          <h2>Leaderboard</h2>
        </div>
        ${leaderboardHtml()}
      </section>

      <p class="status" role="status">${escapeHtml(state.statusMessage)}</p>
      ${authDialogHtml()}
    </main>
  `
}

function render() {
  app.innerHTML = state.screen === 'home' ? homeScreenHtml() : gameScreenHtml()

  document.querySelector('#open-graph-game')?.addEventListener('click', openGame)
  document.querySelector('#back-home')?.addEventListener('click', returnHome)
  document.querySelectorAll('[data-auth-mode]').forEach((button) => {
    button.addEventListener('click', () => {
      state.authMode = button.dataset.authMode
      state.statusMessage = ''
      render()
    })
  })
  document.querySelector('#close-auth')?.addEventListener('click', () => {
    state.authMode = null
    state.statusMessage = ''
    render()
  })

  const authForm = document.querySelector('#auth-form')
  if (authForm) {
    authForm.addEventListener('submit', handleAuthSubmit)
  }

  const authDialog = document.querySelector('#auth-dialog')
  authDialog?.addEventListener('cancel', (event) => {
    event.preventDefault()
    state.authMode = null
    state.statusMessage = ''
    render()
  })
  authDialog?.showModal()

  document.querySelector('#logout')?.addEventListener('click', handleLogout)
  document.querySelector('#restart')?.addEventListener('click', () => {
    startGame()
    render()
  })
  document.querySelector('#isomorphic')?.addEventListener('click', () => handleAnswer(true))
  document.querySelector('#not-isomorphic')?.addEventListener('click', () => handleAnswer(false))
}

function handleGameShortcut(event) {
  const isTyping = event.target.closest?.('input, textarea, select, [contenteditable="true"]')
  if (state.screen !== 'game' || state.gameFinished || state.authMode || event.repeat || isTyping) {
    return
  }

  if (event.key === '1' || event.key === '2') {
    event.preventDefault()
    handleAnswer(event.key === '1')
  }
}

async function init() {
  document.addEventListener('keydown', handleGameShortcut)

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
