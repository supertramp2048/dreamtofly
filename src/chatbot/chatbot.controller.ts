import { Controller, Get, Post, Body, Patch, Param, Delete, Req, UnauthorizedException, UseInterceptors, UploadedFiles, Query } from '@nestjs/common';
import { ChatbotService } from './chatbot.service';
import { CreateChatbotDto } from './dto/create-chatbot.dto';
import { UpdateChatbotDto } from './dto/update-chatbot.dto';
import { GetUser } from 'src/customeDecorator/getUser.decorator';
import { PageOptionsDto } from 'src/common/pagination/dto/pageOption.dto';
@Controller('chatbot')
export class ChatbotController {
  constructor(private readonly chatbotService: ChatbotService) {}

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
}
