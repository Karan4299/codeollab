"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.joinRoomSchema = exports.createRoomSchema = exports.roomSchema = exports.userSchema = void 0;
const zod_1 = require("zod");
exports.userSchema = zod_1.z.object({
    username: zod_1.z.string().min(3),
    password: zod_1.z.string().min(8).max(50).regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]+$/),
    secretKey: zod_1.z.string()
});
exports.roomSchema = zod_1.z.number().min(6).max(6);
exports.createRoomSchema = zod_1.z.object({
    username: zod_1.z.string().min(3),
    password: zod_1.z.string().min(8).max(50).regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]+$/),
    secretKey: zod_1.z.string(),
    roomId: zod_1.z.string().min(6).max(6)
});
exports.joinRoomSchema = zod_1.z.object({
    username: zod_1.z.string().min(3),
    roomId: zod_1.z.string().min(6).max(6)
});
