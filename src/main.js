import './style.css'
import { createClient } from '@supabase/supabase-js'

const app = document.querySelector('#app')
let teamNumberGlobal = ''
const SUPABASE_URL = 'https://nggwxhvaayuqnkxishln.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5nZ3d4aHZhYXl1cW5reGlzaGxuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1ODg5NTAsImV4cCI6MjA5MDE2NDk1MH0.PDtH7yyJL7izvtCwev8tkoy9gwHEgIDMica2-v-RoBY'

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

const Params = new URLSearchParams(window.location.search)
const POST_ID = Number(Params.get('quiz')) || 1
let startedAt = null
let loadedQuestions = []

app.innerHTML = `
  <div class="container">
    <div class="start-card">
      <h1>Quiz</h1>
      <input type="text" id="teamInput" placeholder="Voer teamnummer in" />
      <button id="startButton">Start quiz</button>
      <div id="message"></div>
    </div>

    <div id="quiz"></div>
  </div>
`

startButton.addEventListener('click', async () => {
  const teamNumber = document.querySelector('#teamInput').value
  teamNumberGlobal = teamNumber

  app.innerHTML = `
    <div class="container">
      <div id="message"></div>
      <div id="quiz"></div>
    </div>
  `

  const quizDiv = document.querySelector('#quiz')
  const messageDiv = document.querySelector('#message')

  messageDiv.textContent = ''

  if (!teamNumber) {
    messageDiv.textContent = 'Voer eerst een teamnummer in.'
    return
  }

  const { data: existingRows, error: existingError } = await supabase
    .from('Submissions')
    .select('id')
    .eq('team_number', Number(teamNumber))
    .eq('post_id', POST_ID)
    .limit(1)

  if (existingError) {
    console.error(existingError)
    messageDiv.textContent = 'Fout bij controleren van eerdere inzending.'
    return
  }

  if (existingRows && existingRows.length > 0) {
    messageDiv.textContent = 'Deze quiz is al door jullie team ingediend.'
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
    messageDiv.textContent = 'Geen vragen gevonden.'
    return
  }

  loadedQuestions = data

  let html = '<h2>Vragen</h2>'

  data.forEach((q) => {
    html += `
<div class="question">
  <p><strong>${q.question_number}. ${q.question_text}</strong></p>

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

<label class="answer-option">
  <input type="radio" name="q${q.id}" value="D" />
  ${q.option_d}
</label>
</div>
    `
  })

  html += `<button id="submitButton" type="button">Verzenden</button>`

  quizDiv.innerHTML = html

  document.querySelector('#submitButton').addEventListener('click', submitQuiz)
})

async function submitQuiz(event) {
  event.preventDefault()
  console.log('submitQuiz gestart')
  document.querySelector('#message').textContent = ''

  const teamInput = teamNumberGlobal

  if (!teamInput) {
    document.querySelector('#message').textContent = 'Geen teamnummer ingevuld.'
    return
  }

  const { data: existingRows, error: existingError } = await supabase
    .from('Submissions')
    .select('id')
    .eq('team_number', Number(teamInput))
    .eq('post_id', POST_ID)
    .limit(1)

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
        team_number: Number(teamInput),
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
    console.error(submissionError)

    if (submissionError.code === '23505') {
      document.querySelector('#message').textContent = 'Deze quiz is al door jullie team ingediend.'
      return
    }

    messageDiv.textContent = 'Fout bij opslaan van submission.'
    return
  }

  const submissionId = submissionData[0].id

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