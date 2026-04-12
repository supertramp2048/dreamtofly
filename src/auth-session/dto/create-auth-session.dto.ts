import { IsNotEmpty } from "class-validator";

export class CreateAuthSessionDto {

    @IsNotEmpty()
    userId: string

    @IsNotEmpty()
    email: string
}
