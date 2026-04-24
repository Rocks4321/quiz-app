import './style.css'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY
const logoRnr = `${import.meta.env.BASE_URL}logo-rnr.png`

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

document.querySelector('#app').innerHTML = `
  <div class="quiz-logo">
    <img src="/logo-rnr.png" alt="logo" />
  </div>

  <div class="dashboard-page">
    <h1>Instructeur Dashboard</h1>

    <button id="resetButton">Reset alle inzendingen</button>

    <div id="stats">Laden van statistieken...</div>

    <div id="dashboardTable">Laden...</div>
  </div>
`

const dashboardTableDiv = document.querySelector('#dashboardTable')
const statsDiv = document.querySelector('#stats')
const resetButton = document.querySelector('#resetButton')

let allSubmissions = []

function renderStats(data) {
  const totalTeams = data.length

  const averageScore =
    totalTeams > 0
      ? (
          data.reduce(
            (sum, row) =>
              sum +
              (Number(row.correct_quiz1) || 0) +
              (Number(row.correct_quiz2) || 0),
            0
          ) / totalTeams
        ).toFixed(2)
      : 0

  const bestScore =
    totalTeams > 0
      ? Math.max(
          ...data.map(
            (row) => (Number(row.correct_quiz1) || 0) + (Number(row.correct_quiz2) || 0)
          )
        )
      : 0

  statsDiv.innerHTML = `
    <div style="display: flex; gap: 20px; flex-wrap: wrap;">
      <div><strong>Totaal aantal teams:</strong> ${totalTeams}</div>
      <div><strong>Gemiddelde totaal score:</strong> ${averageScore}</div>
      <div><strong>Hoogste totaal score:</strong> ${bestScore}</div>
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
        <th>Aantal quizen gemaakt</th>
        <th>Goeie antwoorden quiz 1</th>
        <th>Goeie antwoorden quiz 2</th>
        <th>Score totaal</th>
      </tr>
  `

  data.forEach((row, index) => {
    let medal = ''
    if (index === 0) medal = '\u{1F947}'
    if (index === 1) medal = '\u{1F948}'
    if (index === 2) medal = '\u{1F949}'

    html += `
      <tr>
        <td>${medal} ${index + 1}</td>
        <td>${row.team_name || row.team_number || '-'}</td>
        <td>${row.quizzes_completed}</td>
        <td>${row.correct_quiz1}</td>
        <td>${row.correct_quiz2}</td>
        <td>${row.total_score}</td>
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
    const { data, error } = await supabase.from('Submissions').select('*')

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

    rows.forEach((row) => {
      const teamId = row.team_name || row.team_number || 'Onbekend'

      if (!teamMap[teamId]) {
        teamMap[teamId] = {
          team_name: row.team_name || null,
          team_number: row.team_number || null,
          quizzes_completed: 0,
          correct_quiz1: 0,
          correct_quiz2: 0,
          total_score: 0,
        }
      }

      teamMap[teamId].quizzes_completed += 1
      teamMap[teamId].total_score += Number(row.score) || 0

      if (row.post_id === 1) {
        teamMap[teamId].correct_quiz1 += Number(row.correct_answers) || 0
      } else if (row.post_id === 2) {
        teamMap[teamId].correct_quiz2 += Number(row.correct_answers) || 0
      }
    })

    const result = Object.values(teamMap)

    result.sort((a, b) => {
      if (b.quizzes_completed !== a.quizzes_completed) {
        return b.quizzes_completed - a.quizzes_completed
      }

      const totalCorrectA = (a.correct_quiz1 || 0) + (a.correct_quiz2 || 0)
      const totalCorrectB = (b.correct_quiz1 || 0) + (b.correct_quiz2 || 0)

      return totalCorrectB - totalCorrectA
    })

    console.log(result)
    allSubmissions = result
    applyFilterAndRender()
  } catch (err) {
    console.error('Error in loadDashboard:', err)
  }
}

resetButton.addEventListener('click', async () => {
  const confirmed = window.confirm('Weet je zeker dat je alle inzendingen wilt verwijderen?')

  if (!confirmed) return

  const { error } = await supabase.from('Submissions').delete().neq('id', 0)

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
      table: 'Submissions',
    },
    (payload) => {
      try {
        console.log('Realtime update:', payload)
        loadDashboard()
      } catch (err) {
        console.error('Error in realtime callback:', err)
      }
    }
  )
  .subscribe()
