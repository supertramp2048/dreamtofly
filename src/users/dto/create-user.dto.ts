import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, Length } from 'class-validator'

export class CreateUserDto {    
  @ApiProperty({ 
    description: 'User name',
    example: 'John Doe' 
  })
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ 
    description: 'User email (unique)',
    example: 'john@example.com' 
  })
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @ApiProperty({ 
    description: 'Password (minimum 8 characters)',
    example: 'Password123'
  })
  @IsNotEmpty()
  @Length(8)
  password!: string;
}
