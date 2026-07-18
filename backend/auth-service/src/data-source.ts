import { DataSource } from "typeorm";
import { BackupCode } from "./auth/backup-code.entity";
import { User } from "./user/user.entity";

export default new DataSource({
  type: "postgres",
  url: process.env.DATABASE_URL,
  schema: "auth",
  entities: [User, BackupCode],
  migrations: ["src/migrations/*.ts"],
});
