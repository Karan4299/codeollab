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
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const cutomClass_1 = __importDefault(require("./cutomClass"));
const zod_1 = require("zod");
const RateLimiter = (0, express_rate_limit_1.default)({
    windowMs: 10 * 1000, // 1 minutes
    max: 6, // Limit each IP to 3 OTP requests per windowMs
    message: 'Too many requests, please try again after 1 minutes',
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});
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
app.post('/api/create-room', RateLimiter, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const { username, password, roomId, secretKey } = req.body;
    try {
        const isInputValid = zodSchema_1.createRoomSchema.parse({
            username,
            password,
            roomId,
            secretKey,
        });
        if (!isInputValid) {
            throw new cutomClass_1.default(['Invalid data'], 400);
        }
        const envSecretKey = process.env.ADMIN_SECRET_KEY;
        if (!envSecretKey) {
            throw new cutomClass_1.default(['Env ky not found'], 404);
        }
        const isValidKey = yield bcrypt_1.default.compare(secretKey, envSecretKey);
        if (!isValidKey) {
            throw new cutomClass_1.default(['Secret key is not valid'], 403);
        }
        const admin = yield prisma.admins.findUniqueOrThrow({
            where: {
                username: username,
            },
        });
        if (!admin) {
            throw new cutomClass_1.default(['Admin not found'], 404);
        }
        const isPasswordValid = yield bcrypt_1.default.compare(password, admin.password);
        if (!isPasswordValid) {
            throw new cutomClass_1.default(['Wrong password'], 400);
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
                throw new cutomClass_1.default(['Room already taken'], 405);
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
    catch (err) {
        if (err instanceof zod_1.ZodError) {
            // Extract the first Zod error message for simplicity
            const errorDetails = err.errors.map(error => ({
                field: error.path.join('.'),
                message: error.message
            }));
            const errorMessage = errorDetails.map(detail => `${detail.field}: ${detail.message}`);
            next(new cutomClass_1.default(errorMessage, 400));
        }
        else {
            console.log(err);
            next(err);
        }
    }
}));
app.post('/api/join-room', RateLimiter, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const { roomId, username } = req.body;
    try {
        const isInputValid = zodSchema_1.joinRoomSchema.parse({ roomId, username });
        if (!isInputValid) {
            throw new cutomClass_1.default(['Invalid data'], 400);
        }
        if (((_a = rooms.get(roomId)) === null || _a === void 0 ? void 0 : _a.users.size) === 2) {
            throw new cutomClass_1.default(['Room limit exceeded'], 405);
        }
        const roomExist = yield prisma.rooms.findUnique({
            where: {
                roomId,
            },
        });
        if (!roomExist) {
            throw new cutomClass_1.default(['Room not found'], 404);
        }
        res.status(200).json({
            message: 'Joining',
            data: {
                roomId: roomExist.roomId,
                username,
            },
        });
    }
    catch (err) {
        if (err instanceof zod_1.ZodError) {
            // Extract the first Zod error message for simplicity
            const errorDetails = err.errors.map(error => ({
                field: error.path.join('.'),
                message: error.message
            }));
            const errorMessage = errorDetails.map(detail => `${detail.field}: ${detail.message}`);
            next(new cutomClass_1.default(errorMessage, 400));
        }
        else {
            console.log(err);
            next(err);
        }
    }
}));
app.use((err, req, res, next) => {
    if (err instanceof cutomClass_1.default) {
        res.statusMessage = err.messages || 'Internal server Errors';
        res.status(err.statusCode).end();
    }
    else {
        res.statusMessage = 'Internal server Error';
        res.status(500).end();
    }
});
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
