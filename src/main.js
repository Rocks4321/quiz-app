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

function normalizeTeamName(name) {
  return name.trim().replace(/\s+/g, ' ')
}

// Als er geen quiz parameter is, toon een foutmelding
if (!Params.get('quiz')) {
  app.innerHTML = `
    <div class="container">
      <div class="error-card">
        <h1>Quiz App</h1>
        <p>Scan een QR-code om een quiz te starten.</p>
      </div>
    </div>
  `
} else {
  // Toon start scherm
  showStartScreen()
}

function showStartScreen() {
  app.innerHTML = `
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
    <div class="container">
      <div id="message"></div>
      <div id="quiz"></div>
    </div>
  `

  const quizDiv = document.querySelector('#quiz')
  const messageDiv = document.querySelector('#message')

  messageDiv.textContent = ''

  const teamName = normalizeTeamName(teamNameGlobal)

  if (!teamName) {
    messageDiv.textContent = 'Voer eerst een teamnaam in.'
    return
  }

  console.log('Checking team submission in loadAndStartQuiz for team:', JSON.stringify(teamName), 'quiz:', POST_ID)

  const { data: existingRows, error: existingError } = await supabase
    .from('Submissions')
    .select('id, team_name, post_id')
    .eq('team_name', teamName)
    .eq('post_id', POST_ID)
    .limit(1)

  console.log('Query result existingRows:', existingRows)

  if (existingError) {
    console.error(existingError)
    messageDiv.textContent = 'Fout bij controleren van eerdere inzending.'
    return
  }

  if (existingRows && existingRows.length > 0) {
    messageDiv.textContent = 'Jullie team heeft deze quiz al ingediend.'
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
    messageDiv.textContent = 'Fout bij ophalen vragen.'
    return
  }

  if (!data || data.length === 0) {
    messageDiv.textContent = 'Geen vragen gevonden voor deze quiz.'
    return
  }

  loadedQuestions = data

  let html = '<h2>Vragen</h2>'

  data.forEach((q) => {
  html += `
    <div class="question">
      <p><strong>${q.question_number}. ${q.question_text}</strong></p>

      ${q.image_url ? `
        <div class="question-image">
          <img src="${q.image_url}" alt="vraag afbeelding" />
        </div>
      ` : ''}

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

      ${q.option_d ? `
        <label class="answer-option">
          <input type="radio" name="q${q.id}" value="D" />
          ${q.option_d}
        </label>
      ` : ''}
    </div>
  `
})

  html += `<button id="submitButton" type="button">Verzenden</button>`

  quizDiv.innerHTML = html

  document.querySelector('#submitButton').addEventListener('click', submitQuiz)
}

async function submitQuiz(event) {
  event.preventDefault()
  console.log('submitQuiz gestart, POST_ID:', POST_ID, 'team:', teamNameGlobal)

  document.querySelector('#message').textContent = ''

  const teamName = normalizeTeamName(teamNameGlobal)

  if (!teamName) {
    document.querySelector('#message').textContent = 'Geen teamnaam ingevuld.'
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
    document.querySelector('#message').textContent = 'Fout bij controleren van eerdere inzending.'
    return
  }

  if (existingRows && existingRows.length > 0) {
    document.querySelector('#message').textContent = 'Deze quiz is al door jullie team ingediend.'
    return
  }

  const answers = []
  let score = 0
  let correctAnswers = 0

  for (const q of loadedQuestions) {
    const selected = document.querySelector(`input[name="q${q.id}"]:checked`)

    if (!selected) {
      document.querySelector('#message').textContent = 'Beantwoord alle vragen.'
      return
    }

    const givenAnswer = selected.value

    if (givenAnswer === q.correct_answer) {
      score += 1
      correctAnswers += 1
    }

    answers.push({
      question_id: q.id,
      given_answer: givenAnswer
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
        score: score,
        correct_answers: correctAnswers,
        total_questions: loadedQuestions.length
      }
    ])
    .select()

  if (submissionError) {
    console.error('Insert error:', submissionError)
    console.log('Insert error full:', JSON.stringify(submissionError, null, 2))
    if (submissionError.code === '23505') {
      document.querySelector('#message').textContent = 'Deze quiz is al door jullie team ingediend.'
      return
    }
    document.querySelector('#message').textContent = 'Fout bij opslaan van submission: ' + submissionError.message
    return
  }

  const submissionId = submissionData?.[0]?.id

  const rows = answers.map((a) => ({
    submission_id: submissionId,
    question_id: a.question_id,
    given_answer: a.given_answer
  }))

  const { error: answersError } = await supabase
    .from('submission_answers')
    .insert(rows)

  if (answersError) {
    console.error(answersError)
    document.querySelector('#message').textContent = 'Fout bij opslaan van antwoorden.'
    return
  }

  document.querySelector('#quiz').innerHTML = ''
  document.querySelector('#message').textContent = 'Jullie antwoorden zijn ontvangen.'
}
