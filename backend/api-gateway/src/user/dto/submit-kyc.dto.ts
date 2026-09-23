import { ApiProperty } from "@nestjs/swagger";
import { IsUrl } from "class-validator";

export class SubmitKycDto {
  // require_tld: false — document hébergé sur MinIO, localhost en dev.
  @ApiProperty({ example: "https://minio.billetix.local/documents/kbis.pdf" })
  @IsUrl({ require_tld: false })
  document_url: string;
}
