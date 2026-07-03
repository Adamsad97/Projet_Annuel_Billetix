import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // À venir : PdfGeneratorModule (Puppeteer), MinioModule (upload S3)
  ],
})
export class AppModule {}
