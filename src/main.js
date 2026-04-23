import './style.css'
import { createClient } from '@supabase/supabase-js'

const app = document.querySelector('#app')
let teamNameGlobal = ''
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY


const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

const Params = new URLSearchParams(window.location.search)
let POST_ID = Number(Params.get('quiz')) || 1
let startedAt = null
let loadedQuestions = []

function showMessage(text, type = 'info') {
  const messageDiv = document.querySelector('#message')

  if (!messageDiv) {
    console.warn('messageDiv bestaat nog niet')
    return
  }

  messageDiv.textContent = text
  messageDiv.className = `message ${type}`

  if (type === 'success') {
    messageDiv.classList.add('centered')
  } else {
    messageDiv.classList.remove('centered')
  }
}

function showSuccessMessage(text) {
  const existing = document.querySelector('.success-popup')
  if (existing) existing.remove()

  const div = document.createElement('div')
  div.className = 'success-popup'
  div.textContent = text

  document.body.appendChild(div)

}

function renderQuizLogo() {
  return `
    <div class="quiz-logo">
      <img src="/logo-rnr.png" alt="logo" />
    </div>
  `
}

function normalizeTeamName(name) {
  return name.trim().replace(/\s+/g, ' ')
}

if (!Params.get('quiz')) {
  app.innerHTML = `
    ${renderQuizLogo()}

    <div class="container">
      <div class="error-card">
        <h1>Quiz App</h1>
        <p>Scan een QR-code om een quiz te starten.</p>
      </div>
    </div>
  `
} else {
  showStartScreen()
}

function showStartScreen() {
  app.innerHTML = `
    ${renderQuizLogo()}

    <div class="container">
      <div class="start-card">
        <h1>Quiz ${Params.get('quiz')}</h1>
        <div class="input-group">
          <label for="teamInput">Voer je teamnaam in:</label>
          <input type="text" id="teamInput" placeholder="Teamnaam" />
        </div>
        <button id="startButton">Start Quiz</button>
        <div id="message"></div>
      </div>
    </div>
  `

  document.querySelector('#startButton').addEventListener('click', () => {
    const teamName = normalizeTeamName(document.querySelector('#teamInput').value)
    if (!teamName) {
      document.querySelector('#message').textContent = 'Voer eerst een teamnaam in.'
      return
    }

    teamNameGlobal = teamName
    loadAndStartQuiz()
  })
}

async function loadAndStartQuiz() {
  console.log('POST_ID:', POST_ID)
  console.log('URL params:', Params.get('quiz'))

  app.innerHTML = `
    ${renderQuizLogo()}

    <div class="container container--quiz">
      <div id="quiz"></div>
    </div>
  `

  const quizDiv = document.querySelector('#quiz')
  

  const teamName = normalizeTeamName(teamNameGlobal)

  if (!teamName) {
  return
  }

  console.log(
    'Checking team submission in loadAndStartQuiz for team:',
    JSON.stringify(teamName),
    'quiz:',
    POST_ID
  )

  const { data: existingRows, error: existingError } = await supabase
    .from('Submissions')
    .select('id, team_name, post_id')
    .eq('team_name', teamName)
    .eq('post_id', POST_ID)
    .limit(1)

  console.log('Query result existingRows:', existingRows)

  if (existingError) {
    console.error(existingError)
    showMessage('Fout bij controleren van eerdere inzending.', 'error')
    return
  }

  if (existingRows && existingRows.length > 0) {
  app.innerHTML = `
    ${renderQuizLogo()}

    <div class="container">
      <div class="start-card">
        <h1>Quiz ${Params.get('quiz')}</h1>
        <p class="duplicate-message">Jullie team heeft deze quiz al ingediend.</p>
        <button id="backButton" type="button">Terug</button>
      </div>
    </div>
  `

  document.querySelector('#backButton').addEventListener('click', showStartScreen)
  return
}

  startedAt = new Date().toISOString()

  const { data, error } = await supabase
    .from('Questions')
    .select('*')
    .eq('post_id', POST_ID)
    .order('question_number', { ascending: true })

  if (error) {
    console.error(error)
    showMessage('Fout bij ophalen vragen.', 'error')
    return
  }

  if (!data || data.length === 0) {
    showMessage('Geen vragen gevonden voor deze quiz.', 'error')
    return
  }

  loadedQuestions = data

  let html = '<h2>Vragen</h2>'

  data.forEach((q) => {
    html += `
      <div class="question">
        <p><strong>${q.question_number}. ${q.question_text}</strong></p>

        ${
          q.image_url
            ? `
          <div class="question-image">
            <img src="${q.image_url}" alt="vraag afbeelding" />
          </div>
        `
            : ''
        }

        <label class="answer-option">
          <input type="radio" name="q${q.id}" value="A" />
          ${q.option_a}
        </label>

        <label class="answer-option">
          <input type="radio" name="q${q.id}" value="B" />
          ${q.option_b}
        </label>

        <label class="answer-option">
          <input type="radio" name="q${q.id}" value="C" />
          ${q.option_c}
        </label>

        ${
          q.option_d
            ? `
          <label class="answer-option">
            <input type="radio" name="q${q.id}" value="D" />
            ${q.option_d}
          </label>
        `
            : ''
        }
      </div>
    `
  })

  html += `
    <button id="submitButton" type="button">Verzenden</button>
    <div id="message"></div>
  `

  quizDiv.innerHTML = html

  document.querySelector('#submitButton').addEventListener('click', submitQuiz)
}

function renderFeedbackScreen(questions, answers) {
  const totalQuestions = questions.length

  const wrongQuestions = questions.filter((q) => {
    const given = answers.find(a => a.question_id === q.id)?.given_answer || '-'
    return given !== q.correct_answer
  })

  const correctCount = totalQuestions - wrongQuestions.length

  let html = `
    ${renderQuizLogo()}
    <div class="container container--quiz">
      <div class="feedback-card">
        <h1>Jullie antwoorden zijn ontvangen</h1>
        <div class="feedback-score">
          🎯 Score: ${correctCount} / ${totalQuestions} goed
        </div>
  `

  if (wrongQuestions.length === 0) {
    html += `
      <div class="feedback-perfect">
        ✅ Alles goed! Sterk gedaan.
      </div>
    `
  } else {
    html += `<div class="feedback-list">`

    wrongQuestions.forEach((q) => {
      const given = answers.find(a => a.question_id === q.id)?.given_answer || '-'
      const correct = q.correct_answer

      const answerTextMap = {
        A: q.option_a,
        B: q.option_b,
        C: q.option_c,
        D: q.option_d || '-',
      }

      html += `
        <div class="feedback-item wrong">
          <p><strong>${q.question_number}. ${q.question_text}</strong></p>
          <p>Jullie antwoord: <strong>${given}</strong> - ${answerTextMap[given] || '-'}</p>
          <p>Juiste antwoord: <strong>${correct}</strong> - ${answerTextMap[correct] || '-'}</p>
        </div>
      `
    })

    html += `</div>`
  }

  html += `
      </div>
    </div>
  `

  app.innerHTML = html
}

async function submitQuiz(event) {
  event.preventDefault()
  console.log('submitQuiz gestart, POST_ID:', POST_ID, 'team:', teamNameGlobal)

  showMessage('', 'info')

  const teamName = normalizeTeamName(teamNameGlobal)

  if (!teamName) {
    showMessage('Geen teamnaam ingevuld.', 'error')
    return
  }

  console.log('Checking existing submissions for team:', JSON.stringify(teamName), 'quiz:', POST_ID)

  const { data: existingRows, error: existingError } = await supabase
    .from('Submissions')
    .select('id, team_name, post_id')
    .eq('team_name', teamName)
    .eq('post_id', POST_ID)
    .limit(1)

  console.log('Query result existingRows:', existingRows)

  if (existingError) {
    console.error(existingError)
    showMessage('Fout bij controleren van eerdere inzending.', 'error')
    return
  }

  if (existingRows && existingRows.length > 0) {
    app.innerHTML = `
      ${renderQuizLogo()}

      <div class="container">
        <div class="start-card">
          <h1>Quiz ${Params.get('quiz')}</h1>
          <p class="duplicate-message">Jullie team heeft deze quiz al ingediend.</p>
          <button id="backButton" type="button">Terug</button>
        </div>
      </div>
    `

    document.querySelector('#backButton').addEventListener('click', showStartScreen)
    return
  }

  const answers = []
  let score = 0
  let correctAnswers = 0

  for (const q of loadedQuestions) {
    const selected = document.querySelector(`input[name="q${q.id}"]:checked`)

    if (!selected) {
      showMessage('Beantwoord alle vragen.', 'error')
      return
    }

    const givenAnswer = selected.value

    if (givenAnswer === q.correct_answer) {
      score += 1
      correctAnswers += 1
    }

    answers.push({
      question_id: q.id,
      given_answer: givenAnswer,
    })
  }

  const { data: submissionData, error: submissionError } = await supabase
    .from('Submissions')
    .insert([
      {
        team_name: teamName,
        post_id: POST_ID,
        started_at: startedAt,
        submitted_at: new Date().toISOString(),
        status: 'submitted',
        score,
        correct_answers: correctAnswers,
        total_questions: loadedQuestions.length,
      },
    ])
    .select()

  if (submissionError) {
    console.error('Insert error:', submissionError)
    console.log('Insert error full:', JSON.stringify(submissionError, null, 2))

    if (submissionError.code === '23505') {
      showMessage('Deze quiz is al door jullie team ingediend.', 'error')
      return
    }

    showMessage(`Fout bij opslaan van submission: ${submissionError.message}`, 'error')
    return
  }

  const submissionId = submissionData?.[0]?.id

  const rows = answers.map((a) => ({
    submission_id: submissionId,
    question_id: a.question_id,
    given_answer: a.given_answer,
  }))

  const { error: answersError } = await supabase
    .from('submission_answers')
    .insert(rows)

  if (answersError) {
    console.error(answersError)
    showMessage('Fout bij opslaan van antwoorden.', 'error')
    return
  }

  renderFeedbackScreen(loadedQuestions, answers)
}
