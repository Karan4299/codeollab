import express, { NextFunction, Request, Response } from 'express'
import { Prisma, PrismaClient } from '@prisma/client'
import bcrypt from 'bcrypt'
import dotenv from 'dotenv'
import { createRoomSchema, joinRoomSchema } from './zodSchema'
import { Server as SocketIoServer } from 'socket.io'
import cors from 'cors'
import rateLimit from 'express-rate-limit';
import CustomError from './cutomClass'
import { ZodError } from 'zod'

const RateLimiter = rateLimit({
  windowMs:  10 * 1000, // 1 minutes
  max: 6, // Limit each IP to 3 OTP requests per windowMs
  message: 'Too many requests, please try again after 1 minutes',
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

const app = express()
const httpServer = app.listen(8080)
const io = new SocketIoServer(httpServer, {
  cors: {
    origin: '*', // Allow requests from any origin
    methods: ['GET', 'POST'],
  },
})
dotenv.config()
const prisma = new PrismaClient()
const rooms = new Map<string, { users: Map<string, string>; message: string }>()
const roomsSocket = new Map<string, string>()

app.use(express.json())
app.use(cors())
app.use((req, res, next) => {
  setTimeout(() => {
    Array.from(rooms.keys()).forEach((roomId) => {
      if (rooms.get(roomId)?.users.size === 0) {
        prisma.rooms.delete({
          where: {
            roomId,
          },
        })
      }
    })
  }, 60 * 60 * 1000)
  next()
})

app.post('/api/create-room',RateLimiter,  async (req, res, next) => {
  const { username, password, roomId, secretKey } = req.body
  try {
    const isInputValid = createRoomSchema.parse({
      username,
      password,
      roomId,
      secretKey,
    })

    if (!isInputValid) {
      throw new CustomError(['Invalid data'], 400)
    }

    const envSecretKey = process.env.ADMIN_SECRET_KEY
    if (!envSecretKey) {
      throw new CustomError(['Env ky not found'], 404)
    }

    const isValidKey = await bcrypt.compare(secretKey, envSecretKey)
    if (!isValidKey) {
      throw new CustomError(['Secret key is not valid'], 403)
    }

    const admin = await prisma.admins.findUniqueOrThrow({
      where: {
        username: username,
      },
    })

    if (!admin) {
      throw new CustomError(['Admin not found'], 404)
    }

    const isPasswordValid = await bcrypt.compare(password, admin.password)

    if (!isPasswordValid) {
      throw new CustomError(['Wrong password'], 400)
    }

    const roomThere = await prisma.rooms.findUnique({
      where: {
        roomId,
      },
      select: {
        adminId: true,
      },
    })

    if (roomThere) {
      if (roomThere.adminId !== admin.id) {
        throw new CustomError(['Room already taken'], 405)
      }
    } else {
      await prisma.rooms.create({
        data: {
          roomId,
          adminId: admin.id,
        },
      })
    }

    if (!rooms.has(roomId)) {
      rooms.set(roomId, { users: new Map(), message: '' })
    }

    res.status(201).json({
      message: 'Room created',
      roomId,
      username,
    })
  } catch (err) {
    if (err instanceof ZodError) {
      // Extract the first Zod error message for simplicity
      const errorDetails = err.errors.map(error => ({
        field: error.path.join('.'),
        message: error.message
      }));
      const errorMessage = errorDetails.map(detail => `${detail.field}: ${detail.message}`)
      next(new CustomError(errorMessage, 400));
    } else{
      console.log(err)
      next(err)
    }
  }
})

app.post('/api/join-room', RateLimiter, async (req, res, next) => {
  const { roomId, username } = req.body

  try {
    const isInputValid = joinRoomSchema.parse({ roomId, username })

    if (!isInputValid) {
      throw new CustomError(['Invalid data'], 400)
    }

    if (rooms.get(roomId)?.users.size === 2) {
      throw new CustomError(['Room limit exceeded'], 405)
    }

    const roomExist = await prisma.rooms.findUnique({
      where: {
        roomId,
      },
    })

    if (!roomExist) {
      throw new CustomError(['Room not found'], 404)
    }

    res.status(200).json({
      message: 'Joining',
      data: {
        roomId: roomExist.roomId,
        username,
      },
    })
  } catch (err) {
    if (err instanceof ZodError) {
      // Extract the first Zod error message for simplicity
      const errorDetails = err.errors.map(error => ({
        field: error.path.join('.'),
        message: error.message
      }));
      const errorMessage = errorDetails.map(detail => `${detail.field}: ${detail.message}`);
      next(new CustomError(errorMessage, 400));
    } else{
      console.log(err)
      next(err)
    }
  }
})

app.get('/', (req, res) => {
  res.send("Welcome to codeollab")
})

app.use((err: CustomError, req: Request, res: Response, next: NextFunction)  => {

  if (err instanceof CustomError) {
    res.statusMessage = err.messages || 'Internal server Errors';
    res.status(err.statusCode).end();
  } else {
    res.statusMessage = 'Internal server Error';
    res.status(500).end();
  }
})

// app.post('/del-room', async (req, res) => {
//   const { roomId, username, adminId } = req.body

//   try {
//     const deleted = await prisma.rooms.delete({
//       where: { roomId },
//     })

//     res.status(201).send('Done')
//   } catch (err) {}
// })

// app.post('/signup', async (req, res) => {
//   const { username, password, secretKey } = req.body
//   try {
//     const isInputValid = userSchema.parse({ username, password, secretKey })

//     const envSecretKey = process.env.ADMIN_SECRET_KEY
//     if (!envSecretKey) {
//       res.status(404).send('Env ky not found')
//       return
//     }

//     const isValidKey = await bcrypt.compare(secretKey, envSecretKey)
//     const hashedPassword = await bcrypt.hash(password, 10)

//     if (!isValidKey) {
//       res.status(403).send('Secret key is not valid')
//       return
//     }

//     const user = await prisma.admins.create({
//       data: {
//         username,
//         password: hashedPassword,
//       },
//     })

//     res.status(201).send({
//       message: 'New user created',
//       username: user.username,
//     })
//     return
//   } catch (err) {
//     res.status(500).json({
//       err,
//     })
//   }
// })

io.on('connection', (socket) => {
  socket.on('disconnect', async () => {
    try {
      const disconnectedRoom = roomsSocket.get(socket.id)
      if (disconnectedRoom) {
        const username = rooms.get(disconnectedRoom)!.users.get(socket.id)

        rooms.get(disconnectedRoom)!.users.delete(socket.id)
        io.to(disconnectedRoom).emit('leftRoom', {
          message: `${username} has left the room.`,
          allUsers: Array.from(rooms.get(disconnectedRoom)!.users.values()),
        })
        socket.emit('leftRoom', {
          allUsers: Array.from(rooms.get(disconnectedRoom)!.users.values()),
        })
      }
    } catch (err) {
      socket.emit('error', {
        message: err,
      })
      return
    }
  })

  socket.on('leaveRoom', async ({ roomId, username }) => {
    try {
      if (rooms.has(roomId)) {
        rooms.get(roomId)!.users.delete(socket.id)
        socket.leave(roomId)

        io.to(roomId).emit('leftRoom', {
          message: `${username} has left the room.`,
          allUsers: Array.from(rooms.get(roomId)!.users.values()),
        })
      }
    } catch (err) {
      socket.emit('error', {
        message: err,
      })
      return
    }
  })

  socket.on('joinRoom', async ({ roomId, username }) => {
    try {

      const roomSize = io.sockets.adapter.rooms.get(roomId)?.size || 0;

      if (roomSize === 2) {
        socket.emit('error', {
          message: 'Room size limit exceeded',
        })
        return
      }
      if (!rooms.has(roomId)) {
        const roomThere = await prisma.rooms.findUnique({
          where: {
            roomId,
          },
        })

        if (roomThere) {
          rooms.set(roomId, { users: new Map(), message: '' })
        } else {
          socket.emit('error', {
            message: 'Room not available',
          })
          return
        }
      }
      socket.join(roomId)
      rooms.get(roomId)!.users.set(socket.id, username)
      roomsSocket.set(socket.id, roomId)
      io.to(roomId).emit('userJoined', {
        username,
        message: `${username} has joined the room.`,
        allUsers: Array.from(rooms.get(roomId)!.users.values()),
      })

      socket.emit('joinedRoom', {
        allUsers: Array.from(rooms.get(roomId)!.users.values()),
      })
    } catch (error) {
      socket.emit('error', {
        message: 'Room not available',
        error: error
      })
      return
    }
  })

  socket.on(
    'sendMessage',
    ({
      roomId,
      message,
      username,
    }: {
      roomId: string
      message: string
      username: string
    }) => {
      if (rooms.has(roomId) && rooms.get(roomId)!.users.has(socket.id)) {
        socket.to(roomId).emit('message', message)
      }
    },
  )

  socket.emit('welcomeMessage', { message: 'Welcome to the WebSocket server!' })
})
