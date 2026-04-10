import './style.css'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://nggwxhvaayuqnkxishln.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5nZ3d4aHZhYXl1cW5reGlzaGxuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1ODg5NTAsImV4cCI6MjA5MDE2NDk1MH0.PDtH7yyJL7izvtCwev8tkoy9gwHEgIDMica2-v-RoBY'

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

const POST_ID = 1
let startedAt = null
let loadedQuestions = []

document.querySelector('#app').innerHTML = `
  <div class="container">
    <h1>Quiz App</h1>

    <label for="teamNumber">Teamnummer</label>
    <input id="teamNumber" type="number" />

    <button id="startButton">Start quiz</button>

    <div id="quiz"></div>
    <div id="message" style="margin-top: 16px;"></div>
  </div>
`

const startButton = document.querySelector('#startButton')
const quizDiv = document.querySelector('#quiz')
const messageDiv = document.querySelector('#message')

startButton.addEventListener('click', async () => {
  quizDiv.innerHTML = 'Laden...'
  messageDiv.textContent = ''

  const teamNumber = document.querySelector('#teamNumber').value

  if (!teamNumber) {
    quizDiv.innerHTML = ''
    messageDiv.textContent = 'Voer eerst een teamnummer in.'
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
    quizDiv.innerHTML = ''
    messageDiv.textContent = 'Fout bij ophalen vragen.'
    return
  }

  if (!data || data.length === 0) {
    quizDiv.innerHTML = ''
    messageDiv.textContent = 'Geen vragen gevonden.'
    return
  }

  loadedQuestions = data

  let html = '<h2>Vragen</h2>'

  data.forEach((q) => {
    html += `
      <div class="question">
        <p><strong>${q.question_number}. ${q.question_text}</strong></p>

        <label>
          <input type="radio" name="q${q.id}" value="A" />
          ${q.option_a}
        </label><br>

        <label>
          <input type="radio" name="q${q.id}" value="B" />
          ${q.option_b}
        </label><br>

        <label>
          <input type="radio" name="q${q.id}" value="C" />
          ${q.option_c}
        </label><br>

        <label>
          <input type="radio" name="q${q.id}" value="D" />
          ${q.option_d}
        </label>
      </div>
    `
  })

  html += `<button id="submitButton">Verzenden</button>`

  quizDiv.innerHTML = html

  document.querySelector('#submitButton').addEventListener('click', submitQuiz)
})

async function submitQuiz() {
  messageDiv.textContent = ''

  const teamNumber = document.querySelector('#teamNumber').value

  if (!teamNumber) {
    messageDiv.textContent = 'Geen teamnummer ingevuld.'
    return
  }

  const answers = []
  let score = 0
  let correctAnswers = 0

  for (const q of loadedQuestions) {
    const selected = document.querySelector(`input[name="q${q.id}"]:checked`)

    if (!selected) {
      messageDiv.textContent = 'Beantwoord alle vragen.'
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
        team_number: Number(teamNumber),
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
    messageDiv.textContent = 'Fout bij opslaan submission.'
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
    messageDiv.textContent = 'Fout bij opslaan antwoorden.'
    return
  }

  quizDiv.innerHTML = ''
  messageDiv.textContent = 'Jullie antwoorden zijn ontvangen.'
}