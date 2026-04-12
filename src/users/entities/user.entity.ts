import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { AuthSession } from 'src/auth-session/entities/auth-session.entity';
import { AccStatus } from '../enum/accStatus.enum';
import { Exclude } from 'class-transformer';
@Entity({ name: 'User' })
export class User {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ type: 'text' })
  name: string;

  @Column({ type: 'text', unique: true })
  email: string;

  @Column({ type: 'text' })
  @Exclude()
  password: string;

  @Column({ type: 'enum',enum: AccStatus ,default: AccStatus.ACTIVE })
  status: AccStatus;

  @CreateDateColumn({
    type: 'timestamp',
    precision: 3,
    default: () => 'CURRENT_TIMESTAMP',
  })
  createdAt: Date;

  @UpdateDateColumn({
    type: 'timestamp',
    precision: 3,
  })
  updatedAt: Date;

  @OneToMany(() => AuthSession, (session) => session.user)
  sessions: AuthSession[];
}