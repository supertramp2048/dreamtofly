import { Module } from '@nestjs/common';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';
import { ChatGateway } from './chat.gateway';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Conversation } from './entities/conversation.entity';
import { Participant } from './entities/participant.entity';
import { Message } from './entities/message.entity';
import { JwtModule } from '@nestjs/jwt';
import { CloudinaryService } from './cloudinary.service';
import { FirebaseService } from './firebase.service';
import { ChatbotModule } from 'src/chatbot/chatbot.module';
import { User } from 'src/users/entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Conversation, Participant, Message, User]),
    JwtModule.register({}),
    ChatbotModule,
  ],
  controllers: [ChatController],
  providers: [ChatService, ChatGateway, CloudinaryService, FirebaseService],
})
export class ChatModule {}
