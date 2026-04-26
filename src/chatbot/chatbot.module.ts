import { Module } from '@nestjs/common';
import { ChatbotService } from './chatbot.service';
import { ChatbotController } from './chatbot.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Message } from './entities/chatbotMessage.entities';
import { JwtModule } from '@nestjs/jwt';
import { CloudinaryService } from '../chat/cloudinary.service';
import { FirebaseService } from '../chat/firebase.service';
import { HttpModule } from '@nestjs/axios'; 
@Module({
  imports: [
    TypeOrmModule.forFeature([Message]),
    JwtModule.register({}),
    HttpModule
  ],
  controllers: [ChatbotController],
  providers: [ChatbotService, CloudinaryService, FirebaseService],
  exports: [ChatbotService],
})
export class ChatbotModule {}
