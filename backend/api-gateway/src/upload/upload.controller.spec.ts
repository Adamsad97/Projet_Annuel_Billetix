import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { UploadController } from "./upload.controller";
import { detectFileType } from "./file-signature";

const OWNER = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const FILE = "33333333-3333-4333-8333-333333333333.pdf";

const pdf = Buffer.from("%PDF-1.7\n1 0 obj\n");
const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const html = Buffer.from("<html><script>alert(1)</script></html>");

const file = (buffer: Buffer, mimetype: string) =>
  ({ buffer, mimetype, originalname: "x" }) as Express.Multer.File;

describe("detectFileType", () => {
  it("reconnaît les formats par leur contenu", () => {
    expect(detectFileType(pdf)).toBe("application/pdf");
    expect(detectFileType(png)).toBe("image/png");
    expect(detectFileType(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]))).toBe("image/jpeg");
    expect(detectFileType(Buffer.from("RIFF\0\0\0\0WEBPVP8 "))).toBe("image/webp");
    expect(detectFileType(html)).toBeNull();
  });
});

describe("UploadController", () => {
  let uploads: { upload: jest.Mock; readObject: jest.Mock; documentsBucket: string };
  let controller: UploadController;
  let res: { set: jest.Mock; send: jest.Mock };

  beforeEach(() => {
    uploads = {
      upload: jest.fn().mockResolvedValue("http://minio/documents/k"),
      readObject: jest.fn().mockResolvedValue({ body: pdf, contentType: "text/html" }),
      documentsBucket: "documents",
    };
    const config = { get: (_k: string, d: string) => d };
    controller = new UploadController(uploads as any, config as any);
    res = { set: jest.fn(), send: jest.fn() };
  });

  it("range un document dans le bucket privé, au nom du propriétaire", async () => {
    await controller.uploadDocument({ sub: OWNER } as any, file(pdf, "application/pdf"));
    expect(uploads.upload).toHaveBeenCalledWith(pdf, ".pdf", "documents", "application/pdf", "private", OWNER);
  });

  it("refuse un fichier HTML déguisé, quel que soit le type annoncé", async () => {
    await expect(controller.uploadDocument({ sub: OWNER } as any, file(html, "application/pdf"))).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(controller.uploadPoster(file(html, "image/png"))).rejects.toBeInstanceOf(BadRequestException);
    expect(uploads.upload).not.toHaveBeenCalled();
  });

  it("refuse un PDF comme affiche", async () => {
    await expect(controller.uploadPoster(file(pdf, "image/png"))).rejects.toBeInstanceOf(BadRequestException);
  });

  it("sert le document à son propriétaire, avec le type déduit du contenu", async () => {
    await controller.getDocument({ sub: OWNER, role: "ORGANIZER" } as any, OWNER, FILE, res as any);
    expect(uploads.readObject).toHaveBeenCalledWith("documents", `${OWNER}/${FILE}`);
    expect(res.set).toHaveBeenCalledWith(
      expect.objectContaining({ "Content-Type": "application/pdf", "X-Content-Type-Options": "nosniff" }),
    );
    expect(res.send).toHaveBeenCalledWith(pdf);
  });

  it("sert le document à un admin", async () => {
    await controller.getDocument({ sub: OTHER, role: "ADMIN" } as any, OWNER, FILE, res as any);
    expect(res.send).toHaveBeenCalled();
  });

  it("refuse le document à un autre organisateur", async () => {
    await expect(
      controller.getDocument({ sub: OTHER, role: "ORGANIZER" } as any, OWNER, FILE, res as any),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(uploads.readObject).not.toHaveBeenCalled();
  });

  it("refuse un nom de fichier arbitraire", async () => {
    await expect(
      controller.getDocument({ sub: OWNER, role: "ORGANIZER" } as any, OWNER, "../secret.pdf", res as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
