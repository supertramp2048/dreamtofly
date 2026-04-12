import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from 'src/users/entities/user.entity';
import { AuthSessionStatus } from '../enum/sessionStatus.enum';

@Entity({ name: 'AuthSession' })
@Index('AuthSession_userId_idx', ['userId'])
@Index('AuthSession_expiresAt_idx', ['expiresAt'])
export class AuthSession {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ type: 'text', unique: true })
  sid: string;

  @Column({ type: 'bigint' })
  userId: number;

  @ManyToOne(() => User, (user) => user.sessions, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'text' })
  refreshTokenHash: string;

  @Column({
    type: 'enum',
    enum: AuthSessionStatus,
    default: AuthSessionStatus.ACTIVE,
  })
  status: AuthSessionStatus;

  @Column({
    type: 'timestamp',
    precision: 3,
    default: () => 'CURRENT_TIMESTAMP',
  })
  createdAt: Date;

  @Column({
    type: 'timestamp',
    precision: 3,
    nullable: true,
  })
  lastUsedAt: Date | null;

  @Column({
    type: 'timestamp',
    precision: 3,
  })
  expiresAt: Date;

  @Column({
    type: 'timestamp',
    precision: 3,
    nullable: true,
  })
  revokedAt: Date | null;

  @Column({
    type: 'text',
    nullable: true,
  })
  revokeReason: string | null;

  @Column({
    type: 'text',
    nullable: true,
  })
  ip: string | null;

  @Column({
    type: 'text',
    nullable: true,
  })
  userAgent: string | null;
}