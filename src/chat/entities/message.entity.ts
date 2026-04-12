import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from "../../users/entities/user.entity"; 
import { Conversation } from './conversation.entity';
enum MessageStatus{
    activated,
    revoked,
    deleted
}
@Entity({ name: 'Message' })
export class Message {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ type: 'bigint' })
  conversationId: string;

  @Column({ type: 'bigint' })
  senderId: string;
  
  @Column({type: 'enum',enum: MessageStatus ,default: MessageStatus.activated})
  status: string;

  @Column({ type: 'text' })
  content: string;

  @CreateDateColumn({ type: 'timestamp', precision: 3, default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @ManyToOne(() => Conversation, conversation => conversation.messages)
  @JoinColumn({ name: 'conversationId' })
  conversation: Conversation;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'senderId' })
  sender: User;
}