import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';
import * as path from 'path';

@Injectable()
export class FirebaseService {
  private storage: admin.storage.Storage;
  private bucketName: string;

  // 1. Tiêm ConfigService vào thông qua tham số của constructor
  constructor(private configService: ConfigService) {
    
    // 2. Lấy biến môi trường BÊN TRONG constructor
    const prjId = this.configService.get<string>('FIREBASE_PROJECT_ID');
    this.bucketName = `${prjId}.appspot.com`;

    if (!admin.apps.length) {
      // Sử dụng đường dẫn tuyệt đối để tránh lỗi khi build ra thư mục dist
      const keyPath = path.join(process.cwd(), 'serviceAccountKey.json');
      const serviceAccount = require(keyPath); 
      
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        storageBucket: this.bucketName,
      });
    }
    this.storage = admin.storage();
  }

  async uploadFile(file: Express.Multer.File): Promise<string> {
    const bucket = this.storage.bucket();
    const fileName = `${Date.now()}_${file.originalname}`; 
    const fileUpload = bucket.file(fileName);

    await fileUpload.save(file.buffer, {
      metadata: {
        contentType: file.mimetype,
      },
    });

    await fileUpload.makePublic();

    return `https://storage.googleapis.com/${this.bucketName}/${fileName}`;
  }
}