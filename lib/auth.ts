import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import {
  createSession,
  createUser,
  findSession,
  findUserByEmail,
  findUserById,
  getBootstrapState,
  revokeSession,
} from "@/lib/store"
import { hashPassword, normalizeEmail, verifyPassword } from "@/lib/crypto"
import type { User } from "@/lib/types"

export const SESSION_COOKIE = "resend-panel-session"

export async function getCurrentSession() {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  if (!token) {
    return null
  }

  const session = await findSession(token)
  if (!session) {
    return null
  }

  if (new Date(session.expiresAt).getTime() < Date.now()) {
    return null
  }

  return session
}

export async function getCurrentUser() {
  const session = await getCurrentSession()
  if (!session) {
    return null
  }

  return findUserById(session.userId)
}

export async function requireCurrentUser() {
  const session = await getCurrentSession()
  if (!session) {
    redirect("/login")
  }

  const user = await findUserById(session.userId)
  if (!user || user.id !== session.userId) {
    redirect("/login")
  }

  return user as User
}

export async function registerOwner(email: string, password: string) {
  const state = await getBootstrapState()
  if (state.hasUsers) {
    throw new Error("Registration is closed after the first account is created.")
  }

  const normalizedEmail = normalizeEmail(email)
  const passwordHash = hashPassword(password)
  const user = await createUser(normalizedEmail, passwordHash)
  return user
}

export async function verifyLogin(email: string, password: string) {
  const user = await findUserByEmail(normalizeEmail(email))
  if (!user) {
    return null
  }

  if (!verifyPassword(password, user.passwordHash)) {
    return null
  }

  return user
}

export async function establishSession(userId: string) {
  const session = await createSession(userId)
  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE, session.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(session.expiresAt),
  })
}

export async function clearSession() {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  if (token) {
    await revokeSession(token)
    cookieStore.delete(SESSION_COOKIE)
  }
}
