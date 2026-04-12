import { AuthSessionStatus } from "../enum/sessionStatus.enum"
export interface IAuthSession {
  sid: string
  userId: number
  refreshTokenHash: string
  expiresAt: Date
}