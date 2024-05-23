import { z } from 'zod';
export const userSchema = z.object({
    username: z.string().min(3),
    password: z.string().min(8).max(50).regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]+$/),
    secretKey: z.string()
  });

export const roomSchema = z.number().min(6).max(6)

export const createRoomSchema = z.object({
    username: z.string().min(3),
    password: z.string().min(8).max(50).regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]+$/),
    secretKey: z.string(),
    roomId: z.string().min(6).max(6)
})

export const joinRoomSchema = z.object({
    username: z.string().min(3),
    roomId: z.string().min(6).max(6)
})