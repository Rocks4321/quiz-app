import './style.css'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_KEY = import.meta.env.VITE_SUPABSE_ANON_KEY

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

function calculateTime(startedAt, submittedAt) {
  if (!startedAt || !submittedAt) return '-'
  const start = new Date(startedAt)
  const end = new Date(submittedAt)
  const diffMs = end - start
  const diffSec = Math.floor(diffMs / 1000)
  const minutes = Math.floor(diffSec / 60)
  const seconds = diffSec % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
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

  console.log('=== DEBUG TABLE DATA ===')
  console.log('First row:', data[0])
  console.log('All rows:', JSON.stringify(data, null, 2))

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
    console.log(`Row ${index}:`, row)
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
        <td>${calculateTime(row.started_at, row.submitted_at)}</td>
      </tr>
    `
  })

  html += '</table>'
  dashboardTableDiv.innerHTML = html
}

function applyFilterAndRender() {
  renderStats(allSubmissions)
  renderTable(allSubmissions)
}

async function loadDashboard() {
  try {
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

    // Sort by score descending
    rows.sort((a, b) => (b.score || 0) - (a.score || 0))

    console.log(rows)
    allSubmissions = rows
    applyFilterAndRender()
  } catch (err) {
    console.error('Error in loadDashboard:', err)
  }
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
      try {
        console.log('Realtime update:', payload)
        loadDashboard()
      } catch (err) {
        console.error('Error in realtime callback:', err)
      }
    }
  )
  .subscribe()
