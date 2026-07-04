import { DataSource } from 'typeorm';
import { BuyerProfile } from './buyer/buyer-profile.entity';
import { OrganizerProfile } from './organizer/organizer-profile.entity';

export default new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  schema: 'users',
  entities: [BuyerProfile, OrganizerProfile],
  migrations: ['src/migrations/*.ts'],
});
