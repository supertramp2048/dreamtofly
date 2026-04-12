import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { AuthSessionService } from './auth-session.service';
import { CreateAuthSessionDto } from './dto/create-auth-session.dto';
import { UpdateAuthSessionDto } from './dto/update-auth-session.dto';
import { PageOptionsDto } from 'src/common/pagination/dto/pageOption.dto';

@Controller('auth-session')
export class AuthSessionController {
  constructor(private readonly authSessionService: AuthSessionService) {}

  @Post()
  create(@Body() createAuthSessionDto: CreateAuthSessionDto) {
    return this.authSessionService.create(createAuthSessionDto);
  }

  @Get('all')
  findAll(@Query() pageOptionDto: PageOptionsDto) {
    return this.authSessionService.findAll(pageOptionDto);
  }

  @Get(':sid')
  findOne(@Param('sid') sid: string) {
    return this.authSessionService.findOne(sid);
  }

  @Patch(':sid')
  update(@Param('sid') sid: string) {
    return this.authSessionService.update(sid);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.authSessionService.remove(+id);
  }
}
