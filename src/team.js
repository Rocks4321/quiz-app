import './style.css'
import { createClient } from '@supabase/supabase-js'

const app = document.querySelector('#app')

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

function normalizeTeamName(name) {
  return name.trim().replace(/\s+/g, ' ')
}

function showMessage(text, type = 'info') {
  const messageDiv = document.querySelector('#message')
  if (!messageDiv) return

  messageDiv.textContent = text
  messageDiv.className = `message ${type}`
}

app.innerHTML = `
  <div class="container">
    <div class="start-card">
      <h1>Teamregistratie</h1>
      <div class="input-group">
        <label for="teamInput">Voer jullie teamnaam in:</label>
        <input type="text" id="teamInput" placeholder="Teamnaam" />
      </div>
      <button id="saveTeamButton" type="button">Opslaan</button>
      <div id="message"></div>
    </div>
  </div>
`

document.querySelector('#saveTeamButton').addEventListener('click', async () => {
  const rawName = document.querySelector('#teamInput').value
  const teamName = normalizeTeamName(rawName)

  if (!teamName) {
    showMessage('Voer eerst een teamnaam in.', 'error')
    return
  }

  const { data: existingRows, error: existingError } = await supabase
  .from('Teams')
  .select('team_name')
  .eq('team_name', teamName)
  .limit(1)

  if (existingError) {
  console.error('Team check error:', existingError)
  showMessage(`Fout bij controleren van teamnaam: ${existingError.message}`, 'error')
  return
}

  if (existingRows && existingRows.length > 0) {
    showMessage('Deze teamnaam bestaat al. Kies een andere naam.', 'error')
    return
  }

  const { error: insertError } = await supabase
    .from('Teams')
    .insert([{ team_name: teamName }])

  if (insertError) {
  console.error('Insert team error:', insertError)
  showMessage(`Fout bij opslaan van teamnaam: ${insertError.message}`, 'error')
  return
}

  localStorage.setItem('teamName', teamName)

app.innerHTML = `
  <div class="container">
    <div class="start-card">
      <h1>Team geregistreerd</h1>
      <p class="message success">
        Teamnaam "${teamName}" is opgeslagen. Jullie kunnen nu de quizzen spelen.
      </p>
    </div>
  </div>
`
})
