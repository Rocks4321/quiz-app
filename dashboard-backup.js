import './style.css'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://nggwxhvaayuqnkxishln.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5nZ3d4aHZhYXl1cW5reGlzaGxuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1ODg5NTAsImV4cCI6MjA5MDE2NDk1MH0.PDtH7yyJL7izvtCwev8tkoy9gwHEgIDMica2-v-RoBY'

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

document.querySelector('#app').innerHTML = `
  <div class="container">
    <h1>Dashboard</h1>
    <p id="lastUpdated">Laden...</p>
    <div id="dashboardTable">Laden...</div>
  </div>
`

const dashboardTableDiv = document.querySelector('#dashboardTable')
const lastUpdatedDiv = document.querySelector('#lastUpdated')

function formatDateTime(dateString) {
  if (!dateString) return '-'

  const date = new Date(dateString)
  return date.toLocaleString('nl-NL')
}

async function loadDashboard() {
  const { data, error } = await supabase
    .from('Submissions')
    .select('*')
    .order('score', { ascending: false })
    .order('submitted_at', { ascending: true })

  if (error) {
    console.error(error)
    dashboardTableDiv.innerHTML = 'Fout bij laden van dashboard'
    return
  }

  if (!data || data.length === 0) {
    dashboardTableDiv.innerHTML = '<p>Nog geen inzendingen gevonden.</p>'
    lastUpdatedDiv.textContent = `Laatst bijgewerkt:${new Date().toLocaleTimeString('nl-NL')}`
    return
  }

  let html = `
    <table border="1" style="width:100%; border-collapse: collapse;">
      <tr>
        <th>Plaats</th>
        <th>Team</th>
        <th>Score</th>
        <th>Goed</th>
        <th>Totaal</th>
        <th>Ingezonden op</th>
      </tr>
  `

  data.forEach((row, index) => {
    html += `
      <tr>
        <td>${index + 1}</td>
        <td>${row.team_number}</td>
        <td>${row.score}</td>
        <td>${row.correct_answers}</td>
        <td>${row.total_questions}</td>
        <td>${formatDateTime(row.submitted_at)}</td>
      </tr>
    `
  })

  html += `</table>`

  dashboardTableDiv.innerHTML = html
  lastUpdatedDiv.textContent =`Laatst bijgewerkt: ${new Date().toLocaleTimeString('nl-NL')}`
}

loadDashboard()

setInterval(loadDashboard, 5000)