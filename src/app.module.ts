import { Inject, Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule,ConfigService } from '@nestjs/config';
import configuration from './config/configuration';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { AuthSessionModule } from './auth-session/auth-session.module';
import { AuthGuard } from './guards/auth.guard';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ChatModule } from './chat/chat.module';
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService ) => {
        return {
          type : 'postgres',
          host: config.get('databaseConf.host'),
          port: Number(config.get('databaseConf.port')),
          username: config.get('databaseConf.username'),
          password: config.get('databaseConf.password'),
          database: config.get('databaseConf.databaseName'),
          autoLoadEntities: true,
          synchronize: true,
        }
      }
     }
    ),
    UsersModule,
    AuthModule,
    AuthSessionModule,
    JwtModule,
    ChatModule

],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: AuthGuard
    }
  ],
})
export class AppModule {
  constructor(private dataSource: DataSource){}
}
