import { Router } from 'express';
import type { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getDb } from '../db.ts';
import type { User } from '../models/user.ts';

import { authenticateToken } from '../middleware/auth.ts';
import type { AuthRequest } from '../middleware/auth.ts';

const router = Router();
const collectionName = 'users';

/**
 * @swagger
 * /auth/change-password:
 *   put:
 *     summary: Change user password
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - oldPassword
 *               - newPassword
 *             properties:
 *               oldPassword:
 *                 type: string
 *               newPassword:
 *                 type: string
 *     responses:
 *       200:
 *         description: Password changed successfully
 *       400:
 *         description: Invalid old password
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.put('/change-password', authenticateToken as any, async (req: AuthRequest, res: Response) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const username = req.user?.username;

    if (!oldPassword || !newPassword) {
      return res.status(400).send('Old and new passwords are required');
    }

    const db = getDb();
    const user = await db.collection<User>(collectionName).findOne({ username });

    if (!user) {
      return res.status(401).send('User not found');
    }

    const isMatch = await bcrypt.compare(oldPassword, user.password || '');
    if (!isMatch) {
      return res.status(400).send('Invalid old password');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await db.collection(collectionName).updateOne(
      { username },
      { $set: { password: hashedPassword } }
    );

    res.send('Password changed successfully');
  } catch (error) {
    console.error('Error changing password:', error);
    res.status(500).send('Error changing password');
  }
});

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: Authentication management
 */

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *               password:
 *                 type: string
 *               role:
 *                 type: string
 *                 enum: [admin, user]
 *     responses:
 *       201:
 *         description: User registered successfully
 *       400:
 *         description: User already exists
 *       500:
 *         description: Server error
 */
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { username, password, role } = req.body;
    if (!username || !password) {
        return res.status(400).send('Username and password are required');
    }

    const db = getDb();
    const existingUser = await db.collection(collectionName).findOne({ username });

    if (existingUser) {
      return res.status(400).send('User already exists');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user: User = { 
      username, 
      password: hashedPassword,
      role: role === 'admin' ? 'admin' : 'user'
    };
    
    await db.collection(collectionName).insertOne(user as any);
    
    res.status(201).send('User registered successfully');
  } catch (error) {
    console.error('Error registering user:', error);
    res.status(500).send('Error registering user');
  }
});

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Login a user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 accessToken:
 *                   type: string
 *                 role:
 *                   type: string
 *       400:
 *         description: Invalid credentials
 *       500:
 *         description: Server error
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;
    const db = getDb();
    const user = await db.collection<User>(collectionName).findOne({ username });

    if (!user) {
      return res.status(400).send('Cannot find user');
    }

    if(await bcrypt.compare(password, user.password || '')) {
      const accessToken = jwt.sign(
        { username: user.username, role: user.role || 'user' }, 
        process.env.JWT_SECRET || 'secret', 
        { expiresIn: '1h' }
      );
      res.json({ accessToken: accessToken, role: user.role || 'user' });
    } else {
      res.status(400).send('Not Allowed');
    }
  } catch (error) {
      console.error('Error logging in:', error);
    res.status(500).send('Error logging in');
  }
});

export default router;
