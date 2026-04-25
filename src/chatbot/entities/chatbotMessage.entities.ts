import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from "../../users/entities/user.entity"; 
enum MessageStatus{
    activated,
    revoked,
    deleted
}
@Entity({ name: 'AiMessage' })
export class Message {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ type: 'bigint' })
  senderId: string;
  
  @Column({type: 'bigint'})
  receiverId: string

  @Column({type: 'enum',enum: MessageStatus ,default: MessageStatus.activated})
  status: string;

  @Column({ type: 'text',nullable: true })
  content: string;

  @Column({type: 'text', nullable: true})
  fileUrl: string;

  @CreateDateColumn({ type: 'timestamp', precision: 3, default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'senderId' })
  sender: User;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'receiverId' })
  receiver: User;
}