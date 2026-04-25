import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany, Index } from 'typeorm';
import { Participant } from './participant.entity';
import { Message } from './message.entity';

export enum ConversationType {
  DIRECT = 'direct',
  GROUP = 'group',
}

@Index('ux_conversation_direct_key', ['directKey'], { unique: true })
@Entity({ name: 'Conversation' })
export class Conversation {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ type: 'enum', enum: ConversationType })
  type: ConversationType;

  @Column({ type: 'text', nullable: true })
  name: string; // Có thể null nếu là chat 1-1

  @Column({ type: 'text', nullable: true })
  directKey: string | null; // Khóa duy nhất cho chat 1-1

  @Column({ type: 'bigint', nullable: true })
  lastMessageId: string | null;

  @Column({ type: 'text', nullable: true })
  lastMessage: string | null;

  @Column({ type: 'timestamp', precision: 3, nullable: true })
  lastMessageAt: Date | null;

  @CreateDateColumn({ type: 'timestamp', precision: 3, default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp', precision: 3 })
  updatedAt: Date;

  @OneToMany(() => Participant, participant => participant.conversation)
  participants: Participant[];

  @OneToMany(() => Message, message => message.conversation)
  messages: Message[];
}