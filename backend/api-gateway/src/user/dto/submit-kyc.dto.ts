import { ApiProperty } from "@nestjs/swagger";
import { IsUrl } from "class-validator";

export class SubmitKycDto {
  @ApiProperty({ example: "https://minio.billetix.local/documents/kbis.pdf" })
  @IsUrl()
  document_url: string;
}
