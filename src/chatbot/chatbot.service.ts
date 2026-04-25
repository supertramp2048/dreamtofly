
import { UpdateChatbotDto } from './dto/update-chatbot.dto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt'; // Khai báo JwtService để verify token
import { Message } from './entities/chatbotMessage.entities';
import { BadRequestException } from '@nestjs/common';
import { SendMessageDto } from './dto/send-chatbotMessage.dto';
import { CloudinaryService } from '../chat/cloudinary.service';
import { FirebaseService } from '../chat/firebase.service';
import { CreateChatbotDto } from './dto/create-chatbot.dto';
import { PageOptionsDto } from 'src/common/pagination/dto/pageOption.dto';
import { paginate } from 'src/common/pagination/helper/pagination.helper';
import { log } from 'util';
@Injectable()
export class ChatbotService {
  constructor(
    @InjectRepository(Message)
    private readonly messageRepo: Repository<Message>,
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
  
  create(createChatDto: CreateChatbotDto) {
      return 'This action adds a new chat';
    }
  findAll() {
    return `This action returns all chat`;
  }

  findOne(id: number) {
    return `This action returns a #${id} chat`;
  }

  update(id: number, updateChatDto: UpdateChatbotDto) {
    return `This action updates a #${id} chat`;
  }

  remove(id: number) {
    return `This action removes a #${id} chat`;
  }
  async getMessagesByUserId(userId: string, pageOptionsDto: PageOptionsDto) {
    const queryBuilder = await this.messageRepo
      .createQueryBuilder('message')
      .leftJoinAndSelect('message.sender', 'sender')
      .where('message.senderId = :userId', { userId })
      .orWhere('message.receiverId = :userId', {userId});
    
    console.log(queryBuilder);
    
    return paginate(queryBuilder, pageOptionsDto, 'message');
  }
  async saveMessage(senderId: string, receiverId: string, payload: SendMessageDto) {
    if (!payload.content && !payload.fileUrl) {
      throw new BadRequestException('Phải nhập nội dung tin nhắn hoặc đính kèm file');
    }

    // 1. LƯU TIN NHẮN
    const newMessage = this.messageRepo.create({
      senderId,
      receiverId,
      content: payload.content ?? null,
      fileUrl: payload.fileUrl ?? null,
    });
    const savedMessage = await this.messageRepo.save(newMessage);

    const fullMessageInfo = await this.messageRepo.findOne({
      where: { id: savedMessage.id },
      relations: ['sender'],
      select: {
        id: true,
        content: true,
        fileUrl: true,
        createdAt: true,
        senderId: true,
        sender: { id: true, name: true },
        receiverId: true,
        receiver:{ id: true, name: true},

      }
    });

    return {
      message: fullMessageInfo,
    };
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
