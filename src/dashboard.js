import './style.css'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://nggwxhvaayuqnkxishln.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5nZ3d4aHZhYXl1cW5reGlzaGxuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1ODg5NTAsImV4cCI6MjA5MDE2NDk1MH0.PDtH7yyJL7izvtCwev8tkoy9gwHEgIDMica2-v-RoBY'

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

document.querySelector('#app').innerHTML = `
  <div class="dashboard-page">
    <h1>Instructeur Dashboard</h1>

    <button id="resetButton">Reset alle inzendingen</button>

    <div id="stats">Laden van statistieken...</div>

    <div id="dashboardTable">Laden...</div>
  </div>
`

const dashboardTableDiv = document.querySelector('#dashboardTable')
console.log('dashboardTableDiv gevonden:', dashboardTableDiv)
console.log('dashboardTableDiv:', dashboardTableDiv)
const statsDiv = document.querySelector('#stats')
const resetButton = document.querySelector('#resetButton')

let allSubmissions = []

function formatDateTime(dateString) {
  if (!dateString) return '-'
  const date = new Date(dateString)
  return date.toLocaleString('nl-NL')
}

function renderStats(data) {
  const totalSubmissions = data.length

  const averageScore =
    totalSubmissions > 0
      ? (
          data.reduce((sum, row) => sum + (Number(row.score) || 0), 0) /
          totalSubmissions
        ).toFixed(2)
      : 0

  const bestScore =
    totalSubmissions > 0
      ? Math.max(...data.map(row => Number(row.score) || 0))
      : 0

  statsDiv.innerHTML = `
    <div style="display: flex; gap: 20px; flex-wrap: wrap;">
      <div><strong>Totaal aantal inzendingen:</strong> ${totalSubmissions}</div>
      <div><strong>Gemiddelde score:</strong> ${averageScore}</div>
      <div><strong>Hoogste score:</strong> ${bestScore}</div>
    </div>
  `
}

function renderTable(data) {
  if (!data || data.length === 0) {
    dashboardTableDiv.innerHTML = '<p>Geen inzendingen gevonden.</p>'
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
        <th>Tijd</th>
      </tr>
  `

  data.forEach((row, index) => {
    let medal = ''
    if (index === 0) medal = '🥇'
    if (index === 1) medal = '🥈'
    if (index === 2) medal = '🥉'

    html += `
      <tr>
        <td>${medal} ${index + 1}</td>
        <td>${row.team_number}</td>
        <td>${row.score ?? '-'}</td>
        <td>${row.correct_answers ?? '-'}</td>
        <td>${row.total_questions ?? '-'}</td>
        <td>${formatDateTime(row.submitted_at)}</td>
      </tr>
    `
  })

  html += '</table>'
  dashboardTableDiv.innerHTML = html
}

function applyFilterAndRender() {
  renderStats(allSubmissions)
  renderTable(allSubmissions)
  

  renderStats(filtered)
  renderTable(filtered)
}

async function loadDashboard() {
  console.log('loadDashboard gestart')
  const { data, error } = await supabase
    .from('Submissions')
    .select('*')

  console.log('dashboard error:', error)
  console.log('dashboard data:', data)

  if (error) {
    console.error('Fout bij ophalen dashboard:', error)
    dashboardTableDiv.innerHTML = '<p>Fout bij laden van dashboard.</p>'
    statsDiv.innerHTML = ''
    return
  }

  const rows = data || []
  const teamMap = {}

  rows.forEach(row => {
    const team = row.team_number

    if (!teamMap[team]) {
      teamMap[team] = {
        team_number: team,
        quizzes_completed: 0,
        total_correct: 0,
        total_score: 0
      }
    }

    teamMap[team].quizzes_completed += 1
    teamMap[team].total_correct += Number(row.correct_answers) || 0
    teamMap[team].total_score += Number(row.score) || 0
  })

  const result = Object.values(teamMap)

  result.sort((a, b) => {
    if (b.quizzes_completed !== a.quizzes_completed) {
      return b.quizzes_completed - a.quizzes_completed
    }
    return b.total_correct - a.total_correct
  })

  allSubmissions = result
  applyFilterAndRender()
}


resetButton.addEventListener('click', async () => {
  const confirmed = window.confirm(
    'Weet je zeker dat je alle inzendingen wilt verwijderen?'
  )

  if (!confirmed) return

  const { error } = await supabase
    .from('Submissions')
    .delete()
    .neq('id', 0)

  if (error) {
    console.error('Reset fout:', error)
    alert('Reset mislukt. Controleer je database policies / rechten.')
    return
  }

  alert('Alle inzendingen zijn verwijderd.')
  loadDashboard()
})

loadDashboard()

supabase
  .channel('dashboard-realtime')
  .on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'Submissions'
    },
    payload => {
      console.log('Realtime update:', payload)
      loadDashboard()
    }
  )
  .subscribe()