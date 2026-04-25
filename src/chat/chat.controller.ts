import { Controller, Get, Post, Body, Patch, Param, Delete, Req, UnauthorizedException, UseInterceptors, UploadedFiles } from '@nestjs/common';
import { ChatService } from './chat.service';
import { CreateChatDto } from './dto/create-chat.dto';
import { UpdateChatDto } from './dto/update-chat.dto';
import type Request from 'express';
import { GetUser } from 'src/customeDecorator/getUser.decorator';
import { User } from 'src/users/entities/user.entity';
import { FilesInterceptor } from '@nestjs/platform-express';
import { BadRequestException } from '@nestjs/common';
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) { }

  @Post()
  create(@Body() createChatDto: CreateChatDto) {
    return this.chatService.create(createChatDto);
  }

  @Get()
  findAll() {
    return this.chatService.findAll();
  }

  @Get('conversations')
  getConversations(@GetUser() user: any) {
    const userId = user.userId
    if (!userId) {
      throw new UnauthorizedException('Missing user in request');
    }
    return this.chatService.getConversationsByUserId(userId);
  }

  @Get('conversations/:conversationId/messages')
  getConversationMessages(
    @GetUser() user: any,
    @Param('conversationId') conversationId: string,
  ) {
    const userId = user.userId
    if (!userId) {
      throw new UnauthorizedException('Missing user in request');
    }
    return this.chatService.getMessagesByConversationId(userId, conversationId);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateChatDto: UpdateChatDto) {
    return this.chatService.update(+id, updateChatDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.chatService.remove(+id);
  }

  @Post('upload')
  @UseInterceptors(FilesInterceptor('files'))
  async uploadFile(
    // 2. Đảm bảo dùng @UploadedFiles() có chữ "s", không dùng @UploadedFile()
    @UploadedFiles() files: Array<Express.Multer.File>
  ) {

    // 3. THÊM DÒNG NÀY: Kiểm tra an toàn trước khi gọi Service
    if (!files || files.length === 0) {
      throw new BadRequestException('Không tìm thấy tệp đính kèm. Vui lòng kiểm tra lại form-data.');
    }

    // Nếu qua được đoạn if trên, chắc chắn files là một mảng có thể dùng .map()
    return await this.chatService.uploadMixedFiles(files);
  }
}
