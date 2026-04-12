import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UsersService } from 'src/users/users.service';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { StringValue } from 'ms';
import { UsersModule } from 'src/users/users.module';
import { AuthSessionModule } from 'src/auth-session/auth-session.module';

@Module({
  imports: [
    UsersModule,
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('jwt.JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get<StringValue>('jwt.JWT_ACCESS_EXPIRES'),
        },
      }),
    }),
    AuthSessionModule
  ],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService]
})
export class AuthModule {}
