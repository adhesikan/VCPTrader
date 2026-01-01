import { users, type User, type UpsertUser } from "@shared/models/auth";
import { db } from "../../db";
import { eq } from "drizzle-orm";
import bcrypt from "bcrypt";

export interface IAuthStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(email: string, password: string, firstName?: string, lastName?: string): Promise<User>;
  validatePassword(plainPassword: string, hashedPassword: string): Promise<boolean>;
  updateUser(id: string, data: Partial<UpsertUser>): Promise<User | undefined>;
}

const SALT_ROUNDS = 12;

class AuthStorage implements IAuthStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase()));
    return user;
  }

  async createUser(email: string, password: string, firstName?: string, lastName?: string): Promise<User> {
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    const [user] = await db
      .insert(users)
      .values({
        email: email.toLowerCase(),
        password: hashedPassword,
        firstName,
        lastName,
      })
      .returning();
    return user;
  }

  async validatePassword(plainPassword: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(plainPassword, hashedPassword);
  }

  async updateUser(id: string, data: Partial<UpsertUser>): Promise<User | undefined> {
    const updateData = { ...data, updatedAt: new Date() };
    
    if (updateData.password) {
      updateData.password = await bcrypt.hash(updateData.password, SALT_ROUNDS);
    }
    
    const [user] = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, id))
      .returning();
    return user;
  }
}

export const authStorage = new AuthStorage();
