import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { ClassSerializerInterceptor, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import cookieParser from 'cookie-parser'
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Enable CORS
  app.enableCors({
    origin: 'http://localhost:5173', // Bắt buộc phải trỏ chính xác đến URL của frontend
    credentials: true,
  });
  
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,  // ← Thêm dòng này
    forbidNonWhitelisted: true
  }),  
)
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)))
  
  // Swagger configuration
  const config = new DocumentBuilder()
    .setTitle('Clean House Booking API')
    .setDescription('API documentation for Clean House Booking')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);
  
  const configService = app.get(ConfigService);
  const port = configService.get('port')
  app.use(cookieParser())
  await app.listen(port);
}
bootstrap();
