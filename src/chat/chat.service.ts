
import { CreateChatDto } from './dto/create-chat.dto';
import { UpdateChatDto } from './dto/update-chat.dto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt'; // Khai báo JwtService để verify token
import { Conversation, ConversationType } from './entities/conversation.entity';
import { Participant, ParticipantRole } from './entities/participant.entity';
import { Message } from './entities/message.entity';
import { BadRequestException } from '@nestjs/common';
import { SendMessageDto } from './dto/send-message.dto';
@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(Conversation)
    private readonly conversationRepo: Repository<Conversation>,
    @InjectRepository(Participant)
    private readonly participantRepo: Repository<Participant>,
    @InjectRepository(Message)
    private readonly messageRepo: Repository<Message>,

    // Inject JwtService để dùng cho Socket
    private readonly jwtService: JwtService,
  ) { }

  async verifyUserToken(token: string): Promise<string> {
    try {
      const cleanToken = token.replace('Bearer ', '');
      const payload = this.jwtService.verify(cleanToken, {
        secret: process.env.JWT_SECRET,
      });

      return payload.userId;
    } catch (error) {
      throw new UnauthorizedException('Token không hợp lệ hoặc đã hết hạn');
    }
  }
  create(createChatDto: CreateChatDto) {
    return 'This action adds a new chat';
  }

  findAll() {
    return `This action returns all chat`;
  }

  findOne(id: number) {
    return `This action returns a #${id} chat`;
  }

  update(id: number, updateChatDto: UpdateChatDto) {
    return `This action updates a #${id} chat`;
  }

  remove(id: number) {
    return `This action removes a #${id} chat`;
  }
  async getUserConversationIds(userId: string): Promise<string[]> {
    const participants = await this.participantRepo.find({
      where: { userId },
      select: ['conversationId'],
    });

    return participants.map(p => p.conversationId.toString());
  }

  async getConversationsByUserId(userId: string) {
    return await this.conversationRepo.createQueryBuilder('conversation')
      .innerJoin('conversation.participants', 'participant', 'participant.userId = :userId', { userId })
      .leftJoinAndSelect('conversation.participants', 'participants')
      .leftJoinAndSelect('conversation.messages', 'messages')
      .orderBy('conversation.updatedAt', 'DESC')
      .getMany();
  }
  async saveMessage(senderId: string, payload: SendMessageDto) {
    let conversationId = payload.conversationId;
    let isNewConversation = false;

    // 1. NẾU CHƯA CÓ CONVERSATION ID -> TỰ ĐỘNG TẠO PHÒNG 1-1
    if (!conversationId) {
      if (!payload.receiverId) {
        throw new BadRequestException('Phải cung cấp conversationId hoặc receiverId');
      }

      // Tái sử dụng hàm tạo phòng chat 1-1 bạn đã viết
      const conversation = await this.createDirectConversation(senderId, payload.receiverId);
      conversationId = conversation.id;
      isNewConversation = true; // Đánh dấu là phòng mới
    } else {
      // 2. NẾU ĐÃ CÓ -> KIỂM TRA QUYỀN
      const isMember = await this.participantRepo.findOne({
        where: { userId: senderId, conversationId },
      });
      if (!isMember) {
        throw new BadRequestException('Bạn không có quyền gửi tin nhắn vào phòng này');
      }
    }

    // 3. LƯU TIN NHẮN
    const newMessage = this.messageRepo.create({
      senderId,
      conversationId,
      content: payload.content,
    });
    const savedMessage = await this.messageRepo.save(newMessage);

    const fullMessageInfo = await this.messageRepo.findOne({
      where: { id: savedMessage.id },
      relations: ['sender'],
      select: { id: true, content: true, createdAt: true, conversationId: true, sender: { id: true, name: true } }
    });

    // Trả về thêm cờ isNewConversation để Gateway biết đường xử lý
    return {
      message: fullMessageInfo,
      isNewConversation,
      conversationId,
      receiverId: payload.receiverId,
    };
  }
  /**
   * 4. API Tạo cuộc hội thoại 1-1
   */
  async createDirectConversation(user1Id: string, user2Id: string) {

    const existingConversation = await this.conversationRepo.createQueryBuilder('c')
      .innerJoin('c.participants', 'p1', 'p1.userId = :user1Id', { user1Id })
      .innerJoin('c.participants', 'p2', 'p2.userId = :user2Id', { user2Id })
      .where('c.type = :type', { type: ConversationType.DIRECT })
      .getOne();

    if (existingConversation) {
      return existingConversation;
    }

    const newConversation = await this.conversationRepo.save(
      this.conversationRepo.create({ type: ConversationType.DIRECT })
    );

    await this.participantRepo.save([
      this.participantRepo.create({ conversationId: newConversation.id, userId: user1Id }),
      this.participantRepo.create({ conversationId: newConversation.id, userId: user2Id })
    ]);

    return newConversation;
  }
}
