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
import { PassThrough } from 'stream';

//import { Observable, timeout } from 'rxjs';
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
    private readonly config: ConfigService,
  ) {}

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
    const queryBuilder = this.messageRepo // Lưu ý: không cần 'await' ở createQueryBuilder
      .createQueryBuilder('message')
      .leftJoinAndSelect('message.sender', 'sender')
      .where('message.senderId = :userId', { userId })
      .orWhere('message.receiverId = :userId', { userId })
      // Thêm dòng này để đọc tham số order từ Frontend truyền lên
      .orderBy(
        `message.${pageOptionsDto.orderBy || 'createdAt'}`,
        pageOptionsDto.order || 'DESC',
      );

    return paginate(queryBuilder, pageOptionsDto, 'message');
  }
  async saveMessage(
    senderId: string,
    receiverId: string,
    payload: SendMessageDto,
  ) {
    if (!payload.content && !payload.fileUrl) {
      throw new BadRequestException(
        'Phải nhập nội dung tin nhắn hoặc đính kèm file',
      );
    }

    // 1. LƯU TIN NHẮN
    const newMessage = this.messageRepo.create({
      senderId,
      receiverId,
      content: payload.content ?? null,
      fileUrl: payload.fileUrl ?? null,
    });
    const savedMessage = await this.messageRepo.save(newMessage);
    console.log('da luu message ', savedMessage);

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
        receiver: { id: true, name: true },
      },
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
        return this.cloudinaryService.uploadImage(file).then((res) => ({
          type: 'image',
          name: file.originalname,
          url: res.secure_url,
        }));
      } else {
        // Nếu là file khác (PDF, Doc...) -> Đẩy lên Firebase
        return this.cloudinaryService.uploadFiles(file).then((res) => ({
          type: 'document',
          name: file.originalname,
          url: res.secure_url,
        }));
      }
    });

    // Chạy song song tất cả các tác vụ
    const results = await Promise.all(uploadTasks);
    return results;
  }

  async getAiStream(prompt: string, senderId?: string): Promise<PassThrough> {
    const passThrough = new PassThrough();
    const apiUrl: string = this.config.get('ngrokUrl');

    let response: Response;
    try {
      response = await fetch(`${apiUrl}/chat/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
          'Cache-Control': 'no-cache',
        },
        body: JSON.stringify({
          message: prompt,
          ...(senderId ? { senderId } : {}),
        }),
      });
    } catch (err) {
      passThrough.destroy(
        new Error(`Không kết nối được tới AI server: ${err}`),
      );
      return passThrough;
    }

    if (!response.ok || !response.body) {
      let errorBody = '';
      try {
        errorBody = await response.text();
      } catch (readError) {
        errorBody = `Không đọc được body lỗi: ${readError}`;
      }
      console.error(
        `AI server lỗi: HTTP ${response.status} ${response.statusText} | Body: ${errorBody}`,
      );
      passThrough.destroy(
        new Error(
          `AI server lỗi: HTTP ${response.status} ${response.statusText} | Body: ${errorBody}`,
        ),
      );
      return passThrough;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    (async () => {
      let lineBuffer = ''; // buffer dòng SSE chưa hoàn chỉnh
      let wordBuffer = ''; // buffer từ đang gom dở

      const flushWord = () => {
        if (wordBuffer) {
          passThrough.write(wordBuffer);
          wordBuffer = '';
        }
      };

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          lineBuffer += decoder.decode(value, { stream: true });
          const lines = lineBuffer.split('\n');
          lineBuffer = lines.pop() ?? '';

          for (const line of lines) {
            let lineText = line;
            if (lineText.endsWith('\r')) {
              lineText = lineText.slice(0, -1);
            }
            if (!lineText.startsWith('data:')) continue;

            let token = lineText.slice(5); // bỏ "data:"
            if (token.startsWith(' ')) {
              token = token.slice(1); // bỏ 1 space sau dấu ':' nếu có
            }
            if (token === '[DONE]') {
              flushWord();
              continue;
            }
            if (token === '') {
              // Dòng data rỗng biểu diễn xuống dòng trong SSE
              flushWord();
              passThrough.write('\n');
              continue;
            }

            if (token.startsWith(' ')) {
              // Token bắt đầu bằng space → từ mới → flush từ cũ trước
              flushWord();
              wordBuffer = token; // giữ nguyên space ở đầu
            } else {
              // Token không có space → ghép tiếp vào từ hiện tại
              wordBuffer += token;
            }
          }
        }

        // Flush nốt phần còn lại
        flushWord();
      } catch (err) {
        passThrough.destroy(
          err instanceof Error ? err : new Error(String(err)),
        );
      } finally {
        passThrough.end();
      }
    })();

    return passThrough;
  }
}
