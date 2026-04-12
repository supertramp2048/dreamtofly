import { Module } from '@nestjs/common';
import { AuthSessionService } from './auth-session.service';
import { AuthSessionController } from './auth-session.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthSession } from './entities/auth-session.entity';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [
    TypeOrmModule.forFeature([AuthSession]),
    JwtModule
  ],
  controllers: [AuthSessionController],
  providers: [AuthSessionService],
  exports: [AuthSessionService]
})
export class AuthSessionModule {}
