import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from "../../users/entities/user.entity"; 
import { Conversation } from './chatbotConversation.entities';

export enum ParticipantRole {
  ADMIN = 'admin',
  MEMBER = 'member',
}

@Entity({ name: 'AiParticipant' })
export class Participant {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ type: 'bigint' })
  conversationId: string;

  @Column({ type: 'bigint' })
  userId: string;

  @Column({ type: 'enum', enum: ParticipantRole, default: ParticipantRole.MEMBER })
  role: ParticipantRole;

  @CreateDateColumn({ type: 'timestamp', precision: 3, default: () => 'CURRENT_TIMESTAMP' })
  joinedAt: Date;

  @ManyToOne(() => Conversation, conversation => conversation.participants)
  @JoinColumn({ name: 'conversationId' })
  conversation: Conversation;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;
}