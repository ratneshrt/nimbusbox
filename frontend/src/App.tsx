import { useState } from "react"

type Database = {
  id: string
  name: string
  image: string
  status: string
}

function App(){
  const [dbType, setDbType] = useState('postgres')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [dbname, setDbname] = useState('')
  const [connectionString, setConnectionString] = useState('')
  const [databases, setDatabases] = useState<Database[]>([])

  const createDatabase = async() => {
    const response = await fetch('http://localhost:4000/create-db', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        type: dbType, username, password, dbname
      })
    })
    const data = await response.json()
    setConnectionString(data.connectionString)
    fetchDatabases()
  }

  const fetchDatabases = async() => {
    const response = await fetch('http://localhost:4000/databases')
    const data = await response.json()
    setDatabases(data)
  }

  const deleteDb = async(id: string) => {
    await fetch(`http://localhost:4000/database/${id}`, {
      method: 'DELETE'
    })
    fetchDatabases()
  }

  return (
    <>
      <div>
        <h1>Create your DB</h1>
        <div>
          <h2>Create Database</h2>
          <select value={dbType} onChange={(e) => setDbType(e.target.value)}>
            <option value="postgres">PostgreSQL</option>
            <option value="mongo">Mongo</option>
            <option value="mysql">MySQL</option>
          </select>

          <input placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} />

          <input placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />

          <input placeholder="DBname" value={dbname} onChange={(e) => setDbname(e.target.value)} />

          <button onClick={createDatabase}>Create</button>

          {connectionString && (
            <div>
              <h3>Connection string</h3>
              <code>{connectionString}</code>
            </div>
          )}

          <div>
            <h2>Your Databases</h2>
            <button onClick={fetchDatabases}>Refresh</button>
            <ul>
              {databases.map(db => (
                <li key={db.id}>
                  {db.name} ({db.image}) - {db.status}
                  <button onClick={() => deleteDb(db.id)}>Delete</button>
                </li>
              ))}
            </ul>
          </div>

        </div>
      </div>
    </>
  )
}

export default App;