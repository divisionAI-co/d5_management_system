import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class UpdateDriveFileDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;
}



