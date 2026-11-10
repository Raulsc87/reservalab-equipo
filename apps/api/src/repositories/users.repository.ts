import { db } from "../db/client.js";
import { users } from "../db/schema.js";
import { eq } from "drizzle-orm";

interface NewUser {
  name: string;
  email: string;
  passwordHash: string;
}

export async function createUser(data: NewUser) {
  const [user] = await db
    .insert(users)
    .values({
      ...data,
      role: "estudiante"
    })
    .returning({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role
    });

  if (!user) {
    throw new Error("No se pudo crear el usuario");
  }

  return user;

  
}
export async function findUserByEmail(email: string) {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  return user;
}
export async function findUserById(id: string) {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, id))
    .limit(1);

  return user;
}