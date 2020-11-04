// Loading libraries
const express = require('express')
const handlebars = require('express-handlebars')
const mysql = require('mysql2/promise')

// Configuring port
const PORT = parseInt(process.argv[2]) || parseInt(process.env.PORT) || 3000

// Creating database connection pool
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 3306,
    database: process.env.DB_NAME || 'leisure',
    password: process.env.DB_PASSWORD,
    user: process.env.DB_USER,
    connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT) || 4,
    timezone: '+08:00'
})

// SQL Query
const SQL_FIND_BY_NAME = 'SELECT * FROM tv_shows order by name limit ?'
const SQL_FIND_BY_ID = 'SELECT * FROM tv_shows WHERE tvid = ?'

const mkQuery = (sqlStmt, pool) => {
    const f = async (params) => {
        // Get a connection from the pool
        const conn = await pool.getConnection()

        try {
            //Execute query with params
            const result = await pool.query(sqlStmt, params)
            return result[0]
        }
        catch (err) {
            return Promise.reject(err)
        }
        finally {
            conn.release()
        }
    }

    return f
}

// Get Queries
const getTVList =  mkQuery(SQL_FIND_BY_NAME, pool)
const getTVShowById = mkQuery(SQL_FIND_BY_ID, pool)
//

// Declaring constant
const LIMIT = 20
const BASEURL = '/tvshows'

const startApp = async (app, pool) => {
    try {
        // Acquiring connection from connection pool
        const conn = await pool.getConnection()
        console.info('Pinging database...')
        await conn.ping()

        // Releasing the connection
        conn.release()

        // Starting up the server
        app.listen(
            PORT, 
            () => {
                console.info(`Application started on PORT ${PORT} at ${new Date()}`)
            }
        )
    }
    catch (err) {
        console.error('Cannot ping database: ', err)
    }
}

// Creating an instance of express application
const app = express()

// Load static files
app.use(
    express.static(__dirname + '/static')
)

// Configuring handlebars 
app.engine('hbs', handlebars({
    defaultLayout: 'default.hbs'
}))
app.set('view engine', 'hbs')

// Configuring application
app.get('/', async (req, res) => {
    try {
        const recs = await getTVList([ LIMIT ])
        res.status(200)
        res.type('text/html')
        res.render('index', {
            recs,
            hasContent: recs.length > 0,
        })
    }
    catch (err) {
        console.error(err)
        res.status(500)
        res.end()
    }
})

app.get('/shows/:tvId', async (req, res) => {
    let getTvId = req.params.tvId

    try {
        const recs = await getTVShowById([getTvId])
        console.info(recs[0].official_site)
        
        if (recs.length <= 0) {
            res.status(404)
            res.type('text/html')
            res.send(`No result found`)
            return
        }

        res.status(200)
        res.type('text/html')
        res.render('details', {
            recs: recs[0],
            hasSite: !!recs[0].official_site
        })
    }
    catch (err) {
        console.error(err)
        res.status(500)
        res.end()
    }
})

app.use((req, resp) => {
	resp.redirect('/')
})

startApp(app, pool)