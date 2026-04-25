
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
import { CloudinaryService } from './cloudinary.service';
import { FirebaseService } from './firebase.service';
import { User } from 'src/users/entities/user.entity';
@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(Conversation)
    private readonly conversationRepo: Repository<Conversation>,
    @InjectRepository(Participant)
    private readonly participantRepo: Repository<Participant>,
    @InjectRepository(Message)
    private readonly messageRepo: Repository<Message>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly cloudinaryService: CloudinaryService,
    private readonly fireBaseService: FirebaseService,
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
    const conversations = await this.conversationRepo.createQueryBuilder('conversation')
      .innerJoin('conversation.participants', 'participant', 'participant.userId = :userId', { userId })
      .leftJoinAndSelect('conversation.participants', 'participants')
      .leftJoinAndSelect('participants.user', 'participantUser')
      .orderBy('conversation.updatedAt', 'DESC')
      .getMany();

    return conversations.map(conversation => ({
      ...conversation,
      participants: this.mapParticipants(conversation.participants),
    }));
  }

  async getMessagesByConversationId(userId: string, conversationId: string) {
    const isMember = await this.participantRepo.findOne({
      where: { userId, conversationId },
      select: ['id'],
    });
    if (!isMember) {
      throw new BadRequestException('Bạn không có quyền xem tin nhắn trong phòng này');
    }

    const messages = await this.messageRepo.find({
      where: { conversationId },
      relations: ['sender'],
      select: {
        id: true,
        content: true,
        fileUrl: true,
        createdAt: true,
        conversationId: true,
        senderId: true,
        sender: { id: true, name: true },
      },
      order: { createdAt: 'DESC' },
    });

    return { data: messages };
  }
  async saveMessage(senderId: string, payload: SendMessageDto) {
    let conversationId = payload.conversationId;
    let isNewConversation = false;

    if (!payload.content && !payload.fileUrl) {
      throw new BadRequestException('Phải nhập nội dung tin nhắn hoặc đính kèm file');
    }

    // 1. NẾU CHƯA CÓ CONVERSATION ID -> TỰ ĐỘNG TẠO PHÒNG 1-1
    if (!conversationId) {
      if (!payload.receiverId) {
        throw new BadRequestException('Phải cung cấp conversationId hoặc receiverId');
      }
      if (payload.receiverId === senderId) {
        throw new BadRequestException('Không thể nhắn tin cho chính mình');
      }

      const receiverExists = await this.userRepo.findOne({
        where: { id: payload.receiverId },
        select: ['id'],
      });
      if (!receiverExists) {
        throw new BadRequestException('Người nhận không tồn tại');
      }

      // Tái sử dụng hàm tạo phòng chat 1-1 bạn đã viết
      const { conversation, created } = await this.createDirectConversation(
        senderId,
        payload.receiverId,
      );
      conversationId = conversation.id;
      isNewConversation = created;
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
      content: payload.content ?? null,
      fileUrl: payload.fileUrl ?? null,
    });
    const savedMessage = await this.messageRepo.save(newMessage);

    const lastMessagePreview = payload.content
      ? payload.content
      : payload.fileUrl
        ? '[file]'
        : null;

    await this.conversationRepo.update(
      { id: conversationId },
      {
        lastMessageId: savedMessage.id,
        lastMessage: lastMessagePreview,
        lastMessageAt: savedMessage.createdAt ?? new Date(),
      },
    );

    const fullMessageInfo = await this.messageRepo.findOne({
      where: { id: savedMessage.id },
      relations: ['sender'],
      select: {
        id: true,
        content: true,
        fileUrl: true,
        createdAt: true,
        conversationId: true,
        senderId: true,
        sender: { id: true, name: true }
      }
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
    const directKey = this.buildDirectKey(user1Id, user2Id);

    return this.conversationRepo.manager.transaction(async (manager) => {
      const conversationRepo = manager.getRepository(Conversation);
      const participantRepo = manager.getRepository(Participant);

      let existingConversation = await conversationRepo.findOne({
        where: { directKey },
      });

      if (!existingConversation) {
        existingConversation = await conversationRepo
          .createQueryBuilder('c')
          .innerJoin('c.participants', 'p1', 'p1.userId = :user1Id', { user1Id })
          .innerJoin('c.participants', 'p2', 'p2.userId = :user2Id', { user2Id })
          .where('c.type = :type', { type: ConversationType.DIRECT })
          .getOne();

        if (existingConversation) {
          if (!existingConversation.directKey) {
            existingConversation.directKey = directKey;
            await conversationRepo.save(existingConversation);
          }
          return { conversation: existingConversation, created: false };
        }
      } else {
        return { conversation: existingConversation, created: false };
      }

      let newConversation: Conversation;
      try {
        newConversation = await conversationRepo.save(
          conversationRepo.create({
            type: ConversationType.DIRECT,
            directKey,
          }),
        );
      } catch (error) {
        if (this.isUniqueViolation(error)) {
          const existing = await conversationRepo.findOne({ where: { directKey } });
          if (existing) {
            return { conversation: existing, created: false };
          }
        }
        throw error;
      }

      await participantRepo.save([
        participantRepo.create({ conversationId: newConversation.id, userId: user1Id }),
        participantRepo.create({ conversationId: newConversation.id, userId: user2Id }),
      ]);

      return { conversation: newConversation, created: true };
    });
  }

  private buildDirectKey(user1Id: string, user2Id: string): string {
    const [first, second] = this.sortUserIds(user1Id, user2Id);
    return `direct:${first}:${second}`;
  }

  private sortUserIds(user1Id: string, user2Id: string): [string, string] {
    try {
      return BigInt(user1Id) <= BigInt(user2Id)
        ? [user1Id, user2Id]
        : [user2Id, user1Id];
    } catch {
      return user1Id <= user2Id ? [user1Id, user2Id] : [user2Id, user1Id];
    }
  }

  private isUniqueViolation(error: unknown): boolean {
    const err = error as { code?: string };
    return (
      err?.code === '23505' ||
      err?.code === 'ER_DUP_ENTRY' ||
      err?.code === 'SQLITE_CONSTRAINT' ||
      err?.code === '2601' ||
      err?.code === '2627'
    );
  }

  async buildConversationPayloadForUser(
    conversationId: string,
    viewerId: string,
    lastMessageContent: string | null,
  ) {
    const conversation = await this.conversationRepo.findOne({
      where: { id: conversationId },
      select: ['id', 'lastMessage'],
    });
    if (!conversation) {
      throw new BadRequestException('Conversation không tồn tại');
    }

    const participants = await this.participantRepo.find({
      where: { conversationId },
      relations: ['user'],
    });
    const otherParticipant = participants.find(p => p.userId !== viewerId);
    const otherUser = otherParticipant?.user;
    const mappedParticipants = this.mapParticipants(participants);

    return {
      id: conversationId,
      receiverId: otherUser?.id ?? '',
      name: otherUser?.name ?? '',
      avatar: otherUser?.id ? `https://i.pravatar.cc/48?u=${otherUser.id}` : '',
      participants: mappedParticipants,
      lastMessage: { content: conversation.lastMessage ?? lastMessageContent },
    };
  }

  private mapParticipants(participants: Participant[]) {
    return (participants ?? []).map(participant => ({
      id: participant.userId,
      name: participant.user?.name ?? '',
      avatar: `https://i.pravatar.cc/48?u=${participant.userId}`,
    }));
  }

  async uploadMixedFiles(files: Array<Express.Multer.File>) {
    // Tạo danh sách các tác vụ (Promises) dựa trên loại file
    const uploadTasks = files.map((file) => {
      if (file.mimetype.startsWith('image/')) {
        // Nếu là ảnh -> Đẩy lên Cloudinary
        return this.cloudinaryService.uploadImage(file).then(res => ({
          type: 'image',
          name: file.originalname,
          url: res.secure_url
        }));
      } else {
        // Nếu là file khác (PDF, Doc...) -> Đẩy lên Firebase
        return this.cloudinaryService.uploadFiles(file).then(res => ({
          type: 'document',
          name: file.originalname,
          url: res.secure_url
        }));
      }
    });

    // Chạy song song tất cả các tác vụ
    const results = await Promise.all(uploadTasks);
    return results;
  }
}
