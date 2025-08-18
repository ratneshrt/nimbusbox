import express from 'express'
import cors from 'cors'
import Docker from 'dockerode'

const app = express()
const docker = new Docker({
    socketPath: "/var/run/docker.sock"
})

app.use(cors())
app.use(express.json())

const DB_CONFIG = {
    postgres: {
        image: 'postgres:15',
        port: '5432',
        volumePath: '/var/lib/postgresql/data',
        env: (username: string, password: string, dbname: string) => [
            `POSTGRES_USER=${username}`,
            `POSTGRES_PASSWORD=${password}`,
            `POSTGRES_DB=${dbname}`
        ]
    },
    mysql: {
        image: 'mysql:8',
        port: '3306',
        volumePath: '/var/lib/mysql',
        env: (username: string, password: string, dbname: string) => [
            `MYSQL_ROOT_PASSWORD=${password}`,
            `MYSQL_DATABASE=${dbname}`,
            `MYSQL_USER=${username}`,
            `MYSQL_PASSWORD=${password}`
        ]
    },
    mongo: {
        image: 'mongo:6',
        port: '27017',
        volumePath: '/data/db',
        env: (username: string, password: string) => [
            `MONGO_INITDB_ROOT_USERNAME=${username}`,
            `MONGO_INITDB_ROOT_PASSWORD=${password}`
        ]
    }
}

type DBType = keyof typeof DB_CONFIG

function getConnectionString(type: 'postgres' | 'mysql' | 'mongo', username: string, password: string, dbname: string, port: string, ip: string): string{
    const protocols = {
        postgres: `postgresql`,
        mysql: 'mysql',
        mongo: 'mongodb'
    }

    if(type === 'mongo'){
        return `${protocols[type]}://${username}:${password}@${ip}:${port}/${dbname}?authSource=admin`
    }

    return `${protocols[type]}://${username}:${password}@${ip}:${port}/${dbname}`
}

function dbid(): string{
    const chars = 'qwertyuiopasdfghjklzxcvbnm1234567890'
    let res = ''
    for (let i=0; i<5; i++){
        res += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return res
}

app.post("/create-db", async(req, res) => {
    const { type, username, password, dbname } = req.body

    if(!DB_CONFIG[type as keyof typeof DB_CONFIG]){
        return res.status(400).json({
            error: 'Unsupported database type'
        })
    }

    try{
        const containerName = `${type}-${dbname}-${dbid()}`
        const volumeName = `${type}-${dbname}-data`
        const config = DB_CONFIG[type as keyof typeof DB_CONFIG]

        const existingContainers = await docker.listContainers({ all: true })
        if(existingContainers.some(c => c.Names.includes(`/${containerName}`))){
            return res.status(409).json({
                error: 'A container with this name already exists'
            })
        }

        await new Promise((resolve, reject) => {
            docker.pull(config.image, (err: any, stream: any) => {
                if(err) return reject(err)
                docker.modem.followProgress(stream, (err: any, output: any) => {
                    if(err) reject(err)
                    else resolve(output)
                })
            })
        })

        const container = await docker.createContainer({
            Image: config.image,
            name: containerName,
            Env: config.env(username, password, dbname),
            HostConfig: {
                PortBindings: { [`${config.port}/tcp`]: [{}] },
                RestartPolicy: { Name: 'unless-stopped' },
                Binds: [`${volumeName}:${config.volumePath}`]
            }
        })

        await container.start()

        const inspected = await container.inspect()
        const hostPort = inspected.NetworkSettings.Ports[`${config.port}/tcp`]?.[0]?.HostPort

        res.status(201).json({
            id: container.id,
            name: containerName,
            type,
            connectionString: getConnectionString(
                type,
                username,
                password,
                dbname,
                hostPort,
                'localhost'
            ),
            createdAt: new Date().toISOString()
        })
    }catch(e){
        console.error("some error occured: ", e)
    }
})

app.get('/databases', async (req, res) => {
    try{
        const containers = await docker.listContainers({ all: true })
        res.json(containers.map(c => ({
            id: c.Id,
            name: c.Names[0],
            image: c.Image,
            state: c.State,
            status: c.Status
        })))
    }
    catch(e){
        console.error(`Error listing db: `, e)
        res.status(500).json({
            error: 'Failed to list db'
        })
    }
})

app.delete(`/database/:id`, async (req, res) => {
    try{
        const container = docker.getContainer(req.params.id)
        await container.stop()
        await container.remove()
        res.status(204).end()
    }
    catch(e){
        console.error('Error deleting db: ', e)
        res.status(500).json({
            error: 'Failed to delete db'
        })
    }
})

app.listen(4000, () => {
    console.log("Server listening on port 4000")
})