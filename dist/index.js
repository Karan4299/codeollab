"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const client_1 = require("@prisma/client");
const bcrypt_1 = __importDefault(require("bcrypt"));
const dotenv_1 = __importDefault(require("dotenv"));
const zodSchema_1 = require("./zodSchema");
const socket_io_1 = require("socket.io");
const cors_1 = __importDefault(require("cors"));
const app = (0, express_1.default)();
const httpServer = app.listen(8080);
const io = new socket_io_1.Server(httpServer, {
    cors: {
        origin: '*', // Allow requests from any origin
        methods: ['GET', 'POST'],
    },
});
dotenv_1.default.config();
const prisma = new client_1.PrismaClient();
const rooms = new Map();
const roomsSocket = new Map();
app.use(express_1.default.json());
app.use((0, cors_1.default)());
app.use((req, res, next) => {
    setTimeout(() => {
        Array.from(rooms.keys()).forEach((roomId) => {
            var _a;
            if (((_a = rooms.get(roomId)) === null || _a === void 0 ? void 0 : _a.users.size) === 0) {
                prisma.rooms.delete({
                    where: {
                        roomId,
                    },
                });
            }
        });
    }, 60 * 60 * 1000);
    next();
});
app.post('/api/create-room', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { username, password, roomId, secretKey } = req.body;
    try {
        const isInputValid = zodSchema_1.createRoomSchema.parse({
            username,
            password,
            roomId,
            secretKey,
        });
        if (!isInputValid) {
            res.status(400).json({
                message: 'Wrong input data',
            });
            return;
        }
        const envSecretKey = process.env.ADMIN_SECRET_KEY;
        if (!envSecretKey) {
            res.status(404).json({
                message: 'Env ky not found',
            });
            return;
        }
        const isValidKey = yield bcrypt_1.default.compare(secretKey, envSecretKey);
        if (!isValidKey) {
            res.status(403).json({
                message: 'Secret key is not valid',
            });
            return;
        }
        const admin = yield prisma.admins.findUniqueOrThrow({
            where: {
                username: username,
            },
        });
        if (!admin) {
            res.status(404).json({
                message: 'Admin not found',
            });
            return;
        }
        const isPasswordValid = yield bcrypt_1.default.compare(password, admin.password);
        if (!isPasswordValid) {
            res.status(400).json({
                message: 'Wrong password',
            });
            return;
        }
        const roomThere = yield prisma.rooms.findUnique({
            where: {
                roomId,
            },
            select: {
                adminId: true,
            },
        });
        if (roomThere) {
            if (roomThere.adminId !== admin.id) {
                res.status(405).json({
                    message: 'Room already taken',
                });
                return;
            }
        }
        else {
            yield prisma.rooms.create({
                data: {
                    roomId,
                    adminId: admin.id,
                },
            });
        }
        if (!rooms.has(roomId)) {
            rooms.set(roomId, { users: new Map(), message: '' });
        }
        res.status(201).json({
            message: 'Room created',
            roomId,
            username,
        });
    }
    catch (error) {
        if (error instanceof client_1.Prisma.PrismaClientKnownRequestError &&
            error.code === 'P2025') {
            res.status(404).send('Admin not found');
            return;
        }
        else {
            res.status(501).json({
                error,
            });
            return;
        }
    }
}));
app.post('/api/join-room', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const { roomId, username } = req.body;
    try {
        const isInputValid = zodSchema_1.joinRoomSchema.parse({ roomId, username });
        if (((_a = rooms.get(roomId)) === null || _a === void 0 ? void 0 : _a.users.size) === 2) {
            res.status(405).json({
                message: 'Room limit exceeded',
            });
            return;
        }
        if (!isInputValid) {
            res.status(400).json({
                message: 'Please enter valid data',
            });
            return;
        }
        const roomExist = yield prisma.rooms.findUnique({
            where: {
                roomId,
            },
        });
        if (!roomExist) {
            res.status(404).json({
                message: 'Room not found',
            });
            return;
        }
        res.status(200).json({
            message: 'Joining',
            data: {
                roomId: roomExist.roomId,
                username,
            },
        });
        return;
    }
    catch (err) {
        res.status(500).json({
            message: 'Could not join room',
        });
    }
}));
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
    socket.on('disconnect', () => __awaiter(void 0, void 0, void 0, function* () {
        try {
            const disconnectedRoom = roomsSocket.get(socket.id);
            if (disconnectedRoom) {
                const username = rooms.get(disconnectedRoom).users.get(socket.id);
                rooms.get(disconnectedRoom).users.delete(socket.id);
                io.to(disconnectedRoom).emit('leftRoom', {
                    message: `${username} has left the room.`,
                    allUsers: Array.from(rooms.get(disconnectedRoom).users.values()),
                });
                socket.emit('leftRoom', {
                    allUsers: Array.from(rooms.get(disconnectedRoom).users.values()),
                });
            }
        }
        catch (err) {
            socket.emit('error', {
                message: err,
            });
            return;
        }
    }));
    socket.on('leaveRoom', (_a) => __awaiter(void 0, [_a], void 0, function* ({ roomId, username }) {
        try {
            if (rooms.has(roomId)) {
                rooms.get(roomId).users.delete(socket.id);
                socket.leave(roomId);
                io.to(roomId).emit('leftRoom', {
                    message: `${username} has left the room.`,
                    allUsers: Array.from(rooms.get(roomId).users.values()),
                });
            }
        }
        catch (err) {
            socket.emit('error', {
                message: err,
            });
            return;
        }
    }));
    socket.on('joinRoom', (_b) => __awaiter(void 0, [_b], void 0, function* ({ roomId, username }) {
        var _c;
        try {
            const roomSize = ((_c = io.sockets.adapter.rooms.get(roomId)) === null || _c === void 0 ? void 0 : _c.size) || 0;
            if (roomSize === 2) {
                socket.emit('error', {
                    message: 'Room size limit exceeded',
                });
                return;
            }
            if (!rooms.has(roomId)) {
                const roomThere = yield prisma.rooms.findUnique({
                    where: {
                        roomId,
                    },
                });
                if (roomThere) {
                    rooms.set(roomId, { users: new Map(), message: '' });
                }
                else {
                    socket.emit('error', {
                        message: 'Room not available',
                    });
                    return;
                }
            }
            socket.join(roomId);
            rooms.get(roomId).users.set(socket.id, username);
            roomsSocket.set(socket.id, roomId);
            io.to(roomId).emit('userJoined', {
                username,
                message: `${username} has joined the room.`,
                allUsers: Array.from(rooms.get(roomId).users.values()),
            });
            socket.emit('joinedRoom', {
                allUsers: Array.from(rooms.get(roomId).users.values()),
            });
        }
        catch (error) {
            socket.emit('error', {
                message: 'Room not available',
                error: error
            });
            return;
        }
    }));
    socket.on('sendMessage', ({ roomId, message, username, }) => {
        if (rooms.has(roomId) && rooms.get(roomId).users.has(socket.id)) {
            socket.to(roomId).emit('message', message);
        }
    });
    socket.emit('welcomeMessage', { message: 'Welcome to the WebSocket server!' });
});
