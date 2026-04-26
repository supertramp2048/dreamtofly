import { Controller, Get, Res, Post, Body, Patch, Param, Delete, Req, UnauthorizedException, UseInterceptors, UploadedFiles, Query, Sse, MessageEvent } from '@nestjs/common';
import { ChatbotService } from './chatbot.service';
import { CreateChatbotDto } from './dto/create-chatbot.dto';
import { UpdateChatbotDto } from './dto/update-chatbot.dto';
import { GetUser } from 'src/customeDecorator/getUser.decorator';
import { PageOptionsDto } from 'src/common/pagination/dto/pageOption.dto';
import { interval, map, fromEvent, Observable } from 'rxjs';
import type { Response } from 'express';
import { tryCatch } from 'bullmq';
@Controller('chatbot')
export class ChatbotController {
  constructor(private readonly chatbotService: ChatbotService) { }

  @Post()
  create(@Body() createChatbotDto: CreateChatbotDto) {
    return this.chatbotService.create(createChatbotDto);
  }

  @Get()
  findAll() {
    return this.chatbotService.findAll();
  }

  @Get('getById/:id')
  findOne(@Param('id') id: string) {
    return this.chatbotService.findOne(+id);
  }

  @Patch('update/:id')
  update(@Param('id') id: string, @Body() updateChatbotDto: UpdateChatbotDto) {
    return this.chatbotService.update(+id, updateChatbotDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.chatbotService.remove(+id);
  }

  @Get('messages')
  getUserMessages(
    @GetUser() user: any,
    @Query() pageOptionsDto: PageOptionsDto,
  ) {
    const userId = user.userId
    if (!userId) {
      throw new UnauthorizedException('Missing user in request');
    }
    return this.chatbotService.getMessagesByUserId(userId, pageOptionsDto);
  }

  @Post('stream')
  async streamAiPost(@Body('prompt') prompt: string, @Res() res: Response) {
    try {
      console.log("send promt ", prompt);

      // Thiết lập Header bắt buộc của giao thức SSE
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders(); // Gửi header ngay lập tức tránh timeout

      const stream = await this.chatbotService.getAiStream(prompt);

      // Kiểm tra nhỡ service trả về null/undefined gây lỗi stream.on
      if (!stream) {
        console.error("Stream không được khởi tạo từ service!");
        return res.status(500).json({ error: "Không thể kết nối với AI provider." });
      }

      // ✅ Xử lý khi CLIENT đóng kết nối (tab đóng, refresh trang)
      // Đây là nguyên nhân chính gây ECONNRESET
      res.on('close', () => {
        console.log('Client đã ngắt kết nối, huỷ stream từ AI...');
        stream.destroy(); // Dừng stream upstream tránh lãng phí tài nguyên
      });

      // Ghi từng luồng dữ liệu trả thẳng về client
      stream.on('data', (chunk) => {
        // Kiểm tra client còn kết nối không trước khi ghi
        if (!res.writableEnded) {
          res.write(`data: ${chunk.toString()}\n\n`);
        }
      });

      stream.on('end', () => {
        if (!res.writableEnded) {
          res.end();
        }
      });

      stream.on('error', (err) => {
        // ECONNRESET từ Ngrok/client disconnect - không phải lỗi thật sự
        if ((err as any).code === 'ECONNRESET') {
          console.warn('Stream bị ngắt (ECONNRESET) - có thể client đã đóng kết nối hoặc Ngrok timeout.');
        } else {
          console.error("Lỗi từ sự kiện stream:", err);
        }
        if (!res.writableEnded) {
          res.end();
        }
      });

    } catch (error) {
      console.error("Lỗi bắt được ở catch:", error);

      // Phải tự trả về response khi dùng @Res()
      if (!res.headersSent) {
        res.status(500).json({
          error: "Internal Server Error",
          details: error || "Lỗi không xác định"
        });
      } else {
        res.end();
      }
    }
  }
}
