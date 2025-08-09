import express from 'express'
import cors from 'cors'
import Docker from 'dockerode'

const app = express()
const docker = new Docker({
    socketPath: "/var/run/docker.sock"
})

app.use(cors())
app.use(express.json())

function getConnectionString(type: string, username: string, password: string, dbname: string, port: string, ip: string){
    if(type === "postgres"){
        return `postgres://${username}:${password}@${ip}:${port}/${dbname}`
    }
    if(type === "mysql"){
        return `mysql://${username}:${password}@${ip}:${port}/${dbname}`
    }
    return `mongodb://${username}:${password}@${ip}:${port}`
}

app.post("/create-db", async(req, res) => {
    const { type, username, password, dbname } = req.body
    const ip = process.env.ip || ""
    try{
        let image = ""
        let envVars: string[] = []
        let port = ""
        let volumeName = `${type}_${dbname}_data`

        if(type === "postgres"){
            image = "postgres:15"
            envVars = [`POSTGRES_USER=${username}`, `POSTGRES_PASSWORD=${password}`, `POSTGRES_DB=${dbname}`]
            port = "5432"
        }
        else if(type === "mysql"){
            image = "mysql:8"
            envVars = [
                `MYSQL_ROOT_PASSWORD=${password}`,
                `MYSQL_DATABASE=${dbname}`,
                `MYSQL_USER=${username}`,
                `MYSQL_PASSWORD=${password}`
            ]
            port = "3306"
        }
        else if (type === "mongo"){
            image = "mongo:6"
            envVars = [`MONGO_INITDB_ROOT_USERNAME=${username}`, `MONGO_INITDB_ROOT_PASSWORD=${password}`]
            port = "27017"
        }
        else{
            return res.status(400).json({
                error: "Unsupported DB type"
            })
        }

        const container = await docker.createContainer({
            Image: image,
            name: `${type}_${dbname}_${Date.now()}`,
            Env: envVars,
            HostConfig: {
                PortBindings: { [`${port}/tcp`]: [{ HostPort: port }] },
                Memory: 512 * 1024 * 1024,
                NanoCpus: 500000000,
                Binds: [`${volumeName}:/data/db`]
            }
        })

        await container.start()

        res.status(200).json({
            connectionString: getConnectionString(type, username, password, dbname, port, ip)
        })

    }catch(e){
        console.error("some error occured: ", e)
    }
})

app.get("/", (req, res) => {
    res.status(200).json({
        msg: "hello"
    })
})

app.listen(4000, () => {
    console.log("Server listening on port 4000")
})