import { Elysia, error, t } from 'elysia'
import { cors } from '@elysiajs/cors'
import crypto from 'crypto'
import xss from 'xss'
import logixlysia from 'logixlysia'
import { Database } from 'bun:sqlite'

const db = new Database('./data/messages.db')

db.run(`
  CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      message TEXT NOT NULL,
      key TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      expiresAt TEXT NOT NULL,
      ipReader TEXT,
      ipWriter TEXT,
      userAgent TEXT
  )
`)

type Message = {
  message: string
  key: string
  createdAt: string
  expiresAt: string
  ipReader?: string | number
  ipWriter?: string | number
  userAgent?: string | number
  id: string
}

const generateKey = (length: number) =>
  crypto.randomBytes(length).toString('hex')

class Messages {
  set(message: string, meta: { headers: Record<string, string | undefined> }) {
    const key = generateKey(message.length)
    const id = crypto.randomBytes(16).toString('hex')
    const userAgent = meta.headers['user-agent'] ?? null
    const ipWriter =
      meta.headers['x-forwarded-for'] || meta.headers['x-real-ip'] || null
    const createdAt = new Date().toISOString()
    const expires = 60 * 60 * 24 // 24 hours
    const expiresAt = new Date(Date.now() + expires * 1000).toISOString()

    const encryptedMessage = message
      .split('')
      .map((char, i) =>
        String.fromCharCode(char.charCodeAt(0) ^ key.charCodeAt(i % key.length))
      )
      .join('')
    const insertQuery = db.query(
      `INSERT INTO messages (id, message, key, createdAt, expiresAt, ipReader, ipWriter, userAgent) VALUES ($id, $message, $key, $createdAt, $expiresAt, $ipReader, $ipWriter, $userAgent)`
    )

    insertQuery.run({
      $id: id,
      $message: encryptedMessage,
      $key: key,
      $createdAt: createdAt,
      $expiresAt: expiresAt,
      $ipReader: null,
      $ipWriter: ipWriter,
      $userAgent: userAgent,
    })

    return id
  }

  get(id: string) {
    try {
      console.log(db.query('select * from messages').all())
      console.log(
        db.query(`SELECT * FROM messages WHERE id = $id`).get({ $id: id })
      )
    } catch (e) {
      console.log(e)
    }

    return (
      db.query(`SELECT * FROM messages WHERE id = $id`).get({ $id: id }) ?? null
    )
  }

  destroy(id: string) {
    const query = db.query(`DELETE FROM messages WHERE id = $id`)
    query.run({ $id: id })
  }

  purgeExpired() {
    const now = new Date().toISOString()
    const query = db.query(`DELETE FROM messages WHERE expiresAt < $date`)
    query.run({ $date: now })
  }
}

new Elysia()
  .decorate('messages', new Messages())
  .use(
    logixlysia({
      config: {
        showStartupMessage: true,
        startupMessageFormat: 'simple',
        timestamp: {
          translateTime: 'yyyy-mm-dd HH:MM:ss',
        },
        ip: true,
        logFilePath: './logs/prime.log',
        customLogFormat:
          '🦊 {now} {level} {duration} {method} {pathname} {status} {message} {ip} {epoch}',
      },
    })
  )
  .use(cors())
  .get('/available/:id', ({ params, messages }) => {
    const id = xss(params.id)
    return messages.get(id) ? 'exist' : error(404, 'Message not found')
  })
  .get('/message/:id', ({ params, messages }) => {
    const id = xss(params.id)
    const message = messages.get(id)
    // read it and destroy
    messages.destroy(id)
    return message ?? error(404, 'Message not found')
  })
  .post(
    '/message',
    ({ messages, body, headers }) => {
      // create new message and return the id
      const message = xss(body.message)

      const id = messages.set(message, { headers })
      return { id }
    },
    { body: t.Object({ message: t.String() }) }
  )
  .listen(3000)
