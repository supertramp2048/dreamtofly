
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
import { HttpService } from '@nestjs/axios';
import { Observable, timeout } from 'rxjs';
import { ConfigService } from '@nestjs/config';
@Injectable()
export class ChatbotService {
  constructor(
    @InjectRepository(Message)
    private readonly messageRepo: Repository<Message>,
    private readonly cloudinaryService: CloudinaryService,
    private readonly fireBaseService: FirebaseService,
    // Inject JwtService để dùng cho Socket
    private readonly httpService: HttpService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService
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

  async getAiStream(prompt: string) {
    try {
      const apiUrl = this.config.get('ngrokUrl');
      
      const response = await this.httpService.axiosRef.post(
        `${apiUrl}/chat/stream`,
        { 
          message: prompt,
          options: { temperature: 0, num_predict: 2048 }
          // Đã xóa timeout ở đây vì đây là dữ liệu gửi đi
        },
        { 
          responseType: 'stream', 
          timeout: 300000, // Cấu hình Axios chờ tối đa 5 phút (LLM có thể chạy lâu)
          headers: { 
            'ngrok-skip-browser-warning': '69420',
            'Content-Type': 'application/json'
          }
        }
      );
      
      return response.data;
      
    } catch (error) {
      // In ra lỗi chi tiết từ Axios
      console.error("Lỗi Axios tại getAiStream:", error);
      
      // Ném lại chính object error gốc để Controller bắt và xử lý
      throw error; 
    }
  }
}
