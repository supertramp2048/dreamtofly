import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';
import * as streamifier from 'streamifier';

@Injectable()
export class CloudinaryService {
  constructor(private readonly configService: ConfigService) {
    // Nên đưa các key này vào file .env trong dự án thực tế
    cloudinary.config({
      cloud_name: this.configService.get('CLOUDINARY_CLOUD_NAME'),
      api_key: this.configService.get('CLOUDINARY_API_KEY'),
      api_secret: this.configService.get('CLOUDINARY_API_SECRET'),
    });
  }

  // Hàm upload nhận file từ Multer
  uploadImage(file: Express.Multer.File): Promise<any> {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { folder: 'nestjs_uploads' }, // Tùy chọn thư mục trên Cloudinary
        (error, result) => {
          if (error) return reject(error);
          resolve(result);
        },
      );

      // Chuyển file.buffer thành stream và pipe vào Cloudinary
      streamifier.createReadStream(file.buffer).pipe(uploadStream);
    });
  }

  uploadFiles(file: Express.Multer.File): Promise<any> {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'nestjs_uploads',
          resource_type: 'raw',
          public_id: file.originalname // Bắt buộc thêm dòng này để giữ đuôi file (.docx, .pdf...)
        },
        (error, result) => {
          if (error) return reject(error);
          resolve(result);
        },
      );

      streamifier.createReadStream(file.buffer).pipe(uploadStream);
    });
  }
}