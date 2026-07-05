import { DataSource } from "typeorm";
import { User } from "./user/user.entity";

export default new DataSource({
  type: "postgres",
  url: process.env.DATABASE_URL,
  schema: "auth",
  entities: [User],
  migrations: ["src/migrations/*.ts"],
});
