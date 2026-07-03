import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ControlAgent } from './control-agent.entity';
import { ControlAgentController } from './control-agent.controller';
import { ControlAgentService } from './control-agent.service';

@Module({
  imports: [TypeOrmModule.forFeature([ControlAgent])],
  controllers: [ControlAgentController],
  providers: [ControlAgentService],
})
export class ControlAgentModule {}
