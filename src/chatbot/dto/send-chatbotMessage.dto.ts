import { IsString,ValidateIf , IsNotEmpty } from 'class-validator';

export class SendMessageDto {
  @ValidateIf(o => !o.fileUrl)
  @IsNotEmpty({ message: 'Phải nhập nội dung tin nhắn hoặc đính kèm file' })
  @IsString()
  content?: string;
 
  @ValidateIf(o => !o.content)
  @IsNotEmpty({ message: 'Phải nhập nội dung tin nhắn hoặc đính kèm file' })
  @IsString()
  fileUrl?: string;
}