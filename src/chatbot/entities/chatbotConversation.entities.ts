import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { Participant } from './participant.entity';
import { Message } from './chatbotMessage.entities';

export enum ConversationType {
  DIRECT = 'direct',
  GROUP = 'group',
}

@Entity({ name: 'AiConversation' })
export class Conversation {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ type: 'enum', enum: ConversationType })
  type: ConversationType;

  @Column({ type: 'text', nullable: true })
  name: string; // Có thể null nếu là chat 1-1

  @CreateDateColumn({ type: 'timestamp', precision: 3, default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp', precision: 3 })
  updatedAt: Date;

  @OneToMany(() => Participant, participant => participant.conversation)
  participants: Participant[];

  
}