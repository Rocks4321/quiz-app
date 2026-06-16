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

    <div id="quizOverview"></div>
  </div>
`

const dashboardTableDiv = document.querySelector('#dashboardTable')
const statsDiv = document.querySelector('#stats')
const resetButton = document.querySelector('#resetButton')
const quizOverviewDiv = document.querySelector('#quizOverview')

let allSubmissions = []

function renderStats(data, teams = []) {
  const totalTeams = teams.length
  const teamsWithSubmissions = data.length

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
    <div><strong>Geregistreerde teams:</strong> ${totalTeams}</div>
    <div><strong>Teams met inzendingen:</strong> ${teamsWithSubmissions}</div>
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
        <th>Goeie antwoorden quiz 3</th>
        <th>Goeie antwoorden quiz 4</th>
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
       <td>${row.correct_quiz3}</td>
       <td>${row.correct_quiz4}</td>
       <td>${row.total_score ?? 0}</td>
     </tr>
    `
  })

  html += '</table>'
  dashboardTableDiv.innerHTML = html
}

async function renderQuizButtons() {
  console.log('renderQuizButtons gestart')
  const { data, error } = await supabase
    .from('Questions')
    .select('post_id')
    .order('post_id', { ascending: true })

  if (error) {
    console.error('Fout bij ophalen quizzen:', error)
    quizOverviewDiv.innerHTML = '<p>Fout bij ophalen quizzen.</p>'
    return
  }

  const quizIds = [...new Set((data || []).map(row => row.post_id))]

  let html = `
    <div class="quiz-overview-section">
      <h2>Quizvragen bekijken</h2>
      <div class="quiz-buttons">
  `

  quizIds.forEach((quizId) => {
    html += `
      <button class="quiz-open-button" data-quiz-id="${quizId}">
        Quiz ${quizId}
      </button>
    `
  })

  html += `
      </div>
      <div id="quizQuestionsDetail"></div>
    </div>
  `

  quizOverviewDiv.innerHTML = html

  document.querySelectorAll('.quiz-open-button').forEach(button => {
    button.addEventListener('click', () => {
      const quizId = Number(button.dataset.quizId)
      loadQuizQuestions(quizId)
    })
  })
}

async function loadQuizQuestions(quizId) {
  const detailDiv = document.querySelector('#quizQuestionsDetail')

  detailDiv.innerHTML = `<p>Quiz ${quizId} laden...</p>`

  const { data, error } = await supabase
    .from('Questions')
    .select('*')
    .eq('post_id', quizId)
    .order('question_number', { ascending: true })

  if (error) {
    console.error('Fout bij ophalen vragen:', error)
    detailDiv.innerHTML = '<p>Fout bij ophalen vragen.</p>'
    return
  }

  if (!data || data.length === 0) {
    detailDiv.innerHTML = `<p>Geen vragen gevonden voor quiz ${quizId}.</p>`
    return
  }

  let html = `
    <div class="quiz-detail-card">
      <h3>Quiz ${quizId}</h3>
  `

  data.forEach((q) => {
    html += `
      <div class="dashboard-question">
        <p><strong>${q.question_number}. ${q.question_text}</strong></p>

        <ul>
          <li><strong>A:</strong> ${q.option_a || '-'}</li>
          <li><strong>B:</strong> ${q.option_b || '-'}</li>
          <li><strong>C:</strong> ${q.option_c || '-'}</li>
          ${q.option_d ? `<li><strong>D:</strong> ${q.option_d}</li>` : ''}
        </ul>

        <p><strong>Goede antwoord:</strong> ${q.correct_answer || '-'}</p>
      </div>
    `
  })

  html += `</div>`

  detailDiv.innerHTML = html
}

function applyFilterAndRender() {
  renderTable(allSubmissions)
}

async function loadDashboard() {
  try {
    console.log('loadDashboard gestart')

    const { data, error } = await supabase
      .from('Submissions')
      .select('*')

    const { data: teamsData, error: teamsError } = await supabase
      .from('Teams')
      .select('team_name')

    if (error) {
      console.error('Fout bij ophalen dashboard:', error)
      dashboardTableDiv.innerHTML = '<p>Fout bij laden van dashboard.</p>'
      statsDiv.innerHTML = ''
      return
    }

    if (teamsError) {
      console.error('Fout bij ophalen teams:', teamsError)
    }

    const rows = data || []
    const teamMap = {}

        rows.forEach(row => {
      const teamId = row.team_name || 'Onbekend'

      if (!teamMap[teamId]) {
        teamMap[teamId] = {
          team_name: row.team_name || 'Onbekend',
          quizzes_completed: 0,
          correct_quiz1: 0,
          correct_quiz2: 0,
          correct_quiz3: 0,
          correct_quiz4: 0,
          total_score: 0
        }
      }

      teamMap[teamId].quizzes_completed += 1
      teamMap[teamId].total_score += Number(row.correct_answers) || 0

      if (row.post_id === 1) {
        teamMap[teamId].correct_quiz1 += Number(row.correct_answers) || 0
      } else if (row.post_id === 2) {
        teamMap[teamId].correct_quiz2 += Number(row.correct_answers) || 0
      } else if (row.post_id === 3) {
        teamMap[teamId].correct_quiz3 += Number(row.correct_answers) || 0
      } else if (row.post_id === 4) {
        teamMap[teamId].correct_quiz4 += Number(row.correct_answers) || 0
      }
    })

    const result = Object.values(teamMap)

    result.sort((a, b) => {
      if (b.quizzes_completed !== a.quizzes_completed) {
        return b.quizzes_completed - a.quizzes_completed
      }
      return b.total_score - a.total_score
    })

    allSubmissions = result
    renderStats(result, teamsData || [])
    renderTable(result)

  } catch (err) {
    console.error('Error in loadDashboard:', err)
    dashboardTableDiv.innerHTML = '<p>Er ging iets mis bij laden van het dashboard.</p>'
  }
}

loadDashboard()
renderQuizButtons()

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

resetButton.addEventListener('click', async () => {
  const confirmed = window.confirm(
    'Weet je zeker dat je alle inzendingen en teamnamen wilt verwijderen?'
  )

  if (!confirmed) return

  const { error: submissionsError } = await supabase
    .from('Submissions')
    .delete()
    .not('team_name', 'is', null)

  if (submissionsError) {
    console.error('Reset submissions fout:', submissionsError)
    alert('Reset van inzendingen mislukt.')
    return
  }

    const { error: teamsError } = await supabase
    .from('Teams')
    .delete()
    .not('team_name', 'is', null)

  if (teamsError) {
    console.error('Reset teams fout:', teamsError)
    alert('Inzendingen zijn verwijderd, maar teamnamen verwijderen is mislukt.')
    return
  }

  alert('Alle inzendingen en teamnamen zijn verwijderd.')
  loadDashboard()
})
